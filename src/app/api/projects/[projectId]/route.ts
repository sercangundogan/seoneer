import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { json, requireSession, handleRouteError } from "@/lib/api";
import {
  deleteProject,
  getProjectForUser,
  updateProjectSettings,
} from "@/modules/projects/service";
import { enqueueJob } from "@/modules/jobs/enqueue";
import { confirmIntelligenceProfile, getLatestIntelligence } from "@/modules/intelligence/service";
import { listAuditLogs } from "@/modules/audit-logs/service";
import { getBillingState } from "@/modules/billing/service";
import { db, schema } from "@/lib/db";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, session.user.id);
    if (!project) return json({ error: "Not found" }, 404);

    const [intelligence, audit, roadmap, actions, logs, billing] = await Promise.all([
      getLatestIntelligence(projectId),
      db.query.seoAudits.findFirst({
        where: eq(schema.seoAudits.projectId, projectId),
        orderBy: [desc(schema.seoAudits.createdAt)],
      }),
      db.query.seoRoadmaps.findFirst({
        where: eq(schema.seoRoadmaps.projectId, projectId),
        orderBy: [desc(schema.seoRoadmaps.generatedAt)],
      }),
      db.query.seoActions.findMany({
        where: eq(schema.seoActions.projectId, projectId),
        orderBy: [desc(schema.seoActions.createdAt)],
        limit: 20,
      }),
      listAuditLogs(projectId, 30),
      getBillingState(project.workspaceId),
    ]);

    return json({ project, intelligence, audit, roadmap, actions, logs, billing });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  primarySeoGoal: z.string().optional(),
  publicationMode: z.enum(["review_all", "one_click", "auto_safe"]).optional(),
  confirmIntelligence: z
    .object({
      name: z.string().optional(),
      summary: z.string().optional(),
      audiences: z.array(z.string()).optional(),
      conversionGoals: z.array(z.string()).optional(),
    })
    .optional(),
  startAnalysis: z.boolean().optional(),
  startAudit: z.boolean().optional(),
  runActionCycle: z.boolean().optional(),
  monitorPerformance: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, session.user.id);
    if (!project) return json({ error: "Not found" }, 404);

    const body = patchSchema.parse(await request.json());

    if (body.primarySeoGoal || body.publicationMode) {
      await updateProjectSettings(projectId, session.user.id, {
        primarySeoGoal: body.primarySeoGoal,
        publicationMode: body.publicationMode,
      });
    }

    if (body.confirmIntelligence) {
      await confirmIntelligenceProfile({
        projectId,
        userId: session.user.id,
        overrides: body.confirmIntelligence,
      });
    }

    const jobs: { name: string; id: string }[] = [];
    if (body.startAnalysis) {
      await updateProjectSettings(projectId, session.user.id, {
        agentStatus: "analysing",
        agentStatusDetail: "Queued repository analysis",
      });
      const job = await enqueueJob("project.buildIntelligence", { projectId });
      jobs.push({ name: "project.buildIntelligence", id: job.id });
    }
    if (body.startAudit) {
      const job = await enqueueJob("project.initialAudit", { projectId });
      jobs.push({ name: "project.initialAudit", id: job.id });
    }
    if (body.runActionCycle) {
      const job = await enqueueJob("seo.runActionCycle", { projectId });
      jobs.push({ name: "seo.runActionCycle", id: job.id });
    }
    if (body.monitorPerformance) {
      const job = await enqueueJob("seo.monitorPerformance", { projectId });
      jobs.push({ name: "seo.monitorPerformance", id: job.id });
    }

    const updated = await getProjectForUser(projectId, session.user.id);
    return json({ project: updated, jobs });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { projectId } = await params;
    await deleteProject(projectId, session.user.id);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

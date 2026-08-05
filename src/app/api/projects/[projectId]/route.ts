import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { json, requireSession, handleRouteError } from "@/lib/api";
import {
  deleteProject,
  getProjectForUser,
  getProjectRepository,
  updateProjectSettings,
} from "@/modules/projects/service";
import { enqueueJob } from "@/modules/jobs/enqueue";
import { confirmIntelligenceProfile, getLatestIntelligence } from "@/modules/intelligence/service";
import { listAuditLogs } from "@/modules/audit-logs/service";
import { getBillingState } from "@/modules/billing/service";
import { resolveGithubReviewUrl } from "@/modules/github/client";
import {
  listWorkPrograms,
  saveWorkPrograms,
  serializeWorkPrograms,
} from "@/modules/work-programs/service";
import { workProgramInputSchema } from "@/modules/work-programs/catalog";
import { db, schema } from "@/lib/db";
import { syncOpenPullRequestForProject } from "@/modules/pull-requests/sync";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { projectId } = await params;
    const project = await getProjectForUser(projectId, session.user.id);
    if (!project) return json({ error: "Not found" }, 404);

    await syncOpenPullRequestForProject(projectId);

    const [
      refreshedProject,
      intelligence,
      audit,
      roadmap,
      actions,
      logs,
      billing,
      latestPullRequest,
      repository,
      workProgramRows,
      gscConnection,
    ] = await Promise.all([
      getProjectForUser(projectId, session.user.id),
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
      db.query.pullRequests.findFirst({
        where: eq(schema.pullRequests.projectId, projectId),
        orderBy: [desc(schema.pullRequests.createdAt)],
      }),
      getProjectRepository(projectId),
      listWorkPrograms(projectId),
      db.query.gscConnections.findFirst({
        where: eq(schema.gscConnections.projectId, projectId),
      }),
    ]);

    if (!refreshedProject) return json({ error: "Not found" }, 404);

    const reviewUrl = latestPullRequest
      ? resolveGithubReviewUrl({
          prUrl: latestPullRequest.prUrl,
          owner: repository?.owner,
          repo: repository?.name,
          baseBranch: latestPullRequest.baseBranch,
          branch: latestPullRequest.branch,
        })
      : null;

    return json({
      project: refreshedProject,
      intelligence,
      audit,
      roadmap,
      actions,
      logs,
      billing,
      workPrograms: serializeWorkPrograms(workProgramRows),
      gsc: gscConnection
        ? { connected: true as const, siteUrl: gscConnection.siteUrl }
        : { connected: false as const, siteUrl: null },
      latestPullRequest: latestPullRequest
        ? {
            id: latestPullRequest.id,
            prNumber: latestPullRequest.prNumber,
            prUrl: reviewUrl,
            branch: latestPullRequest.branch,
            mergeStatus: latestPullRequest.mergeStatus,
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const patchSchema = z.object({
  primarySeoGoal: z.string().optional(),
  publicationMode: z.enum(["review_all", "one_click"]).optional(),
  workPrograms: z.array(workProgramInputSchema).min(1).optional(),
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
  runFirstAction: z.boolean().optional(),
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

    if (body.workPrograms) {
      await saveWorkPrograms(projectId, body.workPrograms);
    }

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
      if (body.runFirstAction) {
        await updateProjectSettings(projectId, session.user.id, {
          agentStatus: "selecting_action",
          agentStatusDetail: "Running initial audit, then your first SEO action",
        });
      }
      const job = await enqueueJob("project.initialAudit", {
        projectId,
        runFirstAction: Boolean(body.runFirstAction),
      });
      jobs.push({ name: "project.initialAudit", id: job.id });
    }
    if (body.runActionCycle) {
      await updateProjectSettings(projectId, session.user.id, {
        agentStatus: "selecting_action",
        agentStatusDetail: "Starting SEO action cycle…",
      });
      const job = await enqueueJob("seo.runActionCycle", { projectId });
      jobs.push({ name: "seo.runActionCycle", id: job.id });
    }
    if (body.monitorPerformance) {
      const job = await enqueueJob("seo.monitorPerformance", { projectId });
      jobs.push({ name: "seo.monitorPerformance", id: job.id });
    }

    const updated = await getProjectForUser(projectId, session.user.id);
    const workProgramRows = await listWorkPrograms(projectId);
    return json({
      project: updated,
      jobs,
      workPrograms: serializeWorkPrograms(workProgramRows),
    });
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

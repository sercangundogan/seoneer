import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai";
import {
  PROJECT_ANALYST_PROMPT,
  projectIntelligenceProfileSchema,
  type ProjectIntelligenceProfile,
} from "@/modules/intelligence/schemas";
import {
  analyseRepository,
  buildHeuristicIntelligence,
} from "@/modules/repo-analysis/service";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { env } from "@/lib/env";
import { markFreeEntitlement } from "@/modules/billing/service";

export async function buildIntelligenceProfile(projectId: string): Promise<{
  profile: ProjectIntelligenceProfile;
  version: number;
  agentRunId: string;
}> {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");

  await db
    .update(schema.projects)
    .set({
      agentStatus: "analysing",
      agentStatusDetail: "Building Project Intelligence Profile",
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId));

  const summary = await analyseRepository(projectId);
  const started = Date.now();

  const [run] = await db
    .insert(schema.agentRuns)
    .values({
      projectId,
      stage: "project_analyst",
      status: "running",
      input: { commitSha: summary.commitSha, fileCount: Object.keys(summary.files).length },
      model: env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "configured" : "heuristic",
    })
    .returning();

  let profile: ProjectIntelligenceProfile;
  let model = "heuristic";
  let cost = 0;

  try {
    if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
      const result = await generateStructured({
        tier: "strong",
        system: PROJECT_ANALYST_PROMPT,
        prompt: JSON.stringify({
          projectName: project.name,
          directoryMap: summary.directoryMap,
          detected: summary.detected,
          files: summary.files,
        }),
        schema: projectIntelligenceProfileSchema,
      });
      profile = result.object;
      model = result.model;
      cost = result.estimatedCostUsd;
    } else {
      profile = buildHeuristicIntelligence(summary, project.name);
    }

    const latest = await db.query.projectIntelligenceProfiles.findFirst({
      where: eq(schema.projectIntelligenceProfiles.projectId, projectId),
      orderBy: [desc(schema.projectIntelligenceProfiles.version)],
    });
    const version = (latest?.version ?? 0) + 1;

    await db.insert(schema.projectIntelligenceProfiles).values({
      projectId,
      version,
      profile,
    });

    await db
      .update(schema.agentRuns)
      .set({
        status: "succeeded",
        output: profile,
        decisionSummary: profile.decisionSummary,
        model,
        estimatedCostUsd: String(cost),
        durationMs: Date.now() - started,
        confidence: String(profile.product.confidence),
      })
      .where(eq(schema.agentRuns.id, run.id));

    await writeAuditLog({
      workspaceId: project.workspaceId,
      projectId,
      action: "intelligence.generated",
      entityType: "project_intelligence_profile",
      summary: profile.decisionSummary,
      evidence: { version, commitSha: summary.commitSha },
    });

    await markFreeEntitlement(project.workspaceId, "initialAnalysisUsed");

    await db
      .update(schema.projects)
      .set({
        agentStatus: "awaiting_confirmation",
        agentStatusDetail: "Confirm or edit the product summary",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));

    return { profile, version, agentRunId: run.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(schema.agentRuns)
      .set({
        status: "failed",
        decisionSummary: message,
        durationMs: Date.now() - started,
      })
      .where(eq(schema.agentRuns.id, run.id));
    await db
      .update(schema.projects)
      .set({
        agentStatus: "error",
        agentStatusDetail: `Analysis failed: ${message}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    throw error;
  }
}

export async function confirmIntelligenceProfile(input: {
  projectId: string;
  userId: string;
  overrides?: Partial<{
    name: string;
    summary: string;
    audiences: string[];
    conversionGoals: string[];
  }>;
}) {
  const latest = await db.query.projectIntelligenceProfiles.findFirst({
    where: eq(schema.projectIntelligenceProfiles.projectId, input.projectId),
    orderBy: [desc(schema.projectIntelligenceProfiles.version)],
  });
  if (!latest) throw new Error("No profile to confirm");

  const profile = latest.profile as ProjectIntelligenceProfile;
  if (input.overrides) {
    if (input.overrides.name) profile.product.name = input.overrides.name;
    if (input.overrides.summary) profile.product.summary = input.overrides.summary;
    if (input.overrides.audiences) profile.product.audiences = input.overrides.audiences;
    if (input.overrides.conversionGoals)
      profile.product.conversionGoals = input.overrides.conversionGoals;
  }

  await db
    .update(schema.projectIntelligenceProfiles)
    .set({
      profile,
      userOverrides: input.overrides ?? {},
      confirmedAt: new Date(),
    })
    .where(eq(schema.projectIntelligenceProfiles.id, latest.id));

  return profile;
}

export async function getLatestIntelligence(projectId: string) {
  return db.query.projectIntelligenceProfiles.findFirst({
    where: eq(schema.projectIntelligenceProfiles.projectId, projectId),
    orderBy: [desc(schema.projectIntelligenceProfiles.version)],
  });
}

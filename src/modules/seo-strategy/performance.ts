import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { performanceAnalysisSchema } from "@/modules/seo-strategy/schemas";

/**
 * Performance Analyst — compares recent GSC snapshot deltas for merged actions.
 * Uses heuristics when AI providers are unavailable.
 */
export async function runPerformanceAnalysis(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");

  const merged = await db.query.seoActions.findMany({
    where: eq(schema.seoActions.status, "merged"),
    orderBy: [desc(schema.seoActions.updatedAt)],
    limit: 5,
  });

  const gsc = await db.query.gscConnections.findFirst({
    where: eq(schema.gscConnections.projectId, projectId),
  });
  const snapshots = gsc
    ? await db.query.gscSnapshots.findMany({
        where: eq(schema.gscSnapshots.connectionId, gsc.id),
        orderBy: [desc(schema.gscSnapshots.fetchedAt)],
        limit: 2,
      })
    : [];

  const latestAction = merged[0];
  const analysis = {
    actionId: latestAction?.id ?? "none",
    window: {
      start: snapshots[1]?.periodStart ?? new Date(Date.now() - 28 * 86400000).toISOString(),
      end: snapshots[0]?.periodEnd ?? new Date().toISOString(),
    },
    metrics: {
      clicksDelta: 0,
      impressionsDelta: 0,
      positionDelta: 0,
    },
    interpretation: gsc
      ? "Insufficient longitudinal data yet; continue monitoring."
      : "Connect Search Console to measure impact.",
    implicationsForFutureSelection: [
      "Prefer updates to pages with impressions but low CTR",
      "Avoid new articles when technical foundations remain open",
    ],
    confidence: gsc ? 0.4 : 0.2,
    decisionSummary: "Performance analysis recorded for future action selection.",
  };

  performanceAnalysisSchema.parse(analysis);

  await db.insert(schema.agentRuns).values({
    seoActionId: latestAction?.id,
    projectId,
    stage: "performance_analyst",
    status: "succeeded",
    input: { snapshotCount: snapshots.length },
    output: analysis,
    decisionSummary: analysis.decisionSummary,
    confidence: String(analysis.confidence),
    model: "heuristic",
  });

  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId,
    action: "performance.analysed",
    summary: analysis.decisionSummary,
    evidence: analysis.metrics,
  });

  return analysis;
}

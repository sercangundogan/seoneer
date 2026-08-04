/**
 * Job enqueue helpers.
 * When TRIGGER_SECRET_KEY is unset, runs handlers in-process (dev/test).
 */
import { env } from "@/lib/env";

export type JobName =
  | "project.buildIntelligence"
  | "project.initialAudit"
  | "seo.runActionCycle"
  | "seo.monitorPerformance"
  | "billing.processWebhook";

type JobPayloads = {
  "project.buildIntelligence": { projectId: string };
  "project.initialAudit": { projectId: string };
  "seo.runActionCycle": { projectId: string };
  "seo.monitorPerformance": { projectId: string };
  "billing.processWebhook": { externalId: string; payload: Record<string, unknown> };
};

export async function enqueueJob<T extends JobName>(
  name: T,
  payload: JobPayloads[T],
): Promise<{ id: string; mode: "trigger" | "inline" }> {
  if (!env.TRIGGER_SECRET_KEY) {
    const { runJobInline } = await import("@/modules/jobs/runners");
    const result = await runJobInline(name, payload);
    return { id: result.id, mode: "inline" };
  }

  // Trigger.dev path — dynamic import to keep local builds simple
  const { tasks } = await import("@trigger.dev/sdk");
  const handle = await tasks.trigger(name, payload);
  return { id: handle.id, mode: "trigger" };
}

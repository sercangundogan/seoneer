/**
 * Job enqueue helpers.
 * Long work must not block the HTTP response (Vercel timeout).
 * Prefer Trigger.dev when configured; otherwise schedule with Next.js `after()`.
 */
import { nanoid } from "nanoid";
import { env } from "@/lib/env";

export type JobName =
  | "project.buildIntelligence"
  | "project.initialAudit"
  | "seo.runActionCycle"
  | "seo.monitorPerformance"
  | "billing.processWebhook";

type JobPayloads = {
  "project.buildIntelligence": { projectId: string };
  "project.initialAudit": { projectId: string; runFirstAction?: boolean };
  "seo.runActionCycle": { projectId: string; preferProgramKey?: string };
  "seo.monitorPerformance": { projectId: string };
  "billing.processWebhook": { externalId: string; payload: Record<string, unknown> };
};

export async function enqueueJob<T extends JobName>(
  name: T,
  payload: JobPayloads[T],
): Promise<{ id: string; mode: "trigger" | "inline" }> {
  if (env.TRIGGER_SECRET_KEY) {
    try {
      const { tasks } = await import("@trigger.dev/sdk");
      const handle = await tasks.trigger(name, payload);
      return { id: handle.id, mode: "trigger" };
    } catch (error) {
      console.error("Trigger.dev enqueue failed; falling back to after()", error);
    }
  }

  const id = nanoid();
  const { after } = await import("next/server");
  after(async () => {
    try {
      const { runJobInline } = await import("@/modules/jobs/runners");
      await runJobInline(name, payload as Record<string, unknown>);
    } catch (error) {
      console.error(`Background job failed: ${name}`, error);
    }
  });
  return { id, mode: "inline" };
}

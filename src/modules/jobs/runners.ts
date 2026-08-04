import { buildIntelligenceProfile } from "@/modules/intelligence/service";
import { runInitialAudit, runActionCycle } from "@/modules/seo-strategy/service";
import { runPerformanceAnalysis } from "@/modules/seo-strategy/performance";
import { processDodoWebhook } from "@/modules/billing/service";
import { nanoid } from "nanoid";

export async function runJobInline(name: string, payload: Record<string, unknown>) {
  const id = nanoid();
  switch (name) {
    case "project.buildIntelligence":
      await buildIntelligenceProfile(String(payload.projectId));
      break;
    case "project.initialAudit": {
      const projectId = String(payload.projectId);
      await runInitialAudit(projectId);
      // Onboarding: audit first, then automatically start the first SEO action
      if (payload.runFirstAction) {
        try {
          await runActionCycle(projectId);
        } catch (error) {
          console.error("First SEO action after onboarding audit failed", error);
        }
      }
      break;
    }
    case "seo.runActionCycle":
      await runActionCycle(String(payload.projectId));
      break;
    case "seo.monitorPerformance":
      await runPerformanceAnalysis(String(payload.projectId));
      break;
    case "billing.processWebhook":
      await processDodoWebhook({
        externalId: String(payload.externalId),
        payload: (payload.payload as Record<string, unknown>) ?? {},
      });
      break;
    default:
      throw new Error(`Unknown job: ${name}`);
  }
  return { id };
}

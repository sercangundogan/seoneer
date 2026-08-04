import { task } from "@trigger.dev/sdk";
import { buildIntelligenceProfile } from "../src/modules/intelligence/service";
import { runInitialAudit, runActionCycle } from "../src/modules/seo-strategy/service";
import { runPerformanceAnalysis } from "../src/modules/seo-strategy/performance";
import { processDodoWebhook } from "../src/modules/billing/service";

export const buildIntelligenceTask = task({
  id: "project.buildIntelligence",
  run: async (payload: { projectId: string }) => {
    return buildIntelligenceProfile(payload.projectId);
  },
});

export const initialAuditTask = task({
  id: "project.initialAudit",
  run: async (payload: { projectId: string }) => {
    return runInitialAudit(payload.projectId);
  },
});

export const runActionCycleTask = task({
  id: "seo.runActionCycle",
  run: async (payload: { projectId: string }) => {
    return runActionCycle(payload.projectId);
  },
});

export const monitorPerformanceTask = task({
  id: "seo.monitorPerformance",
  run: async (payload: { projectId: string }) => {
    return runPerformanceAnalysis(payload.projectId);
  },
});

export const billingWebhookTask = task({
  id: "billing.processWebhook",
  run: async (payload: { externalId: string; payload: Record<string, unknown> }) => {
    return processDodoWebhook(payload);
  },
});

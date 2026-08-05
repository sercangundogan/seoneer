import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isBillingBlockDetail } from "@/lib/agent-status";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { planForProductId, type PaidPlan } from "@/modules/billing/dodo";

export async function grantFreeEntitlement(workspaceId: string) {
  const existing = await db.query.freeEntitlements.findFirst({
    where: eq(schema.freeEntitlements.workspaceId, workspaceId),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(schema.freeEntitlements)
    .values({ workspaceId })
    .returning();
  return row;
}

export async function getBillingState(workspaceId: string) {
  const [subscription, credits, entitlement] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.workspaceId, workspaceId),
    }),
    db.query.seoActionCredits.findFirst({
      where: and(
        eq(schema.seoActionCredits.workspaceId, workspaceId),
        gt(schema.seoActionCredits.periodEnd, new Date()),
      ),
    }),
    db.query.freeEntitlements.findFirst({
      where: eq(schema.freeEntitlements.workspaceId, workspaceId),
    }),
  ]);
  return { subscription, credits, entitlement };
}

export async function canStartActionCycle(
  workspaceId: string,
  requiredCredits = 1,
): Promise<{
  ok: boolean;
  reason?: string;
  useFreeSample?: boolean;
}> {
  const state = await getBillingState(workspaceId);
  if (state.subscription?.status === "paused" || state.subscription?.status === "past_due") {
    return { ok: false, reason: "Subscription inactive. Update billing to continue." };
  }
  if (state.subscription?.plan === "free" || !state.subscription || state.subscription.plan === "free") {
    if (state.entitlement && !state.entitlement.samplePrUsed) {
      return { ok: true, useFreeSample: true };
    }
    if ((state.credits?.balance ?? 0) >= requiredCredits) {
      return { ok: true };
    }
    return { ok: false, reason: "Free sample used. Upgrade for SEO Action credits." };
  }
  if ((state.credits?.balance ?? 0) < requiredCredits) {
    return {
      ok: false,
      reason: `Need ${requiredCredits} SEO Action credit(s); ${state.credits?.balance ?? 0} left this period.`,
    };
  }
  return { ok: true };
}

export async function reserveCredits(input: {
  workspaceId: string;
  projectId: string;
  seoActionId: string;
  amount: number;
  useFreeSample?: boolean;
}) {
  if (input.useFreeSample) {
    await db
      .update(schema.freeEntitlements)
      .set({ samplePrUsed: true })
      .where(eq(schema.freeEntitlements.workspaceId, input.workspaceId));
    await db.insert(schema.usageLedgers).values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      kind: "free_sample_pr",
      amount: 1,
      seoActionId: input.seoActionId,
    });
    return;
  }

  const credits = await db.query.seoActionCredits.findFirst({
    where: and(
      eq(schema.seoActionCredits.workspaceId, input.workspaceId),
      gt(schema.seoActionCredits.periodEnd, new Date()),
    ),
  });
  if (!credits || credits.balance < input.amount) {
    throw new Error("Insufficient SEO Action credits");
  }
  await db
    .update(schema.seoActionCredits)
    .set({ balance: credits.balance - input.amount })
    .where(eq(schema.seoActionCredits.id, credits.id));
  await db.insert(schema.usageLedgers).values({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    kind: "seo_action_credit",
    amount: input.amount,
    seoActionId: input.seoActionId,
  });
}

export async function markFreeEntitlement(
  workspaceId: string,
  field: "initialAnalysisUsed" | "initialAuditUsed" | "briefUsed" | "samplePrUsed",
) {
  await db
    .update(schema.freeEntitlements)
    .set({ [field]: true })
    .where(eq(schema.freeEntitlements.workspaceId, workspaceId));
}

export async function processDodoWebhook(input: {
  externalId: string;
  payload: Record<string, unknown>;
}) {
  try {
    await db.insert(schema.webhookEvents).values({
      provider: "dodo",
      externalId: input.externalId,
      payload: input.payload,
    });
  } catch {
    return { duplicate: true };
  }

  const type = String(input.payload.type ?? input.payload.event ?? "");
  const data = (input.payload.data ?? input.payload) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const workspaceId = String(
    metadata.workspace_id ?? data.workspace_id ?? metadata.workspaceId ?? "",
  );

  const productCart = data.product_cart as Array<{ product_id?: string }> | undefined;
  const productId = String(
    data.product_id ?? productCart?.[0]?.product_id ?? metadata.product_id ?? "",
  );
  const mappedPlan = productId ? planForProductId(productId) : null;
  const metadataPlan = String(metadata.plan ?? "");
  const planFromPayload = String(data.plan ?? "");
  const plan: PaidPlan | string =
    mappedPlan ??
    (["starter", "growth", "scale"].includes(metadataPlan)
      ? metadataPlan
      : ["starter", "growth", "scale"].includes(planFromPayload)
        ? planFromPayload
        : "starter");

  const customer =
    typeof data.customer === "object" && data.customer !== null
      ? (data.customer as { customer_id?: string })
      : null;
  const customerId = String(data.customer_id ?? customer?.customer_id ?? "");

  if (
    workspaceId &&
    (type.includes("subscription") ||
      type.includes("checkout") ||
      type.includes("payment.succeeded"))
  ) {
    const statusRaw = String(data.status ?? "active");
    const status =
      statusRaw === "cancelled" || statusRaw === "canceled"
        ? "cancelled"
        : statusRaw === "past_due"
          ? "past_due"
          : statusRaw === "paused" || statusRaw === "on_hold"
            ? "paused"
            : "active";

    const skipCreditGrant =
      type.includes("payment.failed") ||
      type.includes("subscription.cancelled") ||
      type.includes("subscription.expired");

    await db
      .update(schema.subscriptions)
      .set({
        plan,
        status,
        dodoCustomerId: customerId || undefined,
        dodoSubscriptionId: data.subscription_id
          ? String(data.subscription_id)
          : data.id
            ? String(data.id)
            : undefined,
        currentPeriodEnd: data.current_period_end
          ? new Date(String(data.current_period_end))
          : data.next_billing_date
            ? new Date(String(data.next_billing_date))
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.workspaceId, workspaceId));

    if (!skipCreditGrant && PLAN_CREDITS[plan] > 0) {
      const creditAmount = PLAN_CREDITS[plan] ?? 10;
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.insert(schema.seoActionCredits).values({
        workspaceId,
        balance: creditAmount,
        periodStart,
        periodEnd,
      });
    }

    if (!skipCreditGrant && status === "active" && plan !== "free") {
      await clearBillingBlockedProjects(workspaceId);
    }

    await writeAuditLog({
      workspaceId,
      action: "billing.subscription_updated",
      summary: `Subscription updated to ${plan} (${status})`,
      evidence: { type, externalId: input.externalId, productId },
    });
  }

  if (type.includes("payment.failed") && workspaceId) {
    await db
      .update(schema.subscriptions)
      .set({ status: "past_due", updatedAt: new Date() })
      .where(eq(schema.subscriptions.workspaceId, workspaceId));
  }

  await db
    .update(schema.webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(schema.webhookEvents.externalId, input.externalId));

  return { duplicate: false };
}

/**
 * Projects stay `blocked` after the free sample is used. After a paid plan
 * activates, clear those billing blocks so the UI and schedulers can continue.
 */
export async function clearBillingBlockedProjects(workspaceId: string) {
  const projects = await db.query.projects.findMany({
    where: and(
      eq(schema.projects.workspaceId, workspaceId),
      eq(schema.projects.agentStatus, "blocked"),
    ),
  });

  for (const project of projects) {
    if (!isBillingBlockDetail(project.agentStatusDetail)) continue;
    await db
      .update(schema.projects)
      .set({
        agentStatus: "idle",
        agentStatusDetail: "Plan active — ready for the next SEO action",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, project.id));
  }
}

/**
 * If the agent is stuck on a billing block but billing now allows a cycle,
 * clear the stale status (self-heal after upgrade when webhook already ran).
 */
export async function healBillingBlockedProject(projectId: string, workspaceId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project || project.agentStatus !== "blocked") return null;
  if (!isBillingBlockDetail(project.agentStatusDetail)) return null;

  const billing = await canStartActionCycle(workspaceId);
  if (!billing.ok) return null;

  const [updated] = await db
    .update(schema.projects)
    .set({
      agentStatus: "idle",
      agentStatusDetail: "Plan active — ready for the next SEO action",
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId))
    .returning();

  return updated ?? null;
}

export const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  starter: 10,
  growth: 30,
  scale: 100,
};

import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { writeAuditLog } from "@/modules/audit-logs/service";

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

export async function canStartActionCycle(workspaceId: string): Promise<{
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
    if ((state.credits?.balance ?? 0) > 0) {
      return { ok: true };
    }
    return { ok: false, reason: "Free sample used. Upgrade for SEO Action credits." };
  }
  if ((state.credits?.balance ?? 0) <= 0) {
    return { ok: false, reason: "No SEO Action credits remaining this period." };
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
  const workspaceId = String(data.workspace_id ?? metadata.workspace_id ?? "");

  if (workspaceId && (type.includes("subscription") || type.includes("checkout"))) {
    const plan = String(data.plan ?? data.product_id ?? "starter");
    const statusRaw = String(data.status ?? "active");
    const status =
      statusRaw === "cancelled" || statusRaw === "canceled"
        ? "cancelled"
        : statusRaw === "past_due"
          ? "past_due"
          : statusRaw === "paused"
            ? "paused"
            : "active";

    await db
      .update(schema.subscriptions)
      .set({
        plan,
        status,
        dodoCustomerId: data.customer_id ? String(data.customer_id) : undefined,
        dodoSubscriptionId: data.subscription_id ? String(data.subscription_id) : undefined,
        currentPeriodEnd: data.current_period_end
          ? new Date(String(data.current_period_end))
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.workspaceId, workspaceId));

    const creditAmount = plan === "growth" ? 30 : plan === "scale" ? 100 : 10;
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await db.insert(schema.seoActionCredits).values({
      workspaceId,
      balance: creditAmount,
      periodStart,
      periodEnd,
    });

    await writeAuditLog({
      workspaceId,
      action: "billing.subscription_updated",
      summary: `Subscription updated to ${plan} (${status})`,
      evidence: { type, externalId: input.externalId },
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

export const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  starter: 10,
  growth: 30,
  scale: 100,
};

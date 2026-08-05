import { json, requireSession, handleRouteError } from "@/lib/api";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import { getBillingState, PLAN_CREDITS } from "@/modules/billing/service";
import {
  createCustomerPortalSession,
  dodoDiagnostics,
  dodoMode,
  isDodoConfigured,
  productIdForPlan,
} from "@/modules/billing/dodo";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);

    const state = await getBillingState(workspace.id);
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.workspaceId, workspace.id),
    });

    let portalUrl: string | null = null;
    if (isDodoConfigured() && subscription?.dodoCustomerId) {
      try {
        portalUrl = await createCustomerPortalSession({
          customerId: subscription.dodoCustomerId,
          returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing`,
        });
      } catch (error) {
        console.error("Failed to create Dodo portal session", error);
      }
    }

    return json({
      ...state,
      plans: Object.entries(PLAN_CREDITS).map(([plan, credits]) => ({
        plan,
        credits,
        productConfigured:
          plan === "free" || Boolean(productIdForPlan(plan as "starter" | "growth" | "scale")),
      })),
      checkoutEnabled: isDodoConfigured(),
      dodoMode: isDodoConfigured() ? dodoMode() : null,
      dodoDiagnostics: isDodoConfigured() ? dodoDiagnostics() : null,
      portalUrl,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

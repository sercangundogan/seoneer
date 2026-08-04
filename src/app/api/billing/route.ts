import { json, requireSession } from "@/lib/api";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import { getBillingState, PLAN_CREDITS } from "@/modules/billing/service";
import { env } from "@/lib/env";

export async function GET() {
  const session = await requireSession();
  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) return json({ error: "Workspace missing" }, 400);
  const state = await getBillingState(workspace.id);
  return json({
    ...state,
    plans: Object.entries(PLAN_CREDITS).map(([plan, credits]) => ({ plan, credits })),
    portalUrl: env.DODO_API_KEY ? "https://checkout.dodopayments.com/portal" : null,
    checkoutEnabled: Boolean(env.DODO_API_KEY),
  });
}

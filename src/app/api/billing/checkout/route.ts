import { z } from "zod";
import { json, requireSession, handleRouteError } from "@/lib/api";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  type PaidPlan,
} from "@/modules/billing/dodo";
import { env } from "@/lib/env";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "growth", "scale"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);

    const body = checkoutSchema.parse(await request.json());
    const returnUrl = `${env.NEXT_PUBLIC_APP_URL}/billing?checkout=success`;

    const { checkoutUrl } = await createCheckoutSession({
      plan: body.plan as PaidPlan,
      customerEmail: session.user.email,
      customerName: session.user.name ?? session.user.email,
      returnUrl,
      workspaceId: workspace.id,
    });

    return json({ checkoutUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.workspaceId, workspace.id),
    });

    if (!subscription?.dodoCustomerId) {
      return json({ portalUrl: null });
    }

    const portalUrl = await createCustomerPortalSession({
      customerId: subscription.dodoCustomerId,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return json({ portalUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}

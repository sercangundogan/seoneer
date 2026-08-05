import { env } from "@/lib/env";

export type PaidPlan = "starter" | "growth" | "scale";

const PLAN_PRODUCT_ENV: Record<PaidPlan, string> = {
  starter: "DODO_PRODUCT_STARTER",
  growth: "DODO_PRODUCT_GROWTH",
  scale: "DODO_PRODUCT_SCALE",
};

function dodoBaseUrl(): string {
  const key = env.DODO_API_KEY ?? "";
  if (key.startsWith("test_")) return "https://test.dodopayments.com";
  return "https://live.dodopayments.com";
}

function requireApiKey(): string {
  if (!env.DODO_API_KEY) throw new Error("Dodo Payments is not configured");
  return env.DODO_API_KEY;
}

export function isDodoConfigured(): boolean {
  return Boolean(env.DODO_API_KEY);
}

export function productIdForPlan(plan: PaidPlan): string | null {
  const envKey = PLAN_PRODUCT_ENV[plan];
  const value = process.env[envKey];
  return value?.trim() || null;
}

export function planForProductId(productId: string): PaidPlan | null {
  const id = productId.trim();
  if (id === process.env.DODO_PRODUCT_STARTER?.trim()) return "starter";
  if (id === process.env.DODO_PRODUCT_GROWTH?.trim()) return "growth";
  if (id === process.env.DODO_PRODUCT_SCALE?.trim()) return "scale";
  return null;
}

export function dodoMode(): "test" | "live" {
  return (env.DODO_API_KEY ?? "").startsWith("test_") ? "test" : "live";
}

async function dodoFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${dodoBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body as { message?: string }).message ??
      (body as { error?: string }).error ??
      `Dodo API error (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export async function createCheckoutSession(input: {
  plan: PaidPlan;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  workspaceId: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const productId = productIdForPlan(input.plan);
  if (!productId) {
    throw new Error(
      `Product ID for plan "${input.plan}" is not configured. Set ${PLAN_PRODUCT_ENV[input.plan]} in your environment.`,
    );
  }

  const data = (await dodoFetch("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: input.customerEmail,
        name: input.customerName,
      },
      return_url: input.returnUrl,
      metadata: {
        workspace_id: input.workspaceId,
        plan: input.plan,
      },
    }),
  })) as { checkout_url?: string | null; session_id?: string };

  if (!data.checkout_url) {
    throw new Error("Dodo did not return a checkout URL");
  }

  return {
    checkoutUrl: data.checkout_url,
    sessionId: data.session_id ?? "",
  };
}

export async function createCustomerPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const params = new URLSearchParams({ return_url: input.returnUrl });
  const data = (await dodoFetch(
    `/customers/${encodeURIComponent(input.customerId)}/customer-portal/session?${params}`,
    { method: "POST", body: JSON.stringify({}) },
  )) as { link?: string };

  if (!data.link) throw new Error("Dodo did not return a portal link");
  return data.link;
}

import { env } from "@/lib/env";

export type PaidPlan = "starter" | "growth" | "scale";

const PLAN_PRODUCT_ENV: Record<PaidPlan, string> = {
  starter: "DODO_PRODUCT_STARTER",
  growth: "DODO_PRODUCT_GROWTH",
  scale: "DODO_PRODUCT_SCALE",
};

export class DodoApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "DodoApiError";
    this.status = status;
    this.body = body;
  }
}

function resolveApiKey(): string | undefined {
  return (
    env.DODO_API_KEY?.trim() ||
    process.env.DODO_PAYMENTS_API_KEY?.trim() ||
    undefined
  );
}

function resolveEnvironment(): "test" | "live" {
  const explicit = process.env.DODO_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "test" || explicit === "test_mode") return "test";
  if (explicit === "live" || explicit === "live_mode") return "live";

  const key = resolveApiKey() ?? "";
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) return "live";
  // Default to test when ambiguous — safer for misconfigured keys during setup
  return "test";
}

function dodoBaseUrl(): string {
  return resolveEnvironment() === "test"
    ? "https://test.dodopayments.com"
    : "https://live.dodopayments.com";
}

function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) throw new Error("Dodo Payments is not configured (set DODO_API_KEY)");
  return key;
}

export function isDodoConfigured(): boolean {
  return Boolean(resolveApiKey());
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
  return resolveEnvironment();
}

export function dodoDiagnostics(): {
  mode: "test" | "live";
  apiBase: string;
  keyPrefix: string | null;
  writeAccessRequired: boolean;
  products: Record<PaidPlan, boolean>;
} {
  const key = resolveApiKey() ?? "";
  return {
    mode: dodoMode(),
    apiBase: dodoBaseUrl(),
    keyPrefix: key ? key.slice(0, 8) + "…" : null,
    writeAccessRequired: true,
    products: {
      starter: Boolean(productIdForPlan("starter")),
      growth: Boolean(productIdForPlan("growth")),
      scale: Boolean(productIdForPlan("scale")),
    },
  };
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
    const rawMessage =
      (body as { message?: string }).message ??
      (body as { error?: string }).error ??
      `Dodo API error (${res.status})`;

    if (res.status === 401) {
      throw new DodoApiError(
        `Dodo rejected the API key (${dodoMode()} mode, ${dodoBaseUrl()}). Use a ${dodoMode() === "test" ? "test_" : "live_"} key from the same mode with write access enabled.`,
        res.status,
        body,
      );
    }

    if (res.status === 403) {
      throw new DodoApiError(
        "Dodo API key is read-only. Create a new key with write access enabled.",
        res.status,
        body,
      );
    }

    throw new DodoApiError(rawMessage, res.status, body);
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

export type PlanPrice = {
  amountCents: number;
  currency: string;
  interval: "month" | "year" | "week" | "day";
  intervalCount: number;
};

/** Display fallbacks when Dodo product fetch is unavailable (matches live products). */
export const PLAN_PRICE_FALLBACKS: Record<string, PlanPrice> = {
  free: { amountCents: 0, currency: "USD", interval: "month", intervalCount: 1 },
  starter: { amountCents: 3900, currency: "USD", interval: "month", intervalCount: 1 },
  growth: { amountCents: 9900, currency: "USD", interval: "month", intervalCount: 1 },
  scale: { amountCents: 24900, currency: "USD", interval: "month", intervalCount: 1 },
};

type DodoProductPrice = {
  type?: string;
  price?: number;
  fixed_price?: number;
  currency?: string;
  payment_frequency_count?: number;
  payment_frequency_interval?: string;
};

function normalizeInterval(raw: string | undefined): PlanPrice["interval"] {
  const value = (raw ?? "Month").toLowerCase();
  if (value === "year") return "year";
  if (value === "week") return "week";
  if (value === "day") return "day";
  return "month";
}

function parseProductPrice(price: DodoProductPrice | null | undefined): PlanPrice | null {
  if (!price) return null;
  const amountCents =
    typeof price.price === "number"
      ? price.price
      : typeof price.fixed_price === "number"
        ? price.fixed_price
        : null;
  if (amountCents === null || !price.currency) return null;
  return {
    amountCents,
    currency: price.currency,
    interval: normalizeInterval(price.payment_frequency_interval),
    intervalCount: price.payment_frequency_count ?? 1,
  };
}

export async function fetchProductPrice(productId: string): Promise<PlanPrice | null> {
  try {
    const data = (await dodoFetch(`/products/${encodeURIComponent(productId)}`)) as {
      price?: DodoProductPrice;
    };
    return parseProductPrice(data.price);
  } catch {
    return null;
  }
}

export async function resolvePlanPrices(
  plans: string[],
): Promise<Record<string, PlanPrice>> {
  const entries = await Promise.all(
    plans.map(async (plan) => {
      if (plan === "free") {
        return [plan, PLAN_PRICE_FALLBACKS.free] as const;
      }
      if (plan !== "starter" && plan !== "growth" && plan !== "scale") {
        return [plan, PLAN_PRICE_FALLBACKS[plan] ?? PLAN_PRICE_FALLBACKS.starter] as const;
      }
      const productId = productIdForPlan(plan);
      const live =
        productId && isDodoConfigured() ? await fetchProductPrice(productId) : null;
      return [plan, live ?? PLAN_PRICE_FALLBACKS[plan]] as const;
    }),
  );
  return Object.fromEntries(entries);
}

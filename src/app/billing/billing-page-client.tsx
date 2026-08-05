"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaymentSuccessModal } from "@/components/billing/payment-success-modal";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button, Skeleton } from "@/components/ui/primitives";

type PlanPrice = {
  amountCents: number;
  currency: string;
  interval: "month" | "year" | "week" | "day";
  intervalCount: number;
};

type Billing = {
  subscription?: { plan: string; status: string };
  credits?: { balance: number } | null;
  entitlement?: {
    samplePrUsed: boolean;
    briefUsed: boolean;
    initialAuditUsed: boolean;
  };
  plans: {
    plan: string;
    credits: number;
    price?: PlanPrice | null;
    productConfigured?: boolean;
  }[];
  portalUrl: string | null;
  checkoutEnabled?: boolean;
  dodoMode?: "test" | "live" | null;
  dodoDiagnostics?: {
    mode: "test" | "live";
    apiBase: string;
    keyPrefix: string | null;
    products: Record<string, boolean>;
  } | null;
};

const PLAN_COPY: Record<
  string,
  { title: string; blurb: string; example: string }
> = {
  free: {
    title: "Free",
    blurb: "See how Seoneer works on one repo.",
    example: "Includes setup, first analysis, and 1 sample pull request.",
  },
  starter: {
    title: "Starter",
    blurb: "10 SEO Actions each month.",
    example: "Enough for a handful of improvements — like fixing titles on key pages.",
  },
  growth: {
    title: "Growth",
    blurb: "30 SEO Actions each month.",
    example: "A steady cadence — roughly one solid improvement most weeks.",
  },
  scale: {
    title: "Scale",
    blurb: "100 SEO Actions each month.",
    example: "For teams shipping SEO changes across more pages and content.",
  },
};

const PRICE_FALLBACKS: Record<string, PlanPrice> = {
  free: { amountCents: 0, currency: "USD", interval: "month", intervalCount: 1 },
  starter: { amountCents: 3900, currency: "USD", interval: "month", intervalCount: 1 },
  growth: { amountCents: 9900, currency: "USD", interval: "month", intervalCount: 1 },
  scale: { amountCents: 24900, currency: "USD", interval: "month", intervalCount: 1 },
};

function formatMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function intervalSuffix(price: PlanPrice) {
  if (price.amountCents === 0) return "";
  if (price.intervalCount === 1) return `/${price.interval}`;
  return `/${price.intervalCount} ${price.interval}s`;
}

function PlanSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
      aria-hidden
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-8 w-28" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-[80%]" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-6 h-10 w-32" />
    </div>
  );
}

export default function BillingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/billing", { credentials: "same-origin" });
        if (res.status === 401) {
          window.location.href = "/signin?callbackURL=/billing";
          return;
        }
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    setShowPaymentSuccess(true);
    router.replace("/billing", { scroll: false });

    // Webhooks can lag a few seconds — poll until plan/credits appear.
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void fetch("/api/billing", { credentials: "same-origin" })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: Billing | null) => {
          if (!body) return;
          setData(body);
          const paid =
            body.subscription?.plan &&
            body.subscription.plan !== "free" &&
            body.subscription.status === "active";
          if (paid || attempts >= 12) {
            window.clearInterval(timer);
          }
        });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [searchParams, router]);

  const dismissPaymentSuccess = useCallback(() => {
    setShowPaymentSuccess(false);
  }, []);

  async function startCheckout(plan: string) {
    if (plan === "free" || checkoutPlan) return;
    setCheckoutError("");
    setCheckoutPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/signin?callbackURL=/billing";
        return;
      }
      if (!res.ok) {
        const detail =
          body.source === "dodo"
            ? body.error
            : body.error ?? "Could not start checkout";
        throw new Error(detail);
      }
      if (!body.checkoutUrl) throw new Error("Checkout URL missing");
      window.location.href = body.checkoutUrl;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Checkout failed");
      setCheckoutPlan(null);
    }
  }

  const balance = data?.credits?.balance ?? 0;
  const sampleLeft = data?.entitlement && !data.entitlement.samplePrUsed;

  return (
    <AppShell title="Billing">
      <PaymentSuccessModal open={showPaymentSuccess} onClose={dismissPaymentSuccess} />

      {checkoutError ? (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--danger)]">
          {checkoutError}
        </div>
      ) : null}

      <div className="mb-8 max-w-xl space-y-3">
        <p className="text-sm text-[var(--fg-muted)]">
          You buy <strong className="font-medium text-[var(--fg)]">SEO Action credits</strong> — not
          AI tokens. Each credit pays for one complete improvement that Seoneer ships as a pull
          request.
        </p>
        {data?.dodoMode === "test" ? (
          <p className="rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--fg-muted)]">
            <span className="font-medium text-[var(--fg)]">Test mode.</span> Use card{" "}
            <code className="text-xs">4242 4242 4242 4242</code> — expiry{" "}
            <code className="text-xs">06/32</code>, CVC <code className="text-xs">123</code>. No real
            charge.
          </p>
        ) : null}
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--fg-muted)]">
          <span className="font-medium text-[var(--fg)]">Example:</span> improving titles and meta
          descriptions on your comparison posts uses <strong className="text-[var(--fg)]">1 credit</strong>{" "}
          and opens one PR for you to review.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3" aria-busy aria-label="Loading plans">
          <PlanSkeleton />
          <PlanSkeleton />
          <PlanSkeleton />
        </div>
      ) : (
        <div className="animate-fade-up grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(data?.plans ?? []).map((plan) => {
            const copy = PLAN_COPY[plan.plan] ?? {
              title: plan.plan,
              blurb:
                plan.credits === 0
                  ? "Included with your workspace."
                  : `${plan.credits} SEO Actions each month.`,
              example: "One credit = one pull request–ready SEO improvement.",
            };
            const price = plan.price ?? PRICE_FALLBACKS[plan.plan] ?? null;
            const current = data?.subscription?.plan === plan.plan;
            const canCheckout =
              plan.plan !== "free" &&
              data?.checkoutEnabled &&
              plan.productConfigured &&
              !current;

            return (
              <div
                key={plan.plan}
                className={`flex flex-col rounded-[var(--radius)] border bg-[var(--bg-elevated)] p-5 transition-[border-color,box-shadow] duration-300 ${
                  current
                    ? "border-[var(--accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    : "border-[var(--border)]"
                }`}
              >
                <h2 className="text-lg font-medium">{copy.title}</h2>
                {price ? (
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-[var(--fg)]">
                      {formatMoney(price.amountCents, price.currency)}
                    </span>
                    {price.amountCents === 0 ? (
                      <span className="text-sm text-[var(--fg-muted)]">forever</span>
                    ) : (
                      <span className="text-sm text-[var(--fg-muted)]">
                        {intervalSuffix(price)}
                      </span>
                    )}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-[var(--fg)]">{copy.blurb}</p>
                <p className="mt-2 flex-1 text-sm text-[var(--fg-muted)]">{copy.example}</p>
                {current ? (
                  <p className="mt-5 text-xs font-medium text-[var(--accent)]">
                    Current plan · {data?.subscription?.status}
                  </p>
                ) : plan.plan === "free" ? (
                  <Button className="mt-5 w-fit" variant="secondary" disabled>
                    Included
                  </Button>
                ) : canCheckout ? (
                  <Button
                    className="mt-5 w-fit"
                    variant="secondary"
                    loading={checkoutPlan === plan.plan}
                    disabled={Boolean(checkoutPlan)}
                    onClick={() => void startCheckout(plan.plan)}
                  >
                    Upgrade via Dodo
                  </Button>
                ) : (
                  <p className="mt-5 text-xs text-[var(--fg-muted)]">
                    {data?.checkoutEnabled
                      ? "Set product ID in env to enable checkout."
                      : "Add DODO_API_KEY to enable checkout."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-10 max-w-xl">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Your balance</h2>
        {loading ? (
          <div className="mt-3 space-y-2" aria-busy>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <div className="animate-fade-up mt-3 space-y-2 text-sm">
            <p>
              <span className="text-[var(--fg-muted)]">Credits left this period:</span>{" "}
              <strong className="text-[var(--fg)]">{balance}</strong>
            </p>
            <p className="text-[var(--fg-muted)]">
              Free sample PR:{" "}
              {sampleLeft ? (
                <span className="text-[var(--success)]">still available</span>
              ) : (
                <span>already used</span>
              )}
            </p>
            {data?.portalUrl ? (
              <a
                className="mt-2 inline-block text-[var(--accent)] underline-offset-2 hover:underline"
                href={data.portalUrl}
              >
                Manage billing in customer portal
              </a>
            ) : null}
          </div>
        )}
      </section>
    </AppShell>
  );
}

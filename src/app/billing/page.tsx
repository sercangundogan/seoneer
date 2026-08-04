"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button, Skeleton } from "@/components/ui/primitives";

type Billing = {
  subscription?: { plan: string; status: string };
  credits?: { balance: number } | null;
  entitlement?: {
    samplePrUsed: boolean;
    briefUsed: boolean;
    initialAuditUsed: boolean;
  };
  plans: { plan: string; credits: number }[];
  portalUrl: string | null;
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

function PlanSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
      aria-hidden
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-[80%]" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-6 h-10 w-32" />
    </div>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/billing");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const balance = data?.credits?.balance ?? 0;
  const sampleLeft = data?.entitlement && !data.entitlement.samplePrUsed;

  return (
    <AppShell title="Billing">
      <div className="mb-8 max-w-xl space-y-3">
        <p className="text-sm text-[var(--fg-muted)]">
          You buy <strong className="font-medium text-[var(--fg)]">SEO Action credits</strong> — not
          AI tokens. Each credit pays for one complete improvement that Seoneer ships as a pull
          request.
        </p>
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
            const current = data?.subscription?.plan === plan.plan;

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
                <p className="mt-2 text-sm text-[var(--fg)]">{copy.blurb}</p>
                <p className="mt-2 flex-1 text-sm text-[var(--fg-muted)]">{copy.example}</p>
                {current ? (
                  <p className="mt-5 text-xs font-medium text-[var(--accent)]">
                    Current plan · {data?.subscription?.status}
                  </p>
                ) : (
                  <Button className="mt-5 w-fit" variant="secondary" disabled={plan.plan === "free"}>
                    {plan.plan === "free" ? "Included" : "Upgrade via Dodo"}
                  </Button>
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

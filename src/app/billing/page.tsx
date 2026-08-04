"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/primitives";

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

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/billing");
      if (res.ok) setData(await res.json());
    })();
  }, []);

  return (
    <AppShell title="Billing">
      <p className="mb-6 max-w-xl text-sm text-[var(--fg-muted)]">
        You buy SEO Action credits — not model tokens. Free includes one repository, analysis, audit, limited keywords, one brief, and one sample pull request.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.plans ?? []).map((plan) => (
          <div
            key={plan.plan}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
          >
            <h2 className="text-lg font-medium capitalize">{plan.plan}</h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">
              {plan.credits === 0 ? "Entitlement pack" : `${plan.credits} SEO Actions / month`}
            </p>
            {data?.subscription?.plan === plan.plan ? (
              <p className="mt-4 text-xs text-[var(--accent)]">Current plan · {data.subscription.status}</p>
            ) : (
              <Button className="mt-4" variant="secondary" disabled={plan.plan === "free"}>
                {plan.plan === "free" ? "Included" : "Upgrade via Dodo"}
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 text-sm text-[var(--fg-muted)]">
        <p>Credits remaining: {data?.credits?.balance ?? 0}</p>
        <p>Sample PR used: {data?.entitlement?.samplePrUsed ? "yes" : "no"}</p>
        {data?.portalUrl ? (
          <a className="mt-2 inline-block text-[var(--accent)]" href={data.portalUrl}>
            Customer portal
          </a>
        ) : null}
      </div>
    </AppShell>
  );
}

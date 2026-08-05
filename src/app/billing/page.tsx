import { Suspense } from "react";
import BillingPageClient from "./billing-page-client";

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[var(--fg-muted)]">Loading billing…</div>
      }
    >
      <BillingPageClient />
    </Suspense>
  );
}

import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth";
import BillingPageClient from "./billing-page-client";

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin?callbackURL=/billing");
  }

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

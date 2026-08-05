import { Suspense } from "react";
import SignInPageClient from "./signin-page-client";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--fg-muted)]">Loading…</div>}>
      <SignInPageClient />
    </Suspense>
  );
}

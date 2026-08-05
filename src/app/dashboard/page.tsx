import { Suspense } from "react";
import DashboardPageClient from "./dashboard-page-client";
import { AppShell } from "@/components/dashboard/app-shell";
import { OverviewSkeleton } from "@/components/dashboard/overview-skeleton";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Overview">
          <OverviewSkeleton />
        </AppShell>
      }
    >
      <DashboardPageClient />
    </Suspense>
  );
}

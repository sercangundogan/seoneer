import { Skeleton } from "@/components/ui/primitives";

function AgentStatusSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
      aria-hidden
    >
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-4 w-[70%] max-w-xl" />
    </div>
  );
}

function AttentionSkeleton() {
  return (
    <section aria-hidden>
      <Skeleton className="h-4 w-28" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-[52px] w-full rounded-[var(--radius)]" />
      </div>
    </section>
  );
}

function ProjectsSkeleton() {
  return (
    <section aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-[72px] w-full rounded-[var(--radius)]" />
        <Skeleton className="h-[72px] w-full rounded-[var(--radius)]" />
      </div>
    </section>
  );
}

export function OverviewSkeleton() {
  return (
    <>
      <AgentStatusSkeleton />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <AttentionSkeleton />
        <ProjectsSkeleton />
      </div>
    </>
  );
}

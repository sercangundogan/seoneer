import { Skeleton } from "@/components/ui/primitives";

function AgentStatusSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
      aria-hidden
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-4 h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-3 h-4 w-[70%] max-w-xl" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}

function SectionHeadingSkeleton({ width = "w-28" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width}`} />;
}

function ListItemSkeleton({ height = "h-[52px]" }: { height?: string }) {
  return <Skeleton className={`${height} w-full rounded-[var(--radius)]`} />;
}

export function ProjectSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading project…</span>
      <AgentStatusSkeleton />

      <section className="mt-6 max-w-xl" aria-hidden>
        <div className="flex flex-wrap items-center gap-2">
          <SectionHeadingSkeleton width="w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
        <Skeleton className="mt-3 h-10 w-44" />
      </section>

      <section className="mt-8 max-w-xl" aria-hidden>
        <SectionHeadingSkeleton width="w-28" />
        <Skeleton className="mt-1 h-4 w-64" />
        <div className="mt-4 space-y-3">
          <ListItemSkeleton height="h-14" />
          <ListItemSkeleton height="h-14" />
          <ListItemSkeleton height="h-14" />
        </div>
        <Skeleton className="mt-4 h-10 w-36" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2" aria-hidden>
        <section>
          <SectionHeadingSkeleton width="w-28" />
          <div className="mt-3 space-y-2">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        </section>
        <section>
          <SectionHeadingSkeleton width="w-32" />
          <div className="mt-3 space-y-2">
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2" aria-hidden>
        <section>
          <SectionHeadingSkeleton width="w-32" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </section>
        <section>
          <SectionHeadingSkeleton width="w-28" />
          <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        </section>
      </div>
    </div>
  );
}

import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/primitives";
import Link from "next/link";

async function getProjects() {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    // Client-side fetch preferred; for SSR without cookies in build, return empty
    void base;
    return [] as { id: string; name: string; agentStatus: string | null; agentStatusDetail: string | null }[];
  } catch {
    return [];
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ merged?: string }>;
}) {
  const params = await searchParams;
  const projects = await getProjects();

  return (
    <AppShell title="Overview">
      {params.merged ? (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--success)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--success)]">
          Pull request approved and merge requested.
        </div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">Agent status</p>
            <p className="mt-2 text-xl font-medium">
              {projects[0]?.agentStatus ? (
                <span className="animate-status">{projects[0].agentStatus}</span>
              ) : (
                "Idle — connect a repository to begin"
              )}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">
              {projects[0]?.agentStatusDetail ??
                "Seoneer answers: what it is doing, why, what needs attention, and what impact followed."}
            </p>
          </div>
          <Badge tone="accent">Ops</Badge>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Needs attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
              Complete onboarding to generate your Project Intelligence Profile.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Projects</h2>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? (
              <Link
                href="/onboarding"
                className="block rounded-[var(--radius)] border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                Start onboarding →
              </Link>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm hover:border-[var(--accent)]"
                >
                  {p.name}
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

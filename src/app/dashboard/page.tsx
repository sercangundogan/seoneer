import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth";
import { resolvePostAuthPath } from "@/modules/workspaces/post-auth";
import { listProjectsForUser } from "@/modules/projects/service";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/primitives";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ merged?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin");
  }

  const destination = await resolvePostAuthPath(session.user.id);
  if (destination === "/onboarding") {
    redirect("/onboarding");
  }

  const params = await searchParams;
  const projects = await listProjectsForUser(session.user.id);
  const primary = projects[0];

  const attention: string[] = [];
  if (primary?.agentStatus === "awaiting_approval") {
    attention.push(primary.agentStatusDetail ?? "An SEO update is waiting for your approval.");
  }
  if (primary?.agentStatus === "needs_input") {
    attention.push(primary.agentStatusDetail ?? "The agent needs more product information.");
  }
  if (primary?.agentStatus === "blocked") {
    attention.push(primary.agentStatusDetail ?? "Action cycle is blocked — check billing or setup.");
  }

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
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              What is the agent doing?
            </p>
            <p className="mt-2 text-xl font-medium">
              {primary?.agentStatus && primary.agentStatus !== "idle" ? (
                <span className="animate-status">{primary.agentStatus}</span>
              ) : (
                primary?.agentStatus ?? "Idle"
              )}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">
              {primary?.agentStatusDetail ??
                "Ready for the next highest-value SEO action."}
            </p>
          </div>
          <Badge tone="accent">Ops</Badge>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Needs attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {attention.length === 0 ? (
              <li className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-[var(--fg-muted)]">
                Nothing waiting right now.
              </li>
            ) : (
              attention.map((item) => (
                <li
                  key={item}
                  className="rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--bg-elevated)] px-4 py-3"
                >
                  {item}
                </li>
              ))
            )}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Projects</h2>
          <div className="mt-3 space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm hover:border-[var(--accent)]"
              >
                <span className="font-medium">{p.name}</span>
                <span className="mt-1 block text-xs text-[var(--fg-muted)]">
                  {p.status}
                  {p.agentStatus ? ` · ${p.agentStatus}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

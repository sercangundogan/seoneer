import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/modules/auth";
import { resolvePostAuthPath } from "@/modules/workspaces/post-auth";
import { listProjectsWithReposForUser } from "@/modules/projects/service";
import { getBillingState } from "@/modules/billing/service";
import { AppShell } from "@/components/dashboard/app-shell";
import { AgentStatusPanel } from "@/components/dashboard/agent-status-panel";
import {
  AutomationUpsell,
  shouldShowAutomationUpsell,
} from "@/components/dashboard/automation-upsell";
import { ProjectsList } from "@/components/dashboard/projects-list";
import { isExternalHref, resolveAgentStatusCta } from "@/lib/agent-status";

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
  const projects = await listProjectsWithReposForUser(session.user.id);
  const primary = projects[0];
  const billing = primary ? await getBillingState(primary.workspaceId) : null;
  const showUpsell = shouldShowAutomationUpsell({
    plan: billing?.subscription?.plan,
    samplePrUsed: billing?.entitlement?.samplePrUsed,
    agentStatus: primary?.agentStatus,
  });

  const attention: { text: string; href?: string; cta?: string }[] = [];
  if (primary?.agentStatus === "awaiting_approval") {
    attention.push({
      text: primary.agentStatusDetail ?? "An SEO update is waiting for your approval.",
      href: primary.latestReviewUrl ?? `/projects/${primary.id}`,
      cta: "Review update",
    });
  }
  if (primary?.agentStatus === "needs_input") {
    attention.push({
      text: primary.agentStatusDetail ?? "The agent needs more product information.",
      href: `/projects/${primary.id}`,
      cta: "Provide details",
    });
  }
  if (primary?.agentStatus === "blocked") {
    const cta = resolveAgentStatusCta({
      status: "blocked",
      detail: primary.agentStatusDetail,
      projectId: primary.id,
    });
    attention.push({
      text: primary.agentStatusDetail ?? "Action cycle is blocked — check billing or setup.",
      href: cta?.href,
      cta: cta?.label,
    });
  }
  if (primary?.agentStatus === "error") {
    attention.push({
      text: primary.agentStatusDetail ?? "The last agent run failed.",
      href: `/projects/${primary.id}`,
      cta: "Open project",
    });
  }

  return (
    <AppShell title="Overview">
      {params.merged ? (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--success)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--success)]">
          Pull request approved and merge requested.
        </div>
      ) : null}

      <AgentStatusPanel
        status={primary?.agentStatus}
        detail={primary?.agentStatusDetail}
        projectId={primary?.id}
        reviewUrl={primary?.latestReviewUrl}
      />

      {showUpsell ? <AutomationUpsell className="mt-6" /> : null}

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
                  key={item.text}
                  className="animate-cta-in rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <p>{item.text}</p>
                  {item.href && item.cta ? (
                    isExternalHref(item.href) ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        {item.cta} →
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        {item.cta} →
                      </Link>
                    )
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <ProjectsList
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            agentStatus: p.agentStatus,
            repository: p.repository,
          }))}
        />
      </div>
    </AppShell>
  );
}

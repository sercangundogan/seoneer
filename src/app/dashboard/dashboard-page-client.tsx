"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { AgentStatusPanel } from "@/components/dashboard/agent-status-panel";
import {
  AutomationUpsell,
  shouldShowAutomationUpsell,
} from "@/components/dashboard/automation-upsell";
import { OverviewSkeleton } from "@/components/dashboard/overview-skeleton";
import { ProjectsList } from "@/components/dashboard/projects-list";
import { isExternalHref, isAwaitingPullRequestReview, resolveAgentStatusCta } from "@/lib/agent-status";

type Project = {
  id: string;
  name: string;
  status: string;
  primarySeoGoal?: string | null;
  agentStatus: string | null;
  agentStatusDetail?: string | null;
  latestReviewUrl?: string | null;
  latestPullRequestMergeStatus?: string | null;
  repository?: { fullName: string; htmlUrl: string } | null;
};

type Billing = {
  subscription?: { plan: string; status: string };
  entitlement?: { samplePrUsed: boolean };
};

function buildAttention(primary: Project | undefined, plan?: string | null) {
  const attention: { text: string; href?: string; cta?: string }[] = [];
  if (!primary) return attention;

  if (
    isAwaitingPullRequestReview({
      agentStatus: primary.agentStatus,
      mergeStatus: primary.latestPullRequestMergeStatus,
    })
  ) {
    attention.push({
      text: primary.agentStatusDetail ?? "An SEO update is waiting for your approval.",
      href: primary.latestReviewUrl ?? `/projects/${primary.id}`,
      cta: "Review update",
    });
  }
  if (primary.agentStatus === "needs_input") {
    attention.push({
      text: primary.agentStatusDetail ?? "The agent needs more product information.",
      href: `/projects/${primary.id}`,
      cta: "Provide details",
    });
  }
  if (primary.agentStatus === "blocked") {
    const cta = resolveAgentStatusCta({
      status: "blocked",
      detail: primary.agentStatusDetail,
      projectId: primary.id,
      plan,
    });
    attention.push({
      text: primary.agentStatusDetail ?? "Action cycle is blocked — check billing or setup.",
      href: cta?.href,
      cta: cta?.label,
    });
  }
  if (primary.agentStatus === "error") {
    attention.push({
      text: primary.agentStatusDetail ?? "The last agent run failed.",
      href: `/projects/${primary.id}`,
      cta: "Open project",
    });
  }

  return attention;
}

export default function DashboardPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [projectsRes, billingRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/billing"),
        ]);

        if (projectsRes.status === 401 || billingRes.status === 401) {
          router.replace("/signin");
          return;
        }

        if (projectsRes.ok) {
          const body = await projectsRes.json();
          const list: Project[] = body.projects ?? [];
          const onboardingDone = list.some((p) => Boolean(p.primarySeoGoal));
          if (!onboardingDone) {
            router.replace("/onboarding");
            return;
          }
          setProjects(list);
        }

        if (billingRes.ok) {
          setBilling(await billingRes.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const primary = projects?.[0];
  const awaitingPullRequestReview = isAwaitingPullRequestReview({
    agentStatus: primary?.agentStatus,
    mergeStatus: primary?.latestPullRequestMergeStatus,
  });

  useEffect(() => {
    if (!awaitingPullRequestReview) return;
    const interval = window.setInterval(() => {
      void fetch("/api/projects")
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.projects) setProjects(body.projects);
        });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [awaitingPullRequestReview]);
  const showUpsell = shouldShowAutomationUpsell({
    plan: billing?.subscription?.plan,
    samplePrUsed: billing?.entitlement?.samplePrUsed,
    agentStatus: primary?.agentStatus,
  });
  const attention = buildAttention(primary, billing?.subscription?.plan);
  const merged = searchParams.get("merged");

  return (
    <AppShell title="Overview">
      {merged ? (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--success)]/30 bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--success)]">
          Pull request approved and merge requested.
        </div>
      ) : null}

      {loading ? (
        <div aria-busy aria-label="Loading overview">
          <OverviewSkeleton />
        </div>
      ) : (
        <div className="animate-fade-up">
          <AgentStatusPanel
            status={
              awaitingPullRequestReview ? "awaiting_approval" : primary?.agentStatus
            }
            detail={primary?.agentStatusDetail}
            projectId={primary?.id}
            reviewUrl={primary?.latestReviewUrl}
            plan={billing?.subscription?.plan}
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
              projects={(projects ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                agentStatus: p.agentStatus,
                repository: p.repository,
              }))}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

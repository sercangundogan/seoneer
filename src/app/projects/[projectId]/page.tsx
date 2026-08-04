"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { AgentStatusPanel } from "@/components/dashboard/agent-status-panel";
import { Badge, Button } from "@/components/ui/primitives";
import { isAgentWorking } from "@/lib/agent-status";

type ProjectPayload = {
  project: {
    id: string;
    name: string;
    agentStatus: string | null;
    agentStatusDetail: string | null;
    primarySeoGoal: string | null;
    publicationMode: string;
    recommendedCadence: { label?: string; rationale?: string } | null;
  };
  intelligence?: { profile: { product: { summary: string }; decisionSummary: string } };
  audit?: { findings: { technical?: string[]; opportunities?: string[] } };
  roadmap?: { items: { priority: number; title: string; actionType: string; reason: string }[] };
  actions?: {
    id: string;
    actionType: string;
    status: string;
    decisionSummary: string | null;
  }[];
  logs?: { id: string; summary: string; createdAt: string; action: string }[];
  billing?: { entitlement?: { samplePrUsed: boolean }; credits?: { balance: number } | null };
};

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [forcePoll, setForcePoll] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.projectId}`);
    if (res.ok) setData(await res.json());
  }, [params.projectId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/projects/${params.projectId}`);
      if (!cancelled && res.ok) setData(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [params.projectId]);

  // Poll while working, or briefly after the user starts a cycle
  const working = isAgentWorking(data?.project?.agentStatus) || forcePoll;
  useEffect(() => {
    if (!working) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [working, refresh]);

  // Stop forced polling once the agent settles on a non-working status
  useEffect(() => {
    if (!forcePoll) return;
    const status = data?.project?.agentStatus;
    if (status && !isAgentWorking(status)) {
      setForcePoll(false);
    }
  }, [data?.project?.agentStatus, forcePoll]);

  // Safety: don't poll forever if the job never settles
  useEffect(() => {
    if (!forcePoll) return;
    const timeout = window.setTimeout(() => setForcePoll(false), 180_000);
    return () => window.clearTimeout(timeout);
  }, [forcePoll]);

  async function runCycle() {
    setBusy(true);
    setForcePoll(true);
    // Optimistic UI so status updates immediately
    setData((prev) =>
      prev
        ? {
            ...prev,
            project: {
              ...prev.project,
              agentStatus: "selecting_action",
              agentStatusDetail: "Starting SEO action cycle…",
            },
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/projects/${params.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runActionCycle: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForcePoll(false);
        throw new Error(body.error ?? "Failed to start SEO action");
      }
      await refresh();
    } catch (e) {
      setForcePoll(false);
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                agentStatusDetail:
                  e instanceof Error ? e.message : "Failed to start SEO action",
              },
            }
          : prev,
      );
    } finally {
      setBusy(false);
    }
  }

  async function connectGsc() {
    const res = await fetch("/api/gsc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: params.projectId }),
    });
    if (res.ok) await refresh();
  }

  if (!data?.project) {
    return (
      <AppShell title="Project">
        <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
      </AppShell>
    );
  }

  const { project, intelligence, audit, roadmap, actions, logs, billing } = data;
  const blocked = project.agentStatus === "blocked";

  return (
    <AppShell title={project.name}>
      <AgentStatusPanel
        status={project.agentStatus}
        detail={project.agentStatusDetail}
        fallbackDetail={intelligence?.profile.decisionSummary}
        projectId={project.id}
        actions={
          <>
            <Button variant="secondary" onClick={() => void connectGsc()} disabled={busy}>
              Connect GSC
            </Button>
            <Button
              onClick={() => void runCycle()}
              loading={busy}
              disabled={blocked}
              title={blocked ? project.agentStatusDetail ?? "Agent is blocked" : undefined}
            >
              Run SEO action
            </Button>
          </>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Why / roadmap</h2>
          <ul className="mt-3 space-y-2">
            {(roadmap?.items ?? []).slice(0, 6).map((item) => (
              <li
                key={`${item.priority}-${item.title}`}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge>{item.actionType}</Badge>
                  <span>{item.title}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--fg-muted)]">{item.reason}</p>
              </li>
            ))}
            {!roadmap?.items?.length ? (
              <li className="text-sm text-[var(--fg-muted)]">Roadmap will appear after the initial audit.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Needs attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(actions ?? [])
              .filter((a) => a.status === "awaiting_approval")
              .map((a) => (
                <li
                  key={a.id}
                  className="rounded-[var(--radius)] border border-[var(--warning)]/30 bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <Badge tone="warning">{a.actionType}</Badge>
                  <p className="mt-1">{a.decisionSummary}</p>
                </li>
              ))}
            {(audit?.findings?.technical ?? []).slice(0, 3).map((t) => (
              <li key={t} className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-3">
                {t}
              </li>
            ))}
            {!actions?.some((a) => a.status === "awaiting_approval") &&
            !(audit?.findings?.technical?.length ?? 0) ? (
              <li className="text-[var(--fg-muted)]">Nothing waiting right now.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Recent activity</h2>
          <ul className="mt-3 space-y-2">
            {(logs ?? []).slice(0, 8).map((log) => (
              <li key={log.id} className="border-b border-[var(--border)] py-2 text-sm">
                <span className="text-xs text-[var(--fg-muted)]">{log.action}</span>
                <p>{log.summary}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-[var(--fg-muted)]">Impact & credits</h2>
          <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm">
            <p>
              Cadence: <strong>{project.recommendedCadence?.label ?? "Pending"}</strong>
            </p>
            <p className="text-[var(--fg-muted)]">{project.recommendedCadence?.rationale}</p>
            <p>Free sample PR used: {billing?.entitlement?.samplePrUsed ? "yes" : "no"}</p>
            <p>Credits: {billing?.credits?.balance ?? 0}</p>
            <p className="text-[var(--fg-muted)]">
              Goal: {project.primarySeoGoal ?? "—"} · Changes ship as PRs for your review
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

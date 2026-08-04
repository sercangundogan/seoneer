"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge, Button } from "@/components/ui/primitives";

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

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.projectId}`);
    if (res.ok) setData(await res.json());
  }, [params.projectId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/projects/${params.projectId}`);
      if (!cancelled && res.ok) setData(await res.json());
    };
    const handle = window.setTimeout(() => {
      void tick();
    }, 0);
    const interval = window.setInterval(() => {
      void tick();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      window.clearInterval(interval);
    };
  }, [params.projectId]);

  async function runCycle() {
    setBusy(true);
    try {
      await fetch(`/api/projects/${params.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runActionCycle: true }),
      });
      await refresh();
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

  return (
    <AppShell title={project.name}>
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">What is the agent doing?</p>
            <p className="mt-2 text-xl font-medium">
              <span className={project.agentStatus && project.agentStatus !== "idle" ? "animate-status" : ""}>
                {project.agentStatus ?? "idle"}
              </span>
            </p>
            <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">
              {project.agentStatusDetail ?? intelligence?.profile.decisionSummary ?? "Waiting for the next cycle."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void connectGsc()}>
              Connect GSC
            </Button>
            <Button onClick={() => void runCycle()} loading={busy}>
              Run SEO action
            </Button>
          </div>
        </div>
      </section>

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
              Goal: {project.primarySeoGoal ?? "—"} · Mode: {project.publicationMode}
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

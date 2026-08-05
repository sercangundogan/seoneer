"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { AgentStatusPanel } from "@/components/dashboard/agent-status-panel";
import {
  AutomationUpsell,
  shouldShowAutomationUpsell,
} from "@/components/dashboard/automation-upsell";
import { ProjectSkeleton } from "@/components/dashboard/project-skeleton";
import {
  SearchConsolePanel,
  type GscConnectionInfo,
} from "@/components/dashboard/search-console-panel";
import { WorkProgramsEditor } from "@/components/work-programs/work-programs-editor";
import { Badge, Button } from "@/components/ui/primitives";
import { isAgentWorking, isAwaitingPullRequestReview } from "@/lib/agent-status";
import {
  defaultWorkProgramInputs,
  type PeriodDays,
  type WorkProgramInput,
  type WorkProgramKey,
} from "@/modules/work-programs/catalog";

type WorkProgramApiRow = {
  programKey: WorkProgramKey;
  enabled: boolean;
  periodDays: PeriodDays;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
};

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
  billing?: {
    entitlement?: { samplePrUsed: boolean };
    credits?: { balance: number } | null;
    subscription?: { plan: string } | null;
  };
  workPrograms?: WorkProgramApiRow[];
  gsc?: GscConnectionInfo;
  latestPullRequest?: {
    id: string;
    prNumber: number | null;
    prUrl: string | null;
    branch: string;
    mergeStatus: string;
  } | null;
};

function toInputs(rows: WorkProgramApiRow[] | undefined): WorkProgramInput[] {
  if (!rows?.length) return defaultWorkProgramInputs();
  const byKey = new Map(rows.map((r) => [r.programKey, r]));
  return defaultWorkProgramInputs().map((def) => {
    const row = byKey.get(def.programKey);
    return row
      ? {
          programKey: row.programKey,
          enabled: row.enabled,
          periodDays: row.periodDays,
        }
      : def;
  });
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Project">
          <ProjectSkeleton />
        </AppShell>
      }
    >
      <ProjectPageInner />
    </Suspense>
  );
}

function ProjectPageInner() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [forcePoll, setForcePoll] = useState(() => searchParams.get("live") === "1");
  const [programDraft, setProgramDraft] = useState<WorkProgramInput[]>(defaultWorkProgramInputs());
  const [savingPrograms, setSavingPrograms] = useState(false);
  const [programMessage, setProgramMessage] = useState("");
  const [runningProgramKey, setRunningProgramKey] = useState<WorkProgramKey | null>(null);
  const [gscJustConnected, setGscJustConnected] = useState(
    () => searchParams.get("gsc") === "connected",
  );
  const [gscNeedsSelect, setGscNeedsSelect] = useState(
    () => searchParams.get("gsc") === "select",
  );
  const [gscNoSites, setGscNoSites] = useState(() => searchParams.get("gsc") === "no_sites");
  const [gscError, setGscError] = useState(() => {
    if (searchParams.get("gsc") !== "error") return "";
    return searchParams.get("reason") ?? "Search Console connect failed";
  });
  const programsDirtyRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.projectId}`);
    if (res.ok) {
      const body = (await res.json()) as ProjectPayload;
      setData(body);
      // Don't wipe in-progress edits while status polling
      if (!programsDirtyRef.current) {
        setProgramDraft(toInputs(body.workPrograms));
      }
    }
  }, [params.projectId]);

  // Arrive from onboarding with ?live=1 → keep polling until the agent settles
  // Arrive from GSC OAuth with ?gsc=…
  useEffect(() => {
    const live = searchParams.get("live") === "1";
    const gsc = searchParams.get("gsc");
    if (!live && !gsc) return;
    if (live) setForcePoll(true);
    if (gsc === "connected") setGscJustConnected(true);
    if (gsc === "select") setGscNeedsSelect(true);
    if (gsc === "no_sites") setGscNoSites(true);
    if (gsc === "error") {
      setGscError(searchParams.get("reason") ?? "Search Console connect failed");
    }
    router.replace(`/projects/${params.projectId}`, { scroll: false });
  }, [searchParams, params.projectId, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/projects/${params.projectId}`);
      if (!cancelled && res.ok) {
        const body = (await res.json()) as ProjectPayload;
        setData(body);
        setProgramDraft(toInputs(body.workPrograms));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.projectId]);

  const working = isAgentWorking(data?.project?.agentStatus) || forcePoll;
  const awaitingPullRequestReview = isAwaitingPullRequestReview({
    agentStatus: data?.project?.agentStatus,
    mergeStatus: data?.latestPullRequest?.mergeStatus,
  });
  const shouldPoll = working || awaitingPullRequestReview;

  useEffect(() => {
    if (!shouldPoll) return;
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [shouldPoll, refresh]);

  useEffect(() => {
    if (!forcePoll) return;
    const status = data?.project?.agentStatus;
    const stillAwaiting = isAwaitingPullRequestReview({
      agentStatus: status,
      mergeStatus: data?.latestPullRequest?.mergeStatus,
    });
    if (status && !isAgentWorking(status) && !stillAwaiting) {
      setForcePoll(false);
      setRunningProgramKey(null);
    }
  }, [data?.project?.agentStatus, data?.latestPullRequest?.mergeStatus, forcePoll]);

  useEffect(() => {
    if (!forcePoll) return;
    const timeout = window.setTimeout(() => {
      setForcePoll(false);
      setRunningProgramKey(null);
    }, 240_000);
    return () => window.clearTimeout(timeout);
  }, [forcePoll]);

  const programsDirty = useMemo(() => {
    const saved = toInputs(data?.workPrograms);
    return JSON.stringify(saved) !== JSON.stringify(programDraft);
  }, [data?.workPrograms, programDraft]);

  useEffect(() => {
    programsDirtyRef.current = programsDirty;
  }, [programsDirty]);

  async function savePrograms() {
    if (!programsDirty || savingPrograms) return;
    if (!programDraft.some((p) => p.enabled)) {
      setProgramMessage("Select at least one program.");
      return;
    }
    setSavingPrograms(true);
    setProgramMessage("");
    try {
      const res = await fetch(`/api/projects/${params.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workPrograms: programDraft }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save programs");
      await refresh();
      setProgramMessage("Saved.");
    } catch (e) {
      setProgramMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingPrograms(false);
    }
  }

  async function runCycle(preferProgramKey?: WorkProgramKey) {
    if (busy || forcePoll || isAgentWorking(data?.project?.agentStatus)) return;
    if (preferProgramKey && programsDirty) {
      setProgramMessage("Save your program changes before running.");
      return;
    }
    setBusy(true);
    setForcePoll(true);
    setRunningProgramKey(preferProgramKey ?? null);
    setProgramMessage("");
    setData((prev) =>
      prev
        ? {
            ...prev,
            project: {
              ...prev.project,
              agentStatus: "selecting_action",
              agentStatusDetail: preferProgramKey
                ? "Starting work program…"
                : "Starting SEO action cycle…",
            },
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/projects/${params.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          preferProgramKey
            ? { runWorkProgram: preferProgramKey }
            : { runActionCycle: true },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForcePoll(false);
        throw new Error(body.error ?? "Failed to start SEO action");
      }
      await refresh();
    } catch (e) {
      setForcePoll(false);
      setRunningProgramKey(null);
      const message = e instanceof Error ? e.message : "Failed to start SEO action";
      setProgramMessage(message);
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                agentStatusDetail: message,
              },
            }
          : prev,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!data?.project) {
    return (
      <AppShell title="Project">
        <ProjectSkeleton />
      </AppShell>
    );
  }

  const {
    project,
    intelligence,
    audit,
    roadmap,
    actions,
    logs,
    billing,
    latestPullRequest,
    gsc,
  } = data;
  const blocked = project.agentStatus === "blocked";
  const cycleRunning = busy || forcePoll || isAgentWorking(project.agentStatus);
  const awaitingApproval = isAwaitingPullRequestReview({
    agentStatus: project.agentStatus,
    mergeStatus: latestPullRequest?.mergeStatus,
  });
  const runDisabled = blocked || cycleRunning || awaitingApproval;
  const reviewUrl = latestPullRequest?.prUrl ?? null;
  const showUpsell = shouldShowAutomationUpsell({
    plan: billing?.subscription?.plan,
    samplePrUsed: billing?.entitlement?.samplePrUsed,
    agentStatus: project.agentStatus,
  });

  return (
    <AppShell title={project.name}>
      <AgentStatusPanel
        status={awaitingApproval ? "awaiting_approval" : project.agentStatus}
        detail={project.agentStatusDetail}
        fallbackDetail={intelligence?.profile.decisionSummary}
        projectId={project.id}
        reviewUrl={reviewUrl}
        actions={
          <Button
            onClick={() => void runCycle()}
            loading={cycleRunning}
            disabled={runDisabled}
            title={
              blocked
                ? (project.agentStatusDetail ?? "Agent is blocked")
                : awaitingApproval
                  ? "Approve the pending update before starting another action"
                  : cycleRunning
                    ? "SEO action in progress"
                    : undefined
            }
          >
            {cycleRunning ? "Running…" : "Run SEO action"}
          </Button>
        }
      />

      {showUpsell ? <AutomationUpsell className="mt-6" /> : null}

      <SearchConsolePanel
        projectId={project.id}
        gsc={gsc}
        disabled={cycleRunning}
        justConnected={gscJustConnected}
        needsSiteSelect={gscNeedsSelect}
        noSites={gscNoSites}
        connectError={gscError}
        onConnected={async () => {
          setGscNeedsSelect(false);
          setGscNoSites(false);
          setGscError("");
          setGscJustConnected(true);
          await refresh();
        }}
      />

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Work programs</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Choose what Seoneer should do and how often — or run any enabled program now.
        </p>
        <div className="mt-4">
          <WorkProgramsEditor
            value={programDraft}
            onChange={setProgramDraft}
            disabled={savingPrograms || cycleRunning}
            schedule={Object.fromEntries(
              (data.workPrograms ?? []).map((row) => [
                row.programKey,
                { nextRunAt: row.nextRunAt ?? null, lastRunAt: row.lastRunAt ?? null },
              ]),
            )}
            onRunNow={(key) => void runCycle(key)}
            runNowDisabled={runDisabled || programsDirty}
            runningProgramKey={runningProgramKey}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void savePrograms()}
            loading={savingPrograms}
            disabled={!programsDirty || !programDraft.some((p) => p.enabled)}
          >
            Save programs
          </Button>
          {programsDirty && !programMessage ? (
            <span className="text-sm text-[var(--fg-muted)]">
              Save changes to enable Run now.
            </span>
          ) : null}
          {programMessage ? (
            <span className="text-sm text-[var(--fg-muted)]">{programMessage}</span>
          ) : null}
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
              <li className="text-sm text-[var(--fg-muted)]">
                Roadmap will appear after the initial audit.
              </li>
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
              Focus: {project.primarySeoGoal ?? "—"} · Changes ship as PRs for your review
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button, Input, Textarea, Badge, Skeleton } from "@/components/ui/primitives";

type Installation = { id: string; installationId: number; accountLogin: string };
type Repo = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
};

const GOALS = [
  "Grow organic signups",
  "Educate users about the product",
  "Technical SEO hygiene",
];

const MODES = [
  { id: "review_all", label: "Review every change" },
  { id: "one_click", label: "One-click email approval" },
  { id: "auto_safe", label: "Auto-merge safe changes" },
] as const;

function OnboardingSkeleton() {
  return (
    <section className="max-w-xl space-y-4" aria-busy aria-label="Loading onboarding">
      <Skeleton className="h-4 w-3/4 max-w-md" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <div className="flex flex-wrap gap-2 pt-1">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-52" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-48" />
      </div>
    </section>
  );
}

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [booting, setBooting] = useState(true);
  const [installUrl, setInstallUrl] = useState("");
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [productName, setProductName] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("review_all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");

  const selectedInstallationMeta = useMemo(
    () => installations.find((i) => i.id === selectedInstallation),
    [installations, selectedInstallation],
  );

  const applyInstallations = useCallback((items: Installation[]) => {
    setInstallations(items);
    if (items[0]) setSelectedInstallation(items[0].id);
  }, []);

  const loadReposForInstallation = useCallback(async (githubInstallationId: number) => {
    const res = await fetch(`/api/github/installations?installation_id=${githubInstallationId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Could not load repositories");
    }
    if (data.installation) {
      setInstallations((prev) => {
        const exists = prev.some((i) => i.id === data.installation.id);
        return exists ? prev : [...prev, data.installation];
      });
      setSelectedInstallation(data.installation.id);
    }
    const nextRepos = (data.repos ?? []) as Repo[];
    setRepos(nextRepos);
    // Auto-select when there is only one repository
    setSelectedRepo(nextRepos.length === 1 ? nextRepos[0] : null);
    if (data.warning) setMessage(data.warning);
    setStep(2);
  }, []);

  const syncInstallations = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/github/installations?sync=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setInstallUrl(data.installUrl ?? "");
      applyInstallations(data.installations ?? []);
      if ((data.installations?.length ?? 0) === 0) {
        setMessage(
          "No GitHub App installations found yet. Install the app, then click “I’ve already installed — sync”.",
        );
        return;
      }
      if (data.installations.length === 1) {
        await loadReposForInstallation(data.installations[0].installationId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sync installations");
    } finally {
      setBusy(false);
    }
  }, [applyInstallations, loadReposForInstallation]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const installationId = params.get("installation_id");

      try {
        if (installationId) {
          setBusy(true);
          setMessage("");
          try {
            await fetch("/api/github/installations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ installationId: Number(installationId) }),
            });
            if (cancelled) return;
            await loadReposForInstallation(Number(installationId));
            window.history.replaceState({}, "", "/onboarding");
          } catch (error) {
            if (!cancelled) {
              setMessage(error instanceof Error ? error.message : "Install callback failed");
            }
          } finally {
            if (!cancelled) setBusy(false);
          }
          return;
        }

        const res = await fetch("/api/github/installations");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setInstallUrl(data.installUrl);
        applyInstallations(data.installations ?? []);

        if ((data.installations?.length ?? 0) === 0) {
          await syncInstallations();
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount (callback + sync recovery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRepos() {
    if (!selectedInstallationMeta) return;
    setBusy(true);
    setMessage("");
    try {
      await loadReposForInstallation(selectedInstallationMeta.installationId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load repositories");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (!selectedRepo || !selectedInstallation || busy) return;
    setBusy(true);
    setMessage("");
    setAnalysisStatus("Creating project…");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedRepo.name,
          installationRowId: selectedInstallation,
          owner: selectedRepo.owner,
          repoName: selectedRepo.name,
          fullName: selectedRepo.fullName,
          defaultBranch: selectedRepo.defaultBranch,
          htmlUrl: selectedRepo.htmlUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");

      const id = data.project.id as string;
      setProjectId(id);
      setProductName(selectedRepo.name);

      setAnalysisStatus("Starting repository analysis…");
      const start = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAnalysis: true }),
      });
      const startBody = await start.json();
      if (!start.ok) {
        throw new Error(startBody.error ?? "Failed to start analysis");
      }

      const maxAttempts = 45;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const detail = await fetch(`/api/projects/${id}`);
        const body = await detail.json();
        if (!detail.ok) {
          throw new Error(body.error ?? "Failed to load analysis status");
        }

        const status = body.project?.agentStatus as string | undefined;
        const detailText = body.project?.agentStatusDetail as string | undefined;
        setAnalysisStatus(detailText || status || "Analysing repository…");

        if (status === "error") {
          throw new Error(detailText || "Repository analysis failed");
        }

        const profile = body.intelligence?.profile;
        if (profile) {
          setSummary(profile.product?.summary ?? "");
          setProductName(profile.product?.name ?? selectedRepo.name);
          setAnalysisStatus("");
          setStep(3);
          return;
        }
      }

      throw new Error(
        "Analysis is taking longer than expected. Open Overview later, or go back and try again.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
      setAnalysisStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!projectId) return;
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primarySeoGoal: goal,
          publicationMode: mode,
          confirmIntelligence: { name: productName, summary },
          startAudit: true,
        }),
      });
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Onboarding">
      <ol className="mb-8 flex flex-wrap gap-2 text-xs text-[var(--fg-muted)]">
        {["GitHub", "Repository", "Summary", "Goal", "Control", "Analyse"].map((label, i) => (
          <li key={label}>
            <Badge tone={!booting && step === i + 1 ? "accent" : "neutral"}>
              {i + 1}. {label}
            </Badge>
          </li>
        ))}
      </ol>

      {message ? <p className="mb-4 text-sm text-[var(--danger)]">{message}</p> : null}

      {booting ? <OnboardingSkeleton /> : null}

      {!booting && step === 1 ? (
        <section className="max-w-xl space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            Install the Seoneer GitHub App with minimum permissions. Seoneer never writes to your
            default branch. After installing, GitHub should return you here automatically — if it
            does not, use sync below.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={installUrl || "https://github.com/apps/seoneer/installations/new"}>
              <Button type="button" disabled={busy}>
                Install GitHub App
              </Button>
            </a>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={() => void syncInstallations()}
            >
              I’ve already installed — sync
            </Button>
          </div>
          {installations.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm">Existing installation</label>
              <select
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                value={selectedInstallation}
                onChange={(e) => setSelectedInstallation(e.target.value)}
                disabled={busy}
              >
                {installations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.accountLogin} (#{i.installationId})
                  </option>
                ))}
              </select>
              <Button type="button" onClick={() => void loadRepos()} loading={busy}>
                Continue with this installation
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!booting && step === 2 ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">
            {repos.length === 1
              ? "Only one repository is available — it’s selected for you."
              : "Select a Next.js repository."}
          </p>
          {repos.length === 0 ? (
            <p className="text-sm">
              No repos returned. Make sure the GitHub App has access to the repository, then go back
              and sync again.
            </p>
          ) : (
            <ul className="space-y-2">
              {repos.map((repo) => (
                <li key={repo.fullName}>
                  <button
                    type="button"
                    disabled={busy}
                    className={`w-full rounded-[var(--radius)] border px-4 py-3 text-left text-sm disabled:opacity-50 ${
                      selectedRepo?.fullName === repo.fullName
                        ? "border-[var(--accent)] bg-[var(--bg-elevated)]"
                        : "border-[var(--border)]"
                    }`}
                    onClick={() => setSelectedRepo(repo)}
                  >
                    {repo.fullName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {analysisStatus ? (
            <p className="animate-status text-sm text-[var(--accent)]">{analysisStatus}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setMessage("");
                setAnalysisStatus("");
                setSelectedRepo(null);
                setRepos([]);
                setStep(1);
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void createProject()}
              disabled={!selectedRepo}
              loading={busy}
            >
              {busy ? "Analysing…" : "Analyse repository"}
            </Button>
          </div>
        </section>
      ) : null}

      {!booting && step === 3 ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">
            Review the generated product summary. Edit anything that looks wrong before continuing.
          </p>
          <label className="text-sm">Product name</label>
          <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
          <label className="text-sm">Product summary</label>
          <Textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
          {!summary.trim() ? (
            <p className="text-sm text-[var(--warning)]">
              Summary is empty — analysis may have returned little signal. Add a short description of
              what the product does.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(4)} disabled={!productName.trim()}>
              Confirm summary
            </Button>
          </div>
        </section>
      ) : null}

      {!booting && step === 4 ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">Primary SEO goal</p>
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              className={`block w-full rounded-[var(--radius)] border px-4 py-3 text-left text-sm ${
                goal === g ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
              onClick={() => setGoal(g)}
            >
              {g}
            </button>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(5)}>
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {!booting && step >= 5 ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">Control level</p>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`block w-full rounded-[var(--radius)] border px-4 py-3 text-left text-sm ${
                mode === m.id ? "border-[var(--accent)]" : "border-[var(--border)]"
              }`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button type="button" onClick={() => void finish()} loading={busy}>
              Start initial analysis
            </Button>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button, Input, Textarea, Badge } from "@/components/ui/primitives";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
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

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/github/installations");
      if (!res.ok) return;
      const data = await res.json();
      setInstallUrl(data.installUrl);
      setInstallations(data.installations ?? []);
      if (data.installations?.[0]) setSelectedInstallation(data.installations[0].id);
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id");
    if (!installationId) return;
    void (async () => {
      await fetch("/api/github/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: Number(installationId),
          accountLogin: "github-user",
          accountType: "User",
        }),
      });
      const res = await fetch(`/api/github/installations?installation_id=${installationId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.installation) {
        setInstallations((prev) => {
          const exists = prev.some((i) => i.id === data.installation.id);
          return exists ? prev : [...prev, data.installation];
        });
        setSelectedInstallation(data.installation.id);
      }
      setRepos(data.repos ?? []);
      setStep(2);
    })();
  }, []);

  const selectedInstallationMeta = useMemo(
    () => installations.find((i) => i.id === selectedInstallation),
    [installations, selectedInstallation],
  );

  async function loadRepos() {
    if (!selectedInstallationMeta) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/github/installations?installation_id=${selectedInstallationMeta.installationId}`,
      );
      const data = await res.json();
      setRepos(data.repos ?? []);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (!selectedRepo || !selectedInstallation) return;
    setBusy(true);
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
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setProjectId(data.project.id);
      setProductName(selectedRepo.name);
      setBusy(true);
      await fetch(`/api/projects/${data.project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAnalysis: true }),
      });
      // poll intelligence
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const detail = await fetch(`/api/projects/${data.project.id}`);
        const body = await detail.json();
        if (body.intelligence?.profile) {
          setSummary(body.intelligence.profile.product.summary ?? "");
          setProductName(body.intelligence.profile.product.name ?? selectedRepo.name);
          setStep(3);
          break;
        }
      }
      setStep(3);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
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
      router.push(`/projects/${projectId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Onboarding">
      <ol className="mb-8 flex flex-wrap gap-2 text-xs text-[var(--fg-muted)]">
        {["GitHub", "Repository", "Summary", "Goal", "Control", "Analyse"].map((label, i) => (
          <li key={label}>
            <Badge tone={step === i + 1 ? "accent" : "neutral"}>
              {i + 1}. {label}
            </Badge>
          </li>
        ))}
      </ol>

      {message ? <p className="mb-4 text-sm text-[var(--danger)]">{message}</p> : null}

      {step === 1 ? (
        <section className="max-w-xl space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            Install the Seoneer GitHub App with minimum permissions. Seoneer never writes to your default branch.
          </p>
          <a href={installUrl || "https://github.com/apps/seoneer/installations/new"}>
            <Button>Install GitHub App</Button>
          </a>
          {installations.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm">Existing installation</label>
              <select
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                value={selectedInstallation}
                onChange={(e) => setSelectedInstallation(e.target.value)}
              >
                {installations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.accountLogin} (#{i.installationId})
                  </option>
                ))}
              </select>
              <Button onClick={() => void loadRepos()} disabled={busy}>
                Continue
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="max-w-xl space-y-3">
          <p className="text-sm text-[var(--fg-muted)]">Select a Next.js repository.</p>
          {repos.length === 0 ? (
            <p className="text-sm">No repos returned. Configure the GitHub App or register the installation.</p>
          ) : (
            <ul className="space-y-2">
              {repos.map((repo) => (
                <li key={repo.fullName}>
                  <button
                    type="button"
                    className={`w-full rounded-[var(--radius)] border px-4 py-3 text-left text-sm ${
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
          <Button onClick={() => void createProject()} disabled={!selectedRepo || busy}>
            Analyse repository
          </Button>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="max-w-xl space-y-3">
          <label className="text-sm">Product name</label>
          <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
          <label className="text-sm">Product summary</label>
          <Textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
          <Button onClick={() => setStep(4)}>Confirm summary</Button>
        </section>
      ) : null}

      {step === 4 ? (
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
          <Button onClick={() => setStep(5)}>Continue</Button>
        </section>
      ) : null}

      {step >= 5 ? (
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
          <Button onClick={() => void finish()} disabled={busy}>
            Start initial analysis
          </Button>
        </section>
      ) : null}
    </AppShell>
  );
}

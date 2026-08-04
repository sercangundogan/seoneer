"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button, Skeleton } from "@/components/ui/primitives";

type Installation = { id: string; installationId: number; accountLogin: string };
type Repo = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [installUrl, setInstallUrl] = useState("");
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [defaults, setDefaults] = useState<{
    primarySeoGoal?: string | null;
    publicationMode?: string;
  }>({});

  const selectedMeta = useMemo(
    () => installations.find((i) => i.id === selectedInstallation),
    [installations, selectedInstallation],
  );

  const availableRepos = useMemo(
    () => repos.filter((r) => !connected.has(r.fullName)),
    [repos, connected],
  );

  const loadConnected = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) return new Set<string>();
    const data = await res.json();
    const set = new Set((data.connectedRepos ?? []) as string[]);
    setConnected(set);
    const first = (data.projects ?? [])[0] as
      | { primarySeoGoal?: string | null; publicationMode?: string }
      | undefined;
    if (first) {
      setDefaults({
        primarySeoGoal: first.primarySeoGoal,
        publicationMode: first.publicationMode,
      });
    }
    return set;
  }, []);

  const loadReposForInstallation = useCallback(
    async (githubInstallationId: number, alreadyConnected?: Set<string>) => {
      const linked = alreadyConnected ?? connected;
      const res = await fetch(`/api/github/installations?installation_id=${githubInstallationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load repositories");
      if (data.installation) {
        setInstallations((prev) => {
          const exists = prev.some((i) => i.id === data.installation.id);
          return exists ? prev : [...prev, data.installation];
        });
        setSelectedInstallation(data.installation.id);
      }
      const next = (data.repos ?? []) as Repo[];
      setRepos(next);
      const free = next.filter((r) => !linked.has(r.fullName));
      setSelectedRepo(free.length === 1 ? free[0] : null);
      if (data.warning) setMessage(data.warning);
    },
    [connected],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const linked = await loadConnected();
        const res = await fetch("/api/github/installations?sync=1");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Could not load GitHub installations");
        setInstallUrl(data.installUrl ?? "");
        const items = (data.installations ?? []) as Installation[];
        setInstallations(items);
        if (items[0]) {
          setSelectedInstallation(items[0].id);
          await loadReposForInstallation(items[0].installationId, linked);
        }
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!selectedRepo || !selectedInstallation || busy) return;
    setBusy(true);
    setMessage("");
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
      const patch: Record<string, unknown> = { startAnalysis: true };
      if (defaults.primarySeoGoal) patch.primarySeoGoal = defaults.primarySeoGoal;
      if (defaults.publicationMode) patch.publicationMode = defaults.publicationMode;

      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      router.push(`/projects/${id}`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  return (
    <AppShell title="Add project">
      <p className="mb-6 max-w-xl text-sm text-[var(--fg-muted)]">
        Connect another GitHub repository. Each repo can only be linked once.
      </p>

      {message ? <p className="mb-4 text-sm text-[var(--danger)]">{message}</p> : null}

      {booting ? (
        <div className="max-w-xl space-y-3" aria-busy>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <section className="animate-fade-up max-w-xl space-y-4">
          {installations.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--fg-muted)]">
                Install the Seoneer GitHub App first, then come back here.
              </p>
              <a href={installUrl || "https://github.com/apps/seoneer/installations/new"}>
                <Button type="button">Install GitHub App</Button>
              </a>
            </div>
          ) : (
            <>
              {installations.length > 1 ? (
                <div className="space-y-2">
                  <label className="text-sm">GitHub installation</label>
                  <select
                    className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                    value={selectedInstallation}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedInstallation(id);
                      const meta = installations.find((i) => i.id === id);
                      if (meta) void loadReposForInstallation(meta.installationId);
                    }}
                  >
                    {installations.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.accountLogin}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm text-[var(--fg-muted)]">
                  {availableRepos.length === 1
                    ? "Only one available repository — selected for you."
                    : "Select a repository that isn’t connected yet."}
                </p>
                {availableRepos.length === 0 ? (
                  <p className="text-sm">
                    {repos.length === 0
                      ? "No repositories found for this installation."
                      : "All accessible repositories are already connected."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {availableRepos.map((repo) => (
                      <li key={repo.fullName}>
                        <button
                          type="button"
                          disabled={busy}
                          className={`w-full rounded-[var(--radius)] border px-4 py-3 text-left text-sm disabled:opacity-50 ${
                            selectedRepo?.fullName === repo.fullName
                              ? "border-[var(--accent)] bg-[var(--bg-elevated)]"
                              : "border-[var(--border)] bg-[var(--bg-elevated)]"
                          }`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          {repo.fullName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {repos.some((r) => connected.has(r.fullName)) ? (
                  <p className="text-xs text-[var(--fg-muted)]">
                    Already connected repos are hidden from this list.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/dashboard">
                  <Button type="button" variant="secondary" disabled={busy}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="button"
                  loading={busy}
                  disabled={!selectedRepo || !selectedMeta}
                  onClick={() => void create()}
                >
                  Connect & analyse
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import { formatAgentStatus } from "@/lib/agent-status";

export type DashboardProject = {
  id: string;
  name: string;
  status: string;
  agentStatus: string | null;
  repository?: { fullName: string; htmlUrl: string } | null;
};

export function ProjectsList({ projects: initial }: { projects: DashboardProject[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(project: DashboardProject) {
    const label = project.repository?.fullName ?? project.name;
    const ok = window.confirm(
      `Delete “${label}”? This removes the Seoneer project and its history. Your GitHub repo is not deleted.`,
    );
    if (!ok) return;

    setDeletingId(project.id);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not delete project");
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete project");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Projects</h2>
        <Link href="/projects/new">
          <Button type="button" variant="secondary">
            Add project
          </Button>
        </Link>
      </div>

      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mt-3 space-y-2">
        {projects.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-5 text-sm text-[var(--fg-muted)]">
            <p>No projects yet.</p>
            <Link
              href="/projects/new"
              className="mt-2 inline-flex font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Connect a repository →
            </Link>
          </div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              className="flex items-stretch gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] transition hover:border-[var(--accent)]/50"
            >
              <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 px-4 py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.repository?.fullName ? (
                  <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">
                    {p.repository.fullName}
                  </span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                  <span>{p.status}</span>
                  {p.agentStatus ? (
                    <Badge
                      tone={
                        p.agentStatus === "blocked" || p.agentStatus === "error"
                          ? "danger"
                          : p.agentStatus === "awaiting_approval" ||
                              p.agentStatus === "needs_input"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {formatAgentStatus(p.agentStatus)}
                    </Badge>
                  ) : null}
                </span>
              </Link>
              <div className="flex items-center border-l border-[var(--border)] px-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[var(--danger)] hover:text-[var(--danger)]"
                  loading={deletingId === p.id}
                  disabled={deletingId !== null}
                  onClick={() => void remove(p)}
                  aria-label={`Delete ${p.name}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

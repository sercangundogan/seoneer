"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";

export type GscConnectionInfo = {
  connected: boolean;
  siteUrl?: string | null;
};

export function SearchConsolePanel({
  projectId,
  gsc,
  disabled,
  justConnected,
  onConnected,
}: {
  projectId: string;
  gsc?: GscConnectionInfo | null;
  disabled?: boolean;
  justConnected?: boolean;
  onConnected?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = Boolean(gsc?.connected);

  async function connect() {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/gsc?projectId=${encodeURIComponent(projectId)}`);
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        configured?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Could not start Search Console connect");

      if (body.configured && body.url) {
        window.location.href = body.url;
        return;
      }

      // Local stub when Google OAuth env vars are not set
      const stub = await fetch("/api/gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const stubBody = (await stub.json().catch(() => ({}))) as { error?: string };
      if (!stub.ok) throw new Error(stubBody.error ?? "Failed to connect Search Console");
      await onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 max-w-xl">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Search Console</h2>
        {connected ? <Badge tone="accent">Connected</Badge> : <Badge>Not connected</Badge>}
      </div>

      {connected ? (
        <>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {justConnected
              ? "Connected. Seoneer will use query and page performance to pick actions and measure impact."
              : "Seoneer is using your Search Console data for keywords, prioritization, and post-merge impact."}
          </p>
          {gsc?.siteUrl ? (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{gsc.siteUrl}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Connect Google Search Console so Seoneer can work from real search demand—not guesses.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--fg-muted)]">
            <li>Prioritize actions from your actual queries and pages</li>
            <li>Measure clicks, impressions, and position after PRs merge</li>
            <li>Raise confidence so the agent waits less often for more data</li>
          </ul>
          <p className="mt-3 text-xs text-[var(--fg-muted)]">
            Read-only access. You need the property verified in Search Console.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void connect()}
              loading={busy}
              disabled={disabled || busy}
            >
              Connect Search Console
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import { isGscSiteResolved } from "@/modules/search-console/status";

export type GscConnectionInfo = {
  connected: boolean;
  siteUrl?: string | null;
  resolved?: boolean;
};

type GscSite = { siteUrl: string; permissionLevel?: string };

export function SearchConsolePanel({
  projectId,
  gsc,
  disabled,
  justConnected,
  needsSiteSelect,
  noSites,
  connectError,
  onConnected,
}: {
  projectId: string;
  gsc?: GscConnectionInfo | null;
  disabled?: boolean;
  justConnected?: boolean;
  needsSiteSelect?: boolean;
  noSites?: boolean;
  connectError?: string;
  onConnected?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(connectError ?? "");
  const [sites, setSites] = useState<GscSite[]>([]);
  const [selected, setSelected] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);

  const hasToken = Boolean(gsc?.connected);
  const resolved = isGscSiteResolved(gsc?.siteUrl);
  const showPicker = needsSiteSelect || (hasToken && !resolved);

  useEffect(() => {
    if (connectError) setError(connectError);
  }, [connectError]);

  useEffect(() => {
    if (!showPicker) return;
    let cancelled = false;
    setLoadingSites(true);
    void (async () => {
      try {
        const res = await fetch(`/api/gsc?projectId=${encodeURIComponent(projectId)}&sites=1`);
        const body = (await res.json().catch(() => ({}))) as {
          sites?: GscSite[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Could not load Search Console properties");
        if (cancelled) return;
        const list = body.sites ?? [];
        setSites(list);
        setSelected(list[0]?.siteUrl ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load properties");
        }
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPicker, projectId]);

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

  async function confirmSite() {
    if (busy || disabled || !selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, siteUrl: selected }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to save Search Console property");
      await onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save property");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 max-w-xl">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-[var(--fg-muted)]">Search Console</h2>
        {resolved ? (
          <Badge tone="accent">Connected</Badge>
        ) : hasToken ? (
          <Badge tone="warning">Choose property</Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
      </div>

      {noSites ? (
        <p className="mt-2 text-sm text-[var(--warning)]">
          Google authorized Seoneer, but this account has no verified Search Console properties.
          Add a property in{" "}
          <a
            className="underline underline-offset-2"
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
          >
            Search Console
          </a>
          , then connect again.
        </p>
      ) : null}

      {showPicker ? (
        <>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Google access is ready. Choose which Search Console property Seoneer should use for
            this project.
          </p>
          {loadingSites ? (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">Loading properties…</p>
          ) : sites.length ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-[var(--fg-muted)]">Property</span>
                <select
                  className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={busy || disabled}
                >
                  {sites.map((site) => (
                    <option key={site.siteUrl} value={site.siteUrl}>
                      {site.siteUrl}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                onClick={() => void confirmSite()}
                loading={busy}
                disabled={disabled || busy || !selected}
              >
                Use this property
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[var(--fg-muted)]">
                No properties found. Reconnect after verifying a site in Search Console.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void connect()}
                loading={busy}
                disabled={disabled || busy}
              >
                Reconnect Search Console
              </Button>
            </div>
          )}
          {error ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void connect()}
                loading={busy}
                disabled={disabled || busy}
              >
                Reconnect Search Console
              </Button>
            </div>
          ) : null}
        </>
      ) : resolved ? (
        <>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {justConnected
              ? "Connected. Seoneer will use query and page performance to pick actions and measure impact."
              : "Seoneer is using your Search Console data for keywords, prioritization, and post-merge impact."}
          </p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{gsc?.siteUrl}</p>
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void connect()}
              disabled={disabled || busy}
            >
              Reconnect
            </Button>
          </div>
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
        </>
      )}

      {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}

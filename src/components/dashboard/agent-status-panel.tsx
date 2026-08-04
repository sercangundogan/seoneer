import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import {
  agentStatusTone,
  formatAgentStatus,
  isAgentWorking,
  resolveAgentStatusCta,
} from "@/lib/agent-status";

export function AgentStatusPanel({
  status,
  detail,
  fallbackDetail,
  projectId,
  actions,
}: {
  status: string | null | undefined;
  detail?: string | null;
  fallbackDetail?: string;
  projectId?: string;
  /** Optional extra actions (e.g. Run SEO action) rendered on the right */
  actions?: ReactNode;
}) {
  const working = isAgentWorking(status);
  const tone = agentStatusTone(status);
  const label = formatAgentStatus(status);
  const cta = resolveAgentStatusCta({ status, detail, projectId });
  const description =
    detail?.trim() ||
    fallbackDetail ||
    (working ? "Working…" : "Ready for the next highest-value SEO action.");

  return (
    <section
      className={`rounded-[var(--radius)] border bg-[var(--bg-elevated)] p-6 transition-[border-color] duration-300 ${
        tone === "danger"
          ? "border-[var(--danger)]/35"
          : tone === "warning"
            ? "border-[var(--warning)]/35"
            : "border-[var(--border)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
            What is the agent doing?
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p
              className={`text-xl font-medium ${
                tone === "danger"
                  ? "text-[var(--danger)]"
                  : tone === "warning"
                    ? "text-[var(--warning)]"
                    : ""
              }`}
            >
              <span className={working ? "animate-status" : undefined}>{label}</span>
            </p>
            <Badge
              tone={
                tone === "danger"
                  ? "danger"
                  : tone === "warning"
                    ? "warning"
                    : tone === "accent"
                      ? "accent"
                      : "neutral"
              }
            >
              {working ? "In progress" : status === "blocked" ? "Stopped" : "Status"}
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">{description}</p>

          {cta ? (
            <div className="animate-cta-in mt-5">
              <Link href={cta.href}>
                <Button type="button">{cta.label}</Button>
              </Link>
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

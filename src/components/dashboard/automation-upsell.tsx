import Link from "next/link";
import { Button } from "@/components/ui/primitives";

/**
 * Shown to free workspaces after the sample PR — unlock automatic cadence.
 */
export function AutomationUpsell({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 ${className}`}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">While you work</p>
      <h2 className="mt-2 text-xl font-medium">Keep SEO moving automatically</h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)]">
        Seoneer prepares the next update on your schedule, emails you when a pull request is ready,
        and lets you review it in one click on GitHub — so your site stays current without living in
        SEO tools.
      </p>
      <div className="mt-5">
        <Link href="/billing">
          <Button type="button">Unlock automatic cadence</Button>
        </Link>
      </div>
    </section>
  );
}

export function shouldShowAutomationUpsell(input: {
  plan?: string | null;
  samplePrUsed?: boolean | null;
  agentStatus?: string | null;
}): boolean {
  const plan = input.plan ?? "free";
  if (plan !== "free") return false;
  if (!input.samplePrUsed) return false;
  const status = input.agentStatus ?? "idle";
  // Don't compete with an active review or mid-flight work
  if (status === "awaiting_approval") return false;
  if (
    status === "selecting_action" ||
    status === "researching" ||
    status === "briefing" ||
    status === "writing" ||
    status === "validating" ||
    status === "executing" ||
    status === "creating_pr" ||
    status === "analysing"
  ) {
    return false;
  }
  return true;
}

export type AgentStatus =
  | "idle"
  | "analysing"
  | "awaiting_confirmation"
  | "selecting_action"
  | "awaiting_approval"
  | "needs_input"
  | "blocked"
  | "error"
  | (string & {});

/** Statuses where the agent is actively working — pulse + poll. */
const WORKING_STATUSES = new Set([
  "analysing",
  "selecting_action",
  "researching",
  "briefing",
  "writing",
  "validating",
  "executing",
  "creating_pr",
  "merging",
]);

const LABELS: Record<string, string> = {
  idle: "Idle",
  analysing: "Analysing",
  awaiting_confirmation: "Awaiting confirmation",
  selecting_action: "Selecting action",
  researching: "Researching",
  briefing: "Preparing brief",
  writing: "Writing changes",
  validating: "Validating",
  executing: "Executing",
  creating_pr: "Opening pull request",
  awaiting_approval: "Awaiting approval",
  needs_input: "Needs input",
  blocked: "Blocked",
  error: "Error",
  merging: "Merging",
};

export type AgentStatusTone = "neutral" | "accent" | "warning" | "danger" | "success";

export type AgentStatusCta = {
  label: string;
  href: string;
};

export function isAgentWorking(status: string | null | undefined): boolean {
  if (!status) return false;
  return WORKING_STATUSES.has(status);
}

export function formatAgentStatus(status: string | null | undefined): string {
  if (!status) return "Idle";
  return LABELS[status] ?? status.replaceAll("_", " ");
}

export function agentStatusTone(status: string | null | undefined): AgentStatusTone {
  switch (status) {
    case "blocked":
    case "error":
      return "danger";
    case "awaiting_approval":
    case "needs_input":
    case "awaiting_confirmation":
      return "warning";
    case "idle":
    case null:
    case undefined:
      return "neutral";
    default:
      return isAgentWorking(status) ? "accent" : "neutral";
  }
}

/**
 * Resolve a clear next action from status + detail text.
 * When awaiting approval, prefer the GitHub PR / compare URL if available.
 */
export function resolveAgentStatusCta(input: {
  status: string | null | undefined;
  detail?: string | null;
  projectId?: string;
  /** GitHub PR html_url or compare/?quick_pull=1 URL */
  reviewUrl?: string | null;
}): AgentStatusCta | null {
  const status = input.status ?? "idle";
  const detail = (input.detail ?? "").toLowerCase();
  const projectHref = input.projectId ? `/projects/${input.projectId}` : "/dashboard";
  const reviewUrl = input.reviewUrl?.trim() || null;
  const isGithubReview =
    reviewUrl != null &&
    (reviewUrl.startsWith("https://github.com/") || reviewUrl.startsWith("http://github.com/")) &&
    !reviewUrl.startsWith("dry-run://");

  if (status === "blocked") {
    if (
      /upgrade|credit|billing|sample|subscription|past_due|inactive|plan/.test(detail)
    ) {
      return { label: "Upgrade for SEO Action credits", href: "/billing" };
    }
    return { label: "Review setup", href: projectHref };
  }

  if (status === "awaiting_approval") {
    if (isGithubReview) {
      return { label: "Review pending update", href: reviewUrl };
    }
    return { label: "Review pending update", href: projectHref };
  }

  if (status === "needs_input" || status === "awaiting_confirmation") {
    return { label: "Provide details", href: projectHref };
  }

  if (status === "error") {
    return { label: "Open project", href: projectHref };
  }

  return null;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** True while a GitHub PR is still open and waiting for user review. */
export function isAwaitingPullRequestReview(input: {
  agentStatus: string | null | undefined;
  mergeStatus?: string | null;
}): boolean {
  return (
    input.agentStatus === "awaiting_approval" && (input.mergeStatus ?? "open") === "open"
  );
}

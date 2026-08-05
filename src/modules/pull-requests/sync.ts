import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { getInstallationOctokit } from "@/modules/github/client";
import {
  getInstallationForProject,
  getProjectRepository,
} from "@/modules/projects/service";

export async function findPullRequestByGithubRef(input: {
  repoFullName: string;
  prNumber: number;
}) {
  const repo = await db.query.projectRepositories.findFirst({
    where: eq(schema.projectRepositories.fullName, input.repoFullName),
  });
  if (!repo) return null;

  const pr = await db.query.pullRequests.findFirst({
    where: and(
      eq(schema.pullRequests.projectId, repo.projectId),
      eq(schema.pullRequests.prNumber, input.prNumber),
    ),
  });
  return pr ? { pr, projectId: repo.projectId } : null;
}

export async function recordPullRequestClosed(input: {
  pullRequestId: string;
  merged: boolean;
  source: "github_webhook" | "github_poll" | "dashboard";
  userId?: string;
}): Promise<boolean> {
  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, input.pullRequestId),
  });
  if (!pr || pr.mergeStatus !== "open") return false;

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, pr.projectId),
  });
  if (!project) return false;

  const mergeStatus = input.merged ? "merged" : "closed";
  const actionStatus = input.merged ? "merged" : "cancelled";
  const agentStatusDetail = input.merged
    ? "Last action merged on GitHub"
    : "Pull request closed without merge";

  await db
    .update(schema.pullRequests)
    .set({
      mergeStatus,
      mergedAt: input.merged ? new Date() : null,
    })
    .where(eq(schema.pullRequests.id, pr.id));

  await db
    .update(schema.seoActions)
    .set({ status: actionStatus, updatedAt: new Date() })
    .where(eq(schema.seoActions.id, pr.seoActionId));

  await db
    .update(schema.projects)
    .set({
      agentStatus: "idle",
      agentStatusDetail,
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, project.id));

  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId: project.id,
    userId: input.userId,
    action: input.merged ? "pull_request.merged" : "pull_request.closed",
    entityType: "pull_request",
    entityId: pr.id,
    summary: input.merged
      ? `PR merged on GitHub (${input.source})`
      : `PR closed without merge (${input.source})`,
    evidence: { source: input.source, prNumber: pr.prNumber },
  });

  return true;
}

export async function handleGithubPullRequestClosed(payload: {
  repoFullName: string;
  prNumber: number;
  merged: boolean;
}) {
  const match = await findPullRequestByGithubRef({
    repoFullName: payload.repoFullName,
    prNumber: payload.prNumber,
  });
  if (!match) return { handled: false as const };

  const updated = await recordPullRequestClosed({
    pullRequestId: match.pr.id,
    merged: payload.merged,
    source: "github_webhook",
  });
  return { handled: updated, pullRequestId: match.pr.id };
}

/** Poll GitHub when a project still shows an open PR awaiting review. */
export async function syncOpenPullRequestForProject(projectId: string): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project || project.agentStatus !== "awaiting_approval") return false;

  const pr = await db.query.pullRequests.findFirst({
    where: and(
      eq(schema.pullRequests.projectId, projectId),
      eq(schema.pullRequests.mergeStatus, "open"),
    ),
    orderBy: [desc(schema.pullRequests.createdAt)],
  });
  if (!pr?.prNumber || pr.prUrl?.startsWith("dry-run://")) return false;

  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) return false;

  try {
    const octokit = await getInstallationOctokit(installation.installationId);
    const { data: ghPr } = await octokit.rest.pulls.get({
      owner: repo.owner,
      repo: repo.name,
      pull_number: pr.prNumber,
    });
    if (ghPr.state === "open") return false;

    return await recordPullRequestClosed({
      pullRequestId: pr.id,
      merged: ghPr.merged === true,
      source: "github_poll",
    });
  } catch {
    return false;
  }
}

export async function syncAwaitingPullRequestsForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return;

  const awaiting = await db.query.projects.findMany({
    where: and(
      inArray(schema.projects.id, projectIds),
      eq(schema.projects.agentStatus, "awaiting_approval"),
    ),
  });

  await Promise.all(awaiting.map((p) => syncOpenPullRequestForProject(p.id)));
}

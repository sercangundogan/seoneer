import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertWorkspaceMember } from "@/modules/workspaces/service";
import { writeAuditLog } from "@/modules/audit-logs/service";

export async function createProject(input: {
  workspaceId: string;
  userId: string;
  name: string;
  installationRowId: string;
  owner: string;
  repoName: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
}) {
  await assertWorkspaceMember(input.workspaceId, input.userId);

  const [project] = await db
    .insert(schema.projects)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      defaultBranch: input.defaultBranch,
      status: "onboarding",
    })
    .returning();

  await db.insert(schema.projectRepositories).values({
    projectId: project.id,
    installationId: input.installationRowId,
    owner: input.owner,
    name: input.repoName,
    fullName: input.fullName,
    defaultBranch: input.defaultBranch,
    htmlUrl: input.htmlUrl,
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    projectId: project.id,
    userId: input.userId,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    summary: `Connected repository ${input.fullName}`,
  });

  return project;
}

export async function getProjectForUser(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) return null;
  await assertWorkspaceMember(project.workspaceId, userId);
  return project;
}

export async function listProjectsForUser(userId: string) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.userId, userId),
  });
  if (!membership) return [];
  return db.query.projects.findMany({
    where: eq(schema.projects.workspaceId, membership.workspaceId),
    orderBy: [desc(schema.projects.createdAt)],
  });
}

export async function updateProjectSettings(
  projectId: string,
  userId: string,
  patch: Partial<{
    primarySeoGoal: string;
    publicationMode: "review_all" | "one_click" | "auto_safe";
    status: "onboarding" | "active" | "paused" | "error";
    agentStatus: string;
    agentStatusDetail: string;
    recommendedCadence: unknown;
  }>,
) {
  const project = await getProjectForUser(projectId, userId);
  if (!project) throw new Error("Not found");
  const [updated] = await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId))
    .returning();
  return updated;
}

export async function getProjectRepository(projectId: string) {
  return db.query.projectRepositories.findFirst({
    where: eq(schema.projectRepositories.projectId, projectId),
  });
}

export async function getInstallationForProject(projectId: string) {
  const repo = await getProjectRepository(projectId);
  if (!repo) return null;
  return db.query.githubInstallations.findFirst({
    where: eq(schema.githubInstallations.id, repo.installationId),
  });
}

export async function upsertGithubInstallation(input: {
  workspaceId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
}) {
  const existing = await db.query.githubInstallations.findFirst({
    where: eq(schema.githubInstallations.installationId, input.installationId),
  });
  if (existing) {
    const [updated] = await db
      .update(schema.githubInstallations)
      .set({
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        suspendedAt: null,
        workspaceId: input.workspaceId,
      })
      .where(eq(schema.githubInstallations.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(schema.githubInstallations)
    .values({
      workspaceId: input.workspaceId,
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
    })
    .returning();
  return created;
}

export async function listInstallations(workspaceId: string) {
  return db.query.githubInstallations.findMany({
    where: and(
      eq(schema.githubInstallations.workspaceId, workspaceId),
    ),
  });
}

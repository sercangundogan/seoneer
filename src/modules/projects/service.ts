import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { assertWorkspaceMember } from "@/modules/workspaces/service";
import { writeAuditLog } from "@/modules/audit-logs/service";

export async function findWorkspaceProjectByFullName(
  workspaceId: string,
  fullName: string,
) {
  const rows = await db
    .select({
      projectId: schema.projects.id,
      fullName: schema.projectRepositories.fullName,
    })
    .from(schema.projectRepositories)
    .innerJoin(
      schema.projects,
      eq(schema.projectRepositories.projectId, schema.projects.id),
    )
    .where(
      and(
        eq(schema.projects.workspaceId, workspaceId),
        eq(schema.projectRepositories.fullName, fullName),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listConnectedRepoFullNames(workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ fullName: schema.projectRepositories.fullName })
    .from(schema.projectRepositories)
    .innerJoin(
      schema.projects,
      eq(schema.projectRepositories.projectId, schema.projects.id),
    )
    .where(eq(schema.projects.workspaceId, workspaceId));
  return rows.map((r) => r.fullName);
}

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

  const duplicate = await findWorkspaceProjectByFullName(input.workspaceId, input.fullName);
  if (duplicate) {
    throw new ApiError(
      `Repository ${input.fullName} is already connected to a project.`,
      409,
    );
  }

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

export async function deleteProject(projectId: string, userId: string) {
  const project = await getProjectForUser(projectId, userId);
  if (!project) throw new ApiError("Not found", 404);

  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId: project.id,
    userId,
    action: "project.deleted",
    entityType: "project",
    entityId: project.id,
    summary: `Deleted project ${project.name}`,
  });

  await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
  return { ok: true as const };
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

export type ProjectListItem = Awaited<ReturnType<typeof listProjectsForUser>>[number] & {
  repository?: { fullName: string; htmlUrl: string } | null;
};

export async function listProjectsWithReposForUser(userId: string): Promise<ProjectListItem[]> {
  const projects = await listProjectsForUser(userId);
  if (projects.length === 0) return [];

  const repos = await db.query.projectRepositories.findMany({
    where: inArray(
      schema.projectRepositories.projectId,
      projects.map((p) => p.id),
    ),
  });
  const byProject = new Map(repos.map((r) => [r.projectId, r]));

  return projects.map((p) => {
    const repo = byProject.get(p.id);
    return {
      ...p,
      repository: repo ? { fullName: repo.fullName, htmlUrl: repo.htmlUrl } : null,
    };
  });
}

export async function updateProjectSettings(
  projectId: string,
  userId: string,
  patch: Partial<{
    primarySeoGoal: string;
    publicationMode: "review_all" | "one_click";
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
    where: and(eq(schema.githubInstallations.workspaceId, workspaceId)),
  });
}

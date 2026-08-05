import { z } from "zod";
import { json, requireSession, handleRouteError } from "@/lib/api";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import {
  createProject,
  listConnectedRepoFullNames,
  listInstallations,
  listProjectsWithReposForUser,
} from "@/modules/projects/service";
import { syncAwaitingPullRequestsForProjects } from "@/modules/pull-requests/sync";
import { clearBillingBlockedProjects, getBillingState } from "@/modules/billing/service";

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    const projects = await listProjectsWithReposForUser(session.user.id);
    await syncAwaitingPullRequestsForProjects(projects.map((p) => p.id));

    // Paid workspaces: clear stale free-sample blocks so Overview matches reality.
    if (workspace) {
      const billing = await getBillingState(workspace.id);
      const plan = billing.subscription?.plan;
      if (
        plan &&
        plan !== "free" &&
        billing.subscription?.status === "active" &&
        (billing.credits?.balance ?? 0) > 0
      ) {
        await clearBillingBlockedProjects(workspace.id);
      }
    }

    const refreshedProjects = await listProjectsWithReposForUser(session.user.id);
    const connectedRepos = workspace
      ? await listConnectedRepoFullNames(workspace.id)
      : [];
    return json({ projects: refreshedProjects, connectedRepos });
  } catch (error) {
    return handleRouteError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  installationRowId: z.string().uuid(),
  owner: z.string().min(1),
  repoName: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1),
  htmlUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);
    const body = createSchema.parse(await request.json());
    const installations = await listInstallations(workspace.id);
    if (!installations.some((i) => i.id === body.installationRowId)) {
      return json({ error: "Installation not found" }, 404);
    }
    const project = await createProject({
      workspaceId: workspace.id,
      userId: session.user.id,
      ...body,
    });
    return json({ project }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

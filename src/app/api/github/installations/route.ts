import { z } from "zod";
import { json, requireSession } from "@/lib/api";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import { upsertGithubInstallation } from "@/modules/projects/service";
import { githubAppInstallUrl, listInstallationRepos } from "@/modules/github/client";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function GET(request: Request) {
  const session = await requireSession();
  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) return json({ error: "Workspace missing" }, 400);

  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");

  if (installationId) {
    const row = await db.query.githubInstallations.findFirst({
      where: eq(schema.githubInstallations.installationId, Number(installationId)),
    });
    if (!row) return json({ error: "Installation not registered yet" }, 404);
    try {
      const repos = await listInstallationRepos(row.installationId);
      return json({ installation: row, repos, installUrl: githubAppInstallUrl() });
    } catch (error) {
      return json({
        installation: row,
        repos: [],
        installUrl: githubAppInstallUrl(),
        warning: error instanceof Error ? error.message : "Could not list repos",
      });
    }
  }

  const installations = await db.query.githubInstallations.findMany({
    where: eq(schema.githubInstallations.workspaceId, workspace.id),
  });
  return json({ installations, installUrl: githubAppInstallUrl() });
}

const registerSchema = z.object({
  installationId: z.number().int(),
  accountLogin: z.string(),
  accountType: z.string(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  const workspace = await getWorkspaceForUser(session.user.id);
  if (!workspace) return json({ error: "Workspace missing" }, 400);
  const body = registerSchema.parse(await request.json());
  const installation = await upsertGithubInstallation({
    workspaceId: workspace.id,
    installationId: body.installationId,
    accountLogin: body.accountLogin,
    accountType: body.accountType,
  });
  return json({ installation });
}

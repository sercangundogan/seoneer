import { z } from "zod";
import { eq } from "drizzle-orm";
import { json, requireSession, handleRouteError } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { getWorkspaceForUser } from "@/modules/workspaces/service";
import { upsertGithubInstallation } from "@/modules/projects/service";
import {
  githubAppInstallUrl,
  listGithubAppInstallations,
  listInstallationRepos,
} from "@/modules/github/client";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);

    const url = new URL(request.url);
    const installationId = url.searchParams.get("installation_id");
    const sync = url.searchParams.get("sync") === "1";

    if (sync) {
      const remote = await listGithubAppInstallations();
      const synced = [];
      for (const item of remote) {
        if (item.suspended) continue;
        const row = await upsertGithubInstallation({
          workspaceId: workspace.id,
          installationId: item.installationId,
          accountLogin: item.accountLogin,
          accountType: item.accountType,
        });
        synced.push(row);
      }
      return json({
        installations: synced,
        installUrl: githubAppInstallUrl(workspace.id),
        syncedCount: synced.length,
      });
    }

    if (installationId) {
      let row = await db.query.githubInstallations.findFirst({
        where: eq(schema.githubInstallations.installationId, Number(installationId)),
      });

      if (!row) {
        // Register from GitHub if the callback/register step was missed
        const remote = await listGithubAppInstallations();
        const match = remote.find((i) => i.installationId === Number(installationId));
        if (!match || match.suspended) {
          return json({ error: "Installation not found on GitHub App" }, 404);
        }
        row = await upsertGithubInstallation({
          workspaceId: workspace.id,
          installationId: match.installationId,
          accountLogin: match.accountLogin,
          accountType: match.accountType,
        });
      }

      try {
        const repos = await listInstallationRepos(row.installationId);
        return json({
          installation: row,
          repos,
          installUrl: githubAppInstallUrl(workspace.id),
        });
      } catch (error) {
        return json({
          installation: row,
          repos: [],
          installUrl: githubAppInstallUrl(workspace.id),
          warning: error instanceof Error ? error.message : "Could not list repos",
        });
      }
    }

    const installations = await db.query.githubInstallations.findMany({
      where: eq(schema.githubInstallations.workspaceId, workspace.id),
    });
    return json({
      installations,
      installUrl: githubAppInstallUrl(workspace.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const registerSchema = z.object({
  installationId: z.number().int(),
  accountLogin: z.string().optional(),
  accountType: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const workspace = await getWorkspaceForUser(session.user.id);
    if (!workspace) return json({ error: "Workspace missing" }, 400);
    const body = registerSchema.parse(await request.json());

    let accountLogin = body.accountLogin ?? "github-user";
    let accountType = body.accountType ?? "User";

    try {
      const remote = await listGithubAppInstallations();
      const match = remote.find((i) => i.installationId === body.installationId);
      if (match) {
        accountLogin = match.accountLogin;
        accountType = match.accountType;
      }
    } catch {
      // Fall back to provided/default account fields
    }

    const installation = await upsertGithubInstallation({
      workspaceId: workspace.id,
      installationId: body.installationId,
      accountLogin,
      accountType,
    });
    return json({ installation });
  } catch (error) {
    return handleRouteError(error);
  }
}

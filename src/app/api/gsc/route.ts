import { z } from "zod";
import { json, requireSession, handleRouteError } from "@/lib/api";
import { env } from "@/lib/env";
import { getProjectForUser } from "@/modules/projects/service";
import {
  getGscOAuthUrl,
  completeGscOAuth,
  listProjectGscSites,
  selectGscSite,
} from "@/modules/search-console/service";

function googleOAuthConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return json({ error: "projectId required" }, 400);
    const project = await getProjectForUser(projectId, session.user.id);
    if (!project) return json({ error: "Not found" }, 404);

    const listSites = url.searchParams.get("sites") === "1";
    if (listSites) {
      const sites = await listProjectGscSites(projectId);
      return json({ sites });
    }

    const configured = googleOAuthConfigured();
    return json({
      configured,
      url: configured ? getGscOAuthUrl(projectId) : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

const postSchema = z.object({
  projectId: z.string().uuid(),
  siteUrl: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = postSchema.parse(await request.json());
    const project = await getProjectForUser(body.projectId, session.user.id);
    if (!project) return json({ error: "Not found" }, 404);

    if (!googleOAuthConfigured()) {
      await completeGscOAuth({
        code: "dev",
        projectId: body.projectId,
        workspaceId: project.workspaceId,
        siteUrl: body.siteUrl,
      });
      return json({ ok: true, siteUrl: body.siteUrl ?? "https://example.com/" });
    }

    if (!body.siteUrl) {
      return json({ error: "siteUrl required to select a Search Console property" }, 400);
    }

    const result = await selectGscSite({
      projectId: body.projectId,
      workspaceId: project.workspaceId,
      siteUrl: body.siteUrl,
    });
    return json({ ok: true, siteUrl: result.siteUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}

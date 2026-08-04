import { json, requireSession } from "@/lib/api";
import { getProjectForUser } from "@/modules/projects/service";
import { getGscOAuthUrl, completeGscOAuth } from "@/modules/search-console/service";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return json({ error: "projectId required" }, 400);
  const project = await getProjectForUser(projectId, session.user.id);
  if (!project) return json({ error: "Not found" }, 404);
  return json({ url: getGscOAuthUrl(projectId) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json()) as { projectId: string; siteUrl?: string };
  const project = await getProjectForUser(body.projectId, session.user.id);
  if (!project) return json({ error: "Not found" }, 404);
  await completeGscOAuth({
    code: "dev",
    projectId: body.projectId,
    workspaceId: project.workspaceId,
    siteUrl: body.siteUrl,
  });
  return json({ ok: true });
}

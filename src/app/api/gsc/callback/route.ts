import { redirect } from "next/navigation";
import { completeGscOAuth } from "@/modules/search-console/service";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "dev";
  const projectId = url.searchParams.get("state");
  if (!projectId) {
    return new Response("Missing state", { status: 400 });
  }
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) return new Response("Project not found", { status: 404 });

  await completeGscOAuth({
    code,
    projectId,
    workspaceId: project.workspaceId,
  });

  redirect(`/projects/${projectId}?gsc=connected`);
}

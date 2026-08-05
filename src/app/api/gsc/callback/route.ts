import { NextResponse } from "next/server";
import { completeGscOAuth } from "@/modules/search-console/service";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";

function projectRedirect(projectId: string, query: string) {
  return NextResponse.redirect(new URL(`/projects/${projectId}?${query}`, env.NEXT_PUBLIC_APP_URL));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const projectId = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (!projectId) {
    return new Response("Missing state", { status: 400 });
  }
  if (oauthError) {
    return projectRedirect(projectId, `gsc=error&reason=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) return new Response("Project not found", { status: 404 });

  try {
    const result = await completeGscOAuth({
      code,
      projectId,
      workspaceId: project.workspaceId,
    });

    if (result.status === "connected") {
      return projectRedirect(projectId, "gsc=connected");
    }
    if (result.status === "no_sites") {
      return projectRedirect(projectId, "gsc=no_sites");
    }
    return projectRedirect(projectId, "gsc=select");
  } catch (error) {
    const message = error instanceof Error ? error.message : "gsc_failed";
    return projectRedirect(projectId, `gsc=error&reason=${encodeURIComponent(message)}`);
  }
}

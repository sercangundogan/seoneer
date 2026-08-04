import { z } from "zod";
import { json, requireSession } from "@/lib/api";
import { getProjectForUser } from "@/modules/projects/service";
import { mergeApprovedPr } from "@/modules/seo-strategy/service";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const bodySchema = z.object({
  pullRequestId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await requireSession();
  const body = bodySchema.parse(await request.json());
  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, body.pullRequestId),
  });
  if (!pr) return json({ error: "Not found" }, 404);
  const project = await getProjectForUser(pr.projectId, session.user.id);
  if (!project) return json({ error: "Forbidden" }, 403);

  const merged = await mergeApprovedPr({
    pullRequestId: pr.id,
    userId: session.user.id,
    source: "dashboard",
  });
  return json({ pullRequest: merged });
}

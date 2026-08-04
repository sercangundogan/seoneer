import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { enqueueJob } from "@/modules/jobs/enqueue";
import { findDuePaidProjectIds } from "@/modules/work-programs/service";

function authorizeCron(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    // Allow in development without secret for local smoke tests
    return env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}

async function runCron(request: Request) {
  if (!authorizeCron(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const projectIds = await findDuePaidProjectIds();
  const enqueued: { projectId: string; jobId: string }[] = [];

  for (const projectId of projectIds) {
    try {
      const job = await enqueueJob("seo.runActionCycle", { projectId });
      enqueued.push({ projectId, jobId: job.id });
    } catch (error) {
      console.error(`Cron enqueue failed for ${projectId}`, error);
    }
  }

  return json({
    ok: true,
    due: projectIds.length,
    enqueued: enqueued.length,
    jobs: enqueued,
  });
}

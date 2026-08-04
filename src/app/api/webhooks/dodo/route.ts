import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { createHmac, timingSafeEqual } from "crypto";
import { enqueueJob } from "@/modules/jobs/enqueue";

function verifyDodoSignature(raw: string, signature: string | null): boolean {
  if (!env.DODO_WEBHOOK_SECRET || !signature) return !env.DODO_WEBHOOK_SECRET;
  const expected = createHmac("sha256", env.DODO_WEBHOOK_SECRET).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature =
    request.headers.get("x-dodo-signature") ?? request.headers.get("webhook-signature");
  if (!verifyDodoSignature(raw, signature)) {
    return json({ error: "Invalid signature" }, 401);
  }

  const payload = JSON.parse(raw) as Record<string, unknown>;
  const externalId = String(
    payload.id ?? payload.event_id ?? request.headers.get("x-dodo-event-id") ?? crypto.randomUUID(),
  );

  const job = await enqueueJob("billing.processWebhook", { externalId, payload });
  return json({ ok: true, jobId: job.id });
}

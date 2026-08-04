import { Webhook } from "standardwebhooks";
import { json } from "@/lib/api";
import { env } from "@/lib/env";
import { enqueueJob } from "@/modules/jobs/enqueue";

export async function POST(request: Request) {
  const raw = await request.text();

  if (env.DODO_WEBHOOK_SECRET) {
    const webhookId = request.headers.get("webhook-id");
    const webhookSignature = request.headers.get("webhook-signature");
    const webhookTimestamp = request.headers.get("webhook-timestamp");

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return json({ error: "Missing webhook signature headers" }, 401);
    }

    try {
      // Secret may be provided as whsec_... — Standard Webhooks accepts that form
      const wh = new Webhook(env.DODO_WEBHOOK_SECRET);
      wh.verify(raw, {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      });
    } catch {
      return json({ error: "Invalid signature" }, 401);
    }
  }

  const payload = JSON.parse(raw) as Record<string, unknown>;
  const externalId = String(
    payload.id ??
      payload.event_id ??
      request.headers.get("webhook-id") ??
      crypto.randomUUID(),
  );

  const job = await enqueueJob("billing.processWebhook", { externalId, payload });
  return json({ ok: true, jobId: job.id });
}

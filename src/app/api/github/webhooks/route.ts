import { json } from "@/lib/api";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

function verifySignature(payload: string, signature: string | null): boolean {
  if (!env.GITHUB_APP_WEBHOOK_SECRET || !signature) return !env.GITHUB_APP_WEBHOOK_SECRET;
  const expected = `sha256=${createHmac("sha256", env.GITHUB_APP_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, signature)) {
    return json({ error: "Invalid signature" }, 401);
  }

  const event = request.headers.get("x-github-event");
  const delivery = request.headers.get("x-github-delivery") ?? crypto.randomUUID();
  const payload = JSON.parse(raw) as Record<string, unknown>;

  try {
    await db.insert(schema.webhookEvents).values({
      provider: "github",
      externalId: delivery,
      payload,
      processedAt: new Date(),
    });
  } catch {
    return json({ ok: true, duplicate: true });
  }

  if (event === "installation") {
    const action = String(payload.action);
    const installation = payload.installation as { id: number };
    if (action === "deleted" || action === "suspend") {
      await db
        .update(schema.githubInstallations)
        .set({ suspendedAt: new Date() })
        .where(eq(schema.githubInstallations.installationId, installation.id));
    }
  }

  return json({ ok: true });
}

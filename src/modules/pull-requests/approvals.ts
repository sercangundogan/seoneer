import { eq } from "drizzle-orm";
import { addHours } from "date-fns";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";

export async function createApprovalToken(pullRequestId: string) {
  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = addHours(new Date(), 72);
  await db.insert(schema.approvalTokens).values({
    pullRequestId,
    tokenHash,
    purpose: "approve_and_publish",
    expiresAt,
  });
  return { rawToken, expiresAt };
}

export function buildApprovalUrl(rawToken: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/api/approvals/consume?token=${encodeURIComponent(rawToken)}`;
}

export async function consumeApprovalToken(rawToken: string, userId?: string) {
  const tokenHash = sha256(rawToken);
  const row = await db.query.approvalTokens.findFirst({
    where: eq(schema.approvalTokens.tokenHash, tokenHash),
  });
  if (!row) throw new Error("Invalid approval token");
  if (row.usedAt) throw new Error("Approval token already used");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("Approval token expired");

  await db
    .update(schema.approvalTokens)
    .set({ usedAt: new Date(), usedByUserId: userId ?? null })
    .where(eq(schema.approvalTokens.id, row.id));

  return row;
}

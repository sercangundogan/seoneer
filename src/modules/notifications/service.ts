import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendPrReadyEmail(input: {
  to: string;
  actionType: string;
  why: string;
  benefit: string;
  fileCount: number;
  prUrl: string;
  approveUrl: string;
  decisionSummary: string;
}) {
  const subject = `Seoneer: ${input.actionType} ready for review`;
  const html = `
    <div style="font-family: Geist, Segoe UI, sans-serif; color: #141414; line-height: 1.5;">
      <h1 style="font-size: 20px;">SEO update ready</h1>
      <p><strong>What changed:</strong> ${input.actionType}</p>
      <p><strong>Why:</strong> ${input.why}</p>
      <p><strong>Expected benefit:</strong> ${input.benefit}</p>
      <p><strong>Files:</strong> ${input.fileCount}</p>
      <p><strong>Quality checks:</strong> Completed (see PR)</p>
      <p>${input.decisionSummary}</p>
      <p>
        <a href="${input.approveUrl}" style="background:#0f6b5c;color:#fff;padding:10px 14px;text-decoration:none;border-radius:8px;">Approve and Publish</a>
        &nbsp;
        <a href="${input.prUrl}">Review Changes</a>
      </p>
    </div>
  `;

  const user = await db.query.user.findFirst({
    where: eq(schema.user.email, input.to),
  });

  if (user) {
    await db.insert(schema.notifications).values({
      userId: user.id,
      channel: "email",
      template: "pr_ready",
      payload: input,
      sentAt: new Date(),
    });
  }

  if (!resend) {
    console.info("[email:dry-run]", subject, input.to);
    return { dryRun: true };
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject,
    html,
  });
  return { dryRun: false };
}

import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  userId?: string;
  template: string;
  payload?: Record<string, unknown>;
}) {
  if (input.userId) {
    await db.insert(schema.notifications).values({
      userId: input.userId,
      channel: "email",
      template: input.template,
      payload: input.payload ?? {},
      sentAt: new Date(),
    });
  }

  if (!resend) {
    console.info("[email:dry-run]", input.subject, input.to);
    return { dryRun: true as const };
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return { dryRun: false as const };
}

function firstName(name?: string | null, email?: string) {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = email?.split("@")[0];
  return local || "there";
}

function linkStyle() {
  return "color:#0f6b5c;text-decoration:underline;";
}

/**
 * Plain, personal welcome — sent once when the user account is created.
 */
export async function sendWelcomeEmail(input: {
  to: string;
  name?: string | null;
  userId: string;
}) {
  const name = firstName(input.name, input.to);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const onboardingUrl = `${appUrl}/onboarding`;
  const docsUrl = `${appUrl}/dashboard`;

  const subject = "Welcome to Seoneer";

  const text = `Hey ${name},

Welcome to Seoneer.

I'm glad you're here. Seoneer is an autonomous SEO engineer for GitHub-hosted Next.js projects — it finds high-value work and ships changes as pull requests, never to your default branch.

Here are 3 steps to get started:

1. Install the Seoneer GitHub App
2. Pick a repository and confirm the product summary
3. Set your SEO goal and run the first analysis

Start here: ${onboardingUrl}

P.S. Why did you sign up? What brought you here?

Hit reply and let me know — I read every email.

Cheers,
Seoneer
`;

  const html = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#141414;line-height:1.6;font-size:16px;max-width:560px;">
  <p>Hey ${escapeHtml(name)},</p>
  <p>Welcome to Seoneer.</p>
  <p>
    I'm glad you're here. Seoneer is an autonomous SEO engineer for GitHub-hosted Next.js projects —
    it finds high-value work and ships changes as pull requests, never to your default branch.
  </p>
  <p>Here are 3 steps to get started.</p>
  <p>
    <a href="${onboardingUrl}" style="${linkStyle()}">Install the GitHub App</a><br/>
    <a href="${onboardingUrl}" style="${linkStyle()}">Pick a repository</a><br/>
    <a href="${docsUrl}" style="${linkStyle()}">Open your workspace</a>
  </p>
  <p>
    P.S. Why did you sign up? What brought you here?<br/>
    Hit reply and let me know — I read every email.
  </p>
  <p>Cheers,<br/>Seoneer</p>
</div>
`.trim();

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    userId: input.userId,
    template: "welcome",
    payload: { onboardingUrl },
  });
}

export async function sendPrReadyEmail(input: {
  to: string;
  actionType: string;
  why: string;
  benefit: string;
  fileCount: number;
  prUrl: string;
  decisionSummary: string;
}) {
  const subject = `Seoneer: ${input.actionType} ready for review`;
  const text = `SEO update ready

What changed: ${input.actionType}
Why: ${input.why}
Expected benefit: ${input.benefit}
Files: ${input.fileCount}

${input.decisionSummary}

Review the pull request on GitHub:
${input.prUrl}

Seoneer never merges for you — approve the PR when you’re happy with the changes.
`;

  const primaryBtn =
    "display:inline-block;background:#0f6b5c;color:#ffffff;padding:12px 16px;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;line-height:1.2;";

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#141414;line-height:1.5;">
      <h1 style="font-size:20px;font-weight:600;">SEO update ready for review</h1>
      <p><strong>What changed:</strong> ${escapeHtml(input.actionType)}</p>
      <p><strong>Why:</strong> ${escapeHtml(input.why)}</p>
      <p><strong>Expected benefit:</strong> ${escapeHtml(input.benefit)}</p>
      <p><strong>Files:</strong> ${input.fileCount}</p>
      <p style="margin-bottom:0;">${escapeHtml(input.decisionSummary)}</p>
      <p style="margin:28px 0 0 0;">
        <a href="${input.prUrl}" style="${primaryBtn}">Review pull request</a>
      </p>
      <p style="margin-top:16px;font-size:13px;color:#5c5c5c;">
        Seoneer opens the PR only — you review and merge on GitHub when ready.
      </p>
    </div>
  `;

  const user = await db.query.user.findFirst({
    where: eq(schema.user.email, input.to),
  });

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    userId: user?.id,
    template: "pr_ready",
    payload: input,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

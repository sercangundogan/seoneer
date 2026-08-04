import { NextResponse } from "next/server";
import { consumeApprovalToken } from "@/modules/pull-requests/approvals";
import { mergeApprovedPr } from "@/modules/seo-strategy/service";
import { json } from "@/lib/api";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "Missing token" }, 400);

  try {
    const row = await consumeApprovalToken(token);
    await mergeApprovedPr({
      pullRequestId: row.pullRequestId,
      userId: row.usedByUserId ?? "email-approval",
      source: "email",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      400,
    );
  }

  // Use NextResponse.redirect — next/navigation `redirect()` throws NEXT_REDIRECT,
  // which must not be caught by try/catch in route handlers.
  return NextResponse.redirect(new URL("/dashboard?merged=1", env.NEXT_PUBLIC_APP_URL));
}

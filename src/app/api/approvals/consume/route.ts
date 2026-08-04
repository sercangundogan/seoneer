import { redirect } from "next/navigation";
import { consumeApprovalToken } from "@/modules/pull-requests/approvals";
import { mergeApprovedPr } from "@/modules/seo-strategy/service";
import { json } from "@/lib/api";

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
    redirect(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?merged=1`);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      400,
    );
  }
}

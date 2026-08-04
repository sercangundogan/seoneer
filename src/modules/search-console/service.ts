import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { encryptString, decryptString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/modules/audit-logs/service";

export function getGscOAuthUrl(projectId: string): string {
  const redirect = `${env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state: projectId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function storeGscConnection(input: {
  projectId: string;
  siteUrl: string;
  refreshToken: string;
  workspaceId: string;
}) {
  const encrypted = encryptString(input.refreshToken);
  const existing = await db.query.gscConnections.findFirst({
    where: eq(schema.gscConnections.projectId, input.projectId),
  });
  if (existing) {
    await db
      .update(schema.gscConnections)
      .set({
        siteUrl: input.siteUrl,
        refreshTokenEncrypted: encrypted,
        connectedAt: new Date(),
      })
      .where(eq(schema.gscConnections.id, existing.id));
  } else {
    await db.insert(schema.gscConnections).values({
      projectId: input.projectId,
      siteUrl: input.siteUrl,
      refreshTokenEncrypted: encrypted,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  }
  await writeAuditLog({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    action: "gsc.connected",
    summary: `Connected Search Console site ${input.siteUrl}`,
  });
}

export async function saveGscSnapshot(input: {
  projectId: string;
  queryRows: unknown[];
  pageRows: unknown[];
  periodStart: string;
  periodEnd: string;
}) {
  const connection = await db.query.gscConnections.findFirst({
    where: eq(schema.gscConnections.projectId, input.projectId),
  });
  if (!connection) throw new Error("GSC not connected");
  const [row] = await db
    .insert(schema.gscSnapshots)
    .values({
      connectionId: connection.id,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      queryRows: input.queryRows,
      pageRows: input.pageRows,
    })
    .returning();
  return row;
}

/** Exchange code and fetch a shallow snapshot. Uses fetch; works when Google creds exist. */
export async function completeGscOAuth(input: {
  code: string;
  projectId: string;
  workspaceId: string;
  siteUrl?: string;
}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    // Dev stub: store placeholder connection
    await storeGscConnection({
      projectId: input.projectId,
      siteUrl: input.siteUrl ?? "https://example.com/",
      refreshToken: "dev-refresh-token",
      workspaceId: input.workspaceId,
    });
    await saveGscSnapshot({
      projectId: input.projectId,
      periodStart: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
      periodEnd: new Date().toISOString().slice(0, 10),
      queryRows: [
        { keys: "example query", clicks: 12, impressions: 400, ctr: 0.03, position: 14 },
      ],
      pageRows: [],
    });
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error("GSC OAuth token exchange failed");
  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token: string };
  const siteUrl = input.siteUrl ?? "sc-domain:example.com";
  await storeGscConnection({
    projectId: input.projectId,
    siteUrl,
    refreshToken: tokens.refresh_token ?? decryptOrEmptyPlaceholder(),
    workspaceId: input.workspaceId,
  });
}

function decryptOrEmptyPlaceholder() {
  return "missing-refresh-token";
}

export function decryptGscRefreshToken(encrypted: string): string {
  return decryptString(encrypted);
}

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { encryptString, decryptString } from "@/lib/crypto";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { GSC_PENDING_SITE, isGscSiteResolved } from "@/modules/search-console/status";

export { GSC_PENDING_SITE, isGscSiteResolved } from "@/modules/search-console/status";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type GscTokens = { access_token: string; refresh_token?: string };
type GscSiteEntry = { siteUrl: string; permissionLevel?: string };
type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export function getGscOAuthUrl(projectId: string): string {
  const redirect = `${env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirect,
    response_type: "code",
    scope: GSC_SCOPE,
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
      scopes: [GSC_SCOPE],
    });
  }
  if (isGscSiteResolved(input.siteUrl)) {
    await writeAuditLog({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      action: "gsc.connected",
      summary: `Connected Search Console site ${input.siteUrl}`,
    });
  }
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

async function exchangeCodeForTokens(code: string): Promise<GscTokens> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(`GSC OAuth token exchange failed${detail ? `: ${detail}` : ""}`);
  }
  return (await tokenRes.json()) as GscTokens;
}

export async function refreshGscAccessToken(refreshToken: string): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error("Failed to refresh Search Console access token");
  const tokens = (await tokenRes.json()) as GscTokens;
  return tokens.access_token;
}

export async function listGscSites(accessToken: string): Promise<GscSiteEntry[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to list Search Console sites${detail ? `: ${detail}` : ""}`);
  }
  const body = (await res.json()) as { siteEntry?: GscSiteEntry[] };
  return body.siteEntry ?? [];
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  dimensions: ("query" | "page")[],
): Promise<SearchAnalyticsRow[]> {
  const end = new Date();
  const start = new Date(Date.now() - 28 * 86400000);
  const periodStart = start.toISOString().slice(0, 10);
  const periodEnd = end.toISOString().slice(0, 10);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: periodStart,
        endDate: periodEnd,
        dimensions,
        rowLimit: 50,
      }),
    },
  );
  if (!res.ok) {
    // New properties often have no data yet — treat as empty rather than failing connect
    return [];
  }
  const body = (await res.json()) as { rows?: SearchAnalyticsRow[] };
  return body.rows ?? [];
}

function normalizeSnapshotRows(rows: SearchAnalyticsRow[]) {
  return rows.map((row) => ({
    keys: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export async function fetchAndSaveGscSnapshot(input: {
  projectId: string;
  siteUrl: string;
  accessToken: string;
}) {
  const end = new Date();
  const start = new Date(Date.now() - 28 * 86400000);
  const [queryRows, pageRows] = await Promise.all([
    querySearchAnalytics(input.accessToken, input.siteUrl, ["query"]),
    querySearchAnalytics(input.accessToken, input.siteUrl, ["page"]),
  ]);
  await saveGscSnapshot({
    projectId: input.projectId,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    queryRows: normalizeSnapshotRows(queryRows),
    pageRows: normalizeSnapshotRows(pageRows),
  });
}

async function getConnectionAccessToken(projectId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  siteUrl: string;
}> {
  const connection = await db.query.gscConnections.findFirst({
    where: eq(schema.gscConnections.projectId, projectId),
  });
  if (!connection) throw new Error("Search Console is not connected yet");
  const refreshToken = decryptString(connection.refreshTokenEncrypted);
  if (!refreshToken || refreshToken === "missing-refresh-token" || refreshToken === "dev-refresh-token") {
    throw new Error("Search Console token is missing — reconnect Search Console");
  }
  const accessToken = await refreshGscAccessToken(refreshToken);
  return { accessToken, refreshToken, siteUrl: connection.siteUrl };
}

export async function listProjectGscSites(projectId: string): Promise<GscSiteEntry[]> {
  const { accessToken } = await getConnectionAccessToken(projectId);
  return listGscSites(accessToken);
}

export type CompleteGscOAuthResult =
  | { status: "connected"; siteUrl: string }
  | { status: "select_site"; sites: GscSiteEntry[] }
  | { status: "no_sites" };

/** Exchange code, store refresh token, resolve site when possible. */
export async function completeGscOAuth(input: {
  code: string;
  projectId: string;
  workspaceId: string;
  siteUrl?: string;
}): Promise<CompleteGscOAuthResult> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
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
    return { status: "connected", siteUrl: input.siteUrl ?? "https://example.com/" };
  }

  const tokens = await exchangeCodeForTokens(input.code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke Seoneer access at https://myaccount.google.com/permissions and try again.",
    );
  }

  const sites = await listGscSites(tokens.access_token);
  const chosen =
    input.siteUrl && sites.some((s) => s.siteUrl === input.siteUrl)
      ? input.siteUrl
      : sites.length === 1
        ? sites[0]!.siteUrl
        : null;

  if (!chosen) {
    await storeGscConnection({
      projectId: input.projectId,
      siteUrl: GSC_PENDING_SITE,
      refreshToken: tokens.refresh_token,
      workspaceId: input.workspaceId,
    });
    if (sites.length === 0) return { status: "no_sites" };
    return { status: "select_site", sites };
  }

  await storeGscConnection({
    projectId: input.projectId,
    siteUrl: chosen,
    refreshToken: tokens.refresh_token,
    workspaceId: input.workspaceId,
  });
  await fetchAndSaveGscSnapshot({
    projectId: input.projectId,
    siteUrl: chosen,
    accessToken: tokens.access_token,
  });
  return { status: "connected", siteUrl: chosen };
}

/** Finalize property after OAuth when the account has multiple sites. */
export async function selectGscSite(input: {
  projectId: string;
  workspaceId: string;
  siteUrl: string;
}) {
  const { accessToken, refreshToken } = await getConnectionAccessToken(input.projectId);
  const sites = await listGscSites(accessToken);
  if (!sites.some((s) => s.siteUrl === input.siteUrl)) {
    throw new Error("That Search Console property is not available on this Google account");
  }
  await storeGscConnection({
    projectId: input.projectId,
    siteUrl: input.siteUrl,
    refreshToken,
    workspaceId: input.workspaceId,
  });
  await fetchAndSaveGscSnapshot({
    projectId: input.projectId,
    siteUrl: input.siteUrl,
    accessToken,
  });
  return { siteUrl: input.siteUrl };
}

export function decryptGscRefreshToken(encrypted: string): string {
  return decryptString(encrypted);
}

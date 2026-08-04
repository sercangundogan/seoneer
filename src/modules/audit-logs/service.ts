import { db, schema } from "@/lib/db";

export async function writeAuditLog(input: {
  workspaceId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  evidence?: unknown;
}) {
  const [row] = await db
    .insert(schema.auditLogs)
    .values({
      workspaceId: input.workspaceId ?? null,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      evidence: input.evidence ?? {},
    })
    .returning();
  return row;
}

export async function listAuditLogs(projectId: string, limit = 50) {
  const { desc, eq } = await import("drizzle-orm");
  return db.query.auditLogs.findMany({
    where: eq(schema.auditLogs.projectId, projectId),
    orderBy: [desc(schema.auditLogs.createdAt)],
    limit,
  });
}

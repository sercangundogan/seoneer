import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { grantFreeEntitlement } from "@/modules/billing/service";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export async function ensureWorkspaceForUser(input: { userId: string; name: string }) {
  const existing = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.userId, input.userId),
  });
  if (existing) {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(schema.workspaces.id, existing.workspaceId),
    });
    return workspace!;
  }

  const base = slugify(input.name);
  const slug = `${base}-${input.userId.slice(0, 6)}`;

  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: `${input.name}'s workspace`, slug })
    .returning();

  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: input.userId,
    role: "owner",
  });

  await db.insert(schema.subscriptions).values({
    workspaceId: workspace.id,
    plan: "free",
    status: "active",
  });

  await grantFreeEntitlement(workspace.id);

  return workspace;
}

export async function getWorkspaceForUser(userId: string) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.userId, userId),
  });
  if (!membership) return null;
  return db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, membership.workspaceId),
  });
}

export async function assertWorkspaceMember(workspaceId: string, userId: string) {
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.userId, userId),
  });
  if (!membership || membership.workspaceId !== workspaceId) {
    throw new Error("Forbidden");
  }
  return membership;
}

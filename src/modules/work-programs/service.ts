import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  actionTypesForPrograms,
  derivePrimarySeoGoal,
  getWorkProgramDefinition,
  periodDaysSchema,
  programKeyForActionType,
  workProgramInputSchema,
  WORK_PROGRAM_KEYS,
  type PeriodDays,
  type WorkProgramInput,
  type WorkProgramKey,
} from "@/modules/work-programs/catalog";
import type { SeoActionType } from "@/modules/seo-strategy/schemas";

export type ProjectWorkProgramRow = typeof schema.projectWorkPrograms.$inferSelect;

export function isDue(row: Pick<ProjectWorkProgramRow, "enabled" | "nextRunAt">, now = new Date()) {
  if (!row.enabled) return false;
  if (!row.nextRunAt) return true;
  return row.nextRunAt.getTime() <= now.getTime();
}

export async function listWorkPrograms(projectId: string): Promise<ProjectWorkProgramRow[]> {
  return db.query.projectWorkPrograms.findMany({
    where: eq(schema.projectWorkPrograms.projectId, projectId),
  });
}

export async function getEnabledWorkPrograms(projectId: string): Promise<ProjectWorkProgramRow[]> {
  return db.query.projectWorkPrograms.findMany({
    where: and(
      eq(schema.projectWorkPrograms.projectId, projectId),
      eq(schema.projectWorkPrograms.enabled, true),
    ),
  });
}

export function serializeWorkPrograms(rows: ProjectWorkProgramRow[]) {
  const byKey = new Map(rows.map((r) => [r.programKey, r]));
  return WORK_PROGRAM_KEYS.map((key) => {
    const def = getWorkProgramDefinition(key);
    const row = byKey.get(key);
    return {
      programKey: key,
      label: def.label,
      description: def.description,
      enabled: row?.enabled ?? false,
      periodDays: (row?.periodDays ?? def.defaultPeriodDays) as PeriodDays,
      nextRunAt: row?.nextRunAt?.toISOString() ?? null,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
    };
  });
}

export async function saveWorkPrograms(
  projectId: string,
  inputs: WorkProgramInput[],
): Promise<{ rows: ProjectWorkProgramRow[]; primarySeoGoal: string }> {
  const parsed = inputs.map((i) => workProgramInputSchema.parse(i));
  const enabled = parsed.filter((p) => p.enabled);
  if (enabled.length === 0) {
    throw new Error("Select at least one work program");
  }

  const now = new Date();
  const existing = await listWorkPrograms(projectId);
  const existingByKey = new Map(existing.map((r) => [r.programKey, r]));

  for (const input of parsed) {
    periodDaysSchema.parse(input.periodDays);
    const prev = existingByKey.get(input.programKey);
    const nextRunAt =
      input.enabled && !prev?.nextRunAt
        ? now
        : input.enabled
          ? (prev?.nextRunAt ?? now)
          : null;

    if (prev) {
      await db
        .update(schema.projectWorkPrograms)
        .set({
          enabled: input.enabled,
          periodDays: input.periodDays,
          nextRunAt: input.enabled ? nextRunAt : null,
          updatedAt: now,
        })
        .where(eq(schema.projectWorkPrograms.id, prev.id));
    } else {
      await db.insert(schema.projectWorkPrograms).values({
        projectId,
        programKey: input.programKey,
        enabled: input.enabled,
        periodDays: input.periodDays,
        nextRunAt: input.enabled ? now : null,
        updatedAt: now,
      });
    }
  }

  // Disable any catalog keys omitted from payload
  const payloadKeys = new Set(parsed.map((p) => p.programKey));
  for (const row of existing) {
    if (!payloadKeys.has(row.programKey as WorkProgramKey)) {
      await db
        .update(schema.projectWorkPrograms)
        .set({ enabled: false, nextRunAt: null, updatedAt: now })
        .where(eq(schema.projectWorkPrograms.id, row.id));
    }
  }

  const primarySeoGoal = derivePrimarySeoGoal(parsed);
  await db
    .update(schema.projects)
    .set({ primarySeoGoal, updatedAt: now })
    .where(eq(schema.projects.id, projectId));

  const rows = await listWorkPrograms(projectId);
  return { rows, primarySeoGoal };
}

export async function allowedActionTypesForProject(
  projectId: string,
): Promise<SeoActionType[] | null> {
  const enabled = await getEnabledWorkPrograms(projectId);
  if (enabled.length === 0) return null; // legacy / unset → no hard filter
  return actionTypesForPrograms(enabled.map((r) => r.programKey as WorkProgramKey));
}

export async function preferredDueProgramKeys(
  projectId: string,
  now = new Date(),
): Promise<WorkProgramKey[]> {
  const enabled = await getEnabledWorkPrograms(projectId);
  const due = enabled.filter((r) => isDue(r, now));
  const source = due.length > 0 ? due : enabled;
  return source.map((r) => r.programKey as WorkProgramKey);
}

/** Mark a program due immediately so a manual run can pick it up. */
export async function markWorkProgramDueNow(
  projectId: string,
  programKey: WorkProgramKey,
  now = new Date(),
): Promise<ProjectWorkProgramRow> {
  const row = await db.query.projectWorkPrograms.findFirst({
    where: and(
      eq(schema.projectWorkPrograms.projectId, projectId),
      eq(schema.projectWorkPrograms.programKey, programKey),
    ),
  });
  if (!row) {
    throw new Error("Enable this work program before running it");
  }
  if (!row.enabled) {
    throw new Error("Enable this work program before running it");
  }

  const [updated] = await db
    .update(schema.projectWorkPrograms)
    .set({ nextRunAt: now, updatedAt: now })
    .where(eq(schema.projectWorkPrograms.id, row.id))
    .returning();
  return updated;
}

export async function advanceScheduleForAction(
  projectId: string,
  actionType: SeoActionType,
  now = new Date(),
): Promise<void> {
  const key = programKeyForActionType(actionType);
  if (!key) return;
  const row = await db.query.projectWorkPrograms.findFirst({
    where: and(
      eq(schema.projectWorkPrograms.projectId, projectId),
      eq(schema.projectWorkPrograms.programKey, key),
    ),
  });
  if (!row || !row.enabled) return;

  const next = new Date(now.getTime() + row.periodDays * 24 * 60 * 60 * 1000);
  await db
    .update(schema.projectWorkPrograms)
    .set({
      lastRunAt: now,
      nextRunAt: next,
      updatedAt: now,
    })
    .where(eq(schema.projectWorkPrograms.id, row.id));
}

const BUSY_STATUSES = [
  "analysing",
  "selecting_action",
  "researching",
  "briefing",
  "writing",
  "validating",
  "executing",
  "creating_pr",
  "merging",
  "awaiting_approval",
  // "blocked" is intentionally omitted — billing blocks should retry after upgrade
];

/**
 * Paid projects with at least one due enabled work program and an idle-ish agent.
 */
export async function findDuePaidProjectIds(now = new Date()): Promise<string[]> {
  const dueRows = await db.query.projectWorkPrograms.findMany({
    where: and(
      eq(schema.projectWorkPrograms.enabled, true),
      or(
        isNull(schema.projectWorkPrograms.nextRunAt),
        lte(schema.projectWorkPrograms.nextRunAt, now),
      ),
    ),
  });

  const candidateIds = [...new Set(dueRows.map((r) => r.projectId))];
  if (candidateIds.length === 0) return [];

  const projects = await db.query.projects.findMany({
    where: inArray(schema.projects.id, candidateIds),
  });

  const eligible: string[] = [];
  for (const project of projects) {
    if (project.status === "paused" || project.status === "onboarding") continue;
    if (project.agentStatus && BUSY_STATUSES.includes(project.agentStatus)) continue;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.workspaceId, project.workspaceId),
    });
    if (!sub || sub.plan === "free") continue;
    if (sub.status === "paused" || sub.status === "past_due" || sub.status === "cancelled") {
      continue;
    }

    eligible.push(project.id);
  }

  return eligible;
}

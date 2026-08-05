"use client";

import { Button } from "@/components/ui/primitives";
import {
  PERIOD_DAYS,
  WORK_PROGRAM_CATALOG,
  periodLabel,
  type PeriodDays,
  type WorkProgramInput,
  type WorkProgramKey,
} from "@/modules/work-programs/catalog";

export type WorkProgramSchedule = {
  nextRunAt: string | null;
  lastRunAt: string | null;
};

export type WorkProgramsEditorProps = {
  value: WorkProgramInput[];
  onChange: (next: WorkProgramInput[]) => void;
  disabled?: boolean;
  /** Compact note under the list */
  note?: string;
  /** Saved schedule timestamps keyed by program (from API). */
  schedule?: Partial<Record<WorkProgramKey, WorkProgramSchedule>>;
  /** When set, shows a Run now control on each enabled program. */
  onRunNow?: (programKey: WorkProgramKey) => void;
  runNowDisabled?: boolean;
  runningProgramKey?: WorkProgramKey | null;
};

function ensureAllKeys(value: WorkProgramInput[]): WorkProgramInput[] {
  const byKey = new Map(value.map((v) => [v.programKey, v]));
  return WORK_PROGRAM_CATALOG.map((def) => {
    const existing = byKey.get(def.key);
    return (
      existing ?? {
        programKey: def.key,
        enabled: false,
        periodDays: def.defaultPeriodDays,
      }
    );
  });
}

function scheduleLabel(nextRunAt: string | null | undefined): string | null {
  if (nextRunAt === undefined) return null;
  if (!nextRunAt) return "Ready to run";
  const next = new Date(nextRunAt);
  if (Number.isNaN(next.getTime())) return null;
  if (next.getTime() <= Date.now()) return "Due now";
  return `Next ${next.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

export function WorkProgramsEditor({
  value,
  onChange,
  disabled,
  note,
  schedule,
  onRunNow,
  runNowDisabled,
  runningProgramKey,
}: WorkProgramsEditorProps) {
  const rows = ensureAllKeys(value);
  const enabledCount = rows.filter((r) => r.enabled).length;

  function patch(key: WorkProgramKey, patch: Partial<WorkProgramInput>) {
    onChange(
      rows.map((r) => (r.programKey === key ? { ...r, ...patch } : r)),
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {WORK_PROGRAM_CATALOG.map((def) => {
          const row = rows.find((r) => r.programKey === def.key)!;
          const hint = row.enabled ? scheduleLabel(schedule?.[def.key]?.nextRunAt) : null;
          const isRunningThis = runningProgramKey === def.key;
          return (
            <li
              key={def.key}
              className={`rounded-[var(--radius)] border px-4 py-3 transition-colors ${
                row.enabled
                  ? "border-[var(--accent)]/50 bg-[var(--bg-elevated)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    checked={row.enabled}
                    disabled={disabled}
                    onChange={(e) =>
                      patch(def.key, {
                        enabled: e.target.checked,
                        periodDays: row.periodDays || def.defaultPeriodDays,
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{def.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                      {def.description}
                    </span>
                    {row.enabled ? (
                      <span className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[var(--fg-muted)]">How often</span>
                        <select
                          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                          value={row.periodDays}
                          disabled={disabled}
                          onChange={(e) =>
                            patch(def.key, {
                              periodDays: Number(e.target.value) as PeriodDays,
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          {PERIOD_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {periodLabel(d)}
                            </option>
                          ))}
                        </select>
                        {hint ? (
                          <span className="text-xs text-[var(--fg-muted)]">{hint}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </label>
                {row.enabled && onRunNow ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 px-3 py-1.5 text-xs"
                    loading={isRunningThis}
                    disabled={runNowDisabled || disabled}
                    onClick={() => onRunNow(def.key)}
                    title="Run this program now, without waiting for the schedule"
                  >
                    {isRunningThis ? "Running…" : "Run now"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {enabledCount === 0 ? (
        <p className="text-sm text-[var(--warning)]">Select at least one program to continue.</p>
      ) : null}
      {note ? <p className="text-sm text-[var(--fg-muted)]">{note}</p> : null}
    </div>
  );
}

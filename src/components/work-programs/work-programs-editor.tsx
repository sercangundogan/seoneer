"use client";

import {
  PERIOD_DAYS,
  WORK_PROGRAM_CATALOG,
  periodLabel,
  type PeriodDays,
  type WorkProgramInput,
  type WorkProgramKey,
} from "@/modules/work-programs/catalog";

export type WorkProgramsEditorProps = {
  value: WorkProgramInput[];
  onChange: (next: WorkProgramInput[]) => void;
  disabled?: boolean;
  /** Compact note under the list */
  note?: string;
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

export function WorkProgramsEditor({
  value,
  onChange,
  disabled,
  note,
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
          return (
            <li
              key={def.key}
              className={`rounded-[var(--radius)] border px-4 py-3 transition-colors ${
                row.enabled
                  ? "border-[var(--accent)]/50 bg-[var(--bg-elevated)]"
                  : "border-[var(--border)]"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
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
                    </span>
                  ) : null}
                </span>
              </label>
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

import { z } from "zod";
import type { SeoActionType } from "@/modules/seo-strategy/schemas";

export const WORK_PROGRAM_KEYS = [
  "publish_posts",
  "improve_content",
  "blog_foundation",
  "seo_health",
] as const;

export type WorkProgramKey = (typeof WORK_PROGRAM_KEYS)[number];

export const PERIOD_DAYS = [3, 7, 14, 30] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number];

export const workProgramKeySchema = z.enum(WORK_PROGRAM_KEYS);
export const periodDaysSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(14),
  z.literal(30),
]);

export const workProgramInputSchema = z.object({
  programKey: workProgramKeySchema,
  enabled: z.boolean(),
  periodDays: periodDaysSchema,
});

export type WorkProgramInput = z.infer<typeof workProgramInputSchema>;

export type WorkProgramDefinition = {
  key: WorkProgramKey;
  label: string;
  description: string;
  defaultPeriodDays: PeriodDays;
  actionTypes: SeoActionType[];
};

export const WORK_PROGRAM_CATALOG: WorkProgramDefinition[] = [
  {
    key: "publish_posts",
    label: "Publish new blog posts",
    description: "Draft and open PRs for new articles when it makes sense.",
    defaultPeriodDays: 3,
    actionTypes: ["CREATE_ARTICLE"],
  },
  {
    key: "improve_content",
    label: "Improve existing content",
    description: "Refresh posts, titles, descriptions, and internal links.",
    defaultPeriodDays: 7,
    actionTypes: ["UPDATE_ARTICLE", "IMPROVE_TITLE_DESCRIPTION", "ADD_INTERNAL_LINKS"],
  },
  {
    key: "blog_foundation",
    label: "Set up blog structure",
    description: "Create the blog foundation if your repo does not have one yet.",
    defaultPeriodDays: 14,
    actionTypes: ["BUILD_BLOG_FOUNDATION"],
  },
  {
    key: "seo_health",
    label: "SEO health check & fixes",
    description: "Technical SEO, sitemap, indexability, and structured data.",
    defaultPeriodDays: 7,
    actionTypes: [
      "FIX_TECHNICAL_SEO",
      "UPDATE_SITEMAP",
      "IMPROVE_INDEXABILITY",
      "ADD_STRUCTURED_DATA",
    ],
  },
];

export function getWorkProgramDefinition(key: WorkProgramKey): WorkProgramDefinition {
  const found = WORK_PROGRAM_CATALOG.find((p) => p.key === key);
  if (!found) throw new Error(`Unknown work program: ${key}`);
  return found;
}

export function actionTypesForPrograms(keys: WorkProgramKey[]): SeoActionType[] {
  const set = new Set<SeoActionType>();
  for (const key of keys) {
    for (const type of getWorkProgramDefinition(key).actionTypes) {
      set.add(type);
    }
  }
  return [...set];
}

export function programKeyForActionType(actionType: SeoActionType): WorkProgramKey | null {
  for (const program of WORK_PROGRAM_CATALOG) {
    if (program.actionTypes.includes(actionType)) return program.key;
  }
  return null;
}

export function derivePrimarySeoGoal(inputs: WorkProgramInput[]): string {
  const labels = inputs
    .filter((p) => p.enabled)
    .map((p) => getWorkProgramDefinition(p.programKey).label);
  if (labels.length === 0) return "SEO continuous improvement";
  return labels.join("; ");
}

export function defaultWorkProgramInputs(): WorkProgramInput[] {
  return WORK_PROGRAM_CATALOG.map((p) => ({
    programKey: p.key,
    // First-run / onboarding defaults: new posts when a blog exists, else technical SEO.
    // improve_content is opt-in so free sample PRs are not stuck on title/description patches.
    enabled: p.key === "seo_health" || p.key === "publish_posts",
    periodDays: p.defaultPeriodDays,
  }));
}

export function periodLabel(days: PeriodDays): string {
  if (days === 3) return "Every 3 days";
  if (days === 7) return "Every week";
  if (days === 14) return "Every 2 weeks";
  return "Every month";
}

export type PathClass = "allowed" | "review_required" | "protected";

const DEFAULT_PROTECTED = [
  /^\.env/,
  /(^|\/)\.git\//,
  /secrets?\./i,
  /credentials/i,
  /(^|\/)auth\//i,
  /middleware\.ts$/,
  /next\.config\./,
  /vercel\.json$/,
  /\.github\/workflows\//,
];

const DEFAULT_REVIEW = [
  /package\.json$/,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /tsconfig.*\.json$/,
  /(^|\/)app\/layout\.tsx$/,
  /(^|\/)app\/globals\.css$/,
];

const DEFAULT_ALLOWED = [
  /(^|\/)content\//,
  /(^|\/)app\/blog\//,
  /(^|\/)posts\//,
  /(^|\/)mdx?\//,
  /sitemap\.ts$/,
  /robots\.ts$/,
  /rss\.xml/,
  /(^|\/)public\/robots\.txt$/,
];

export function classifyPath(
  path: string,
  overrides?: {
    allowedPaths?: string[];
    reviewRequiredPaths?: string[];
    protectedPaths?: string[];
  },
): PathClass {
  const normalized = path.replace(/\\/g, "/");

  const protectedGlobs = [
    ...DEFAULT_PROTECTED,
    ...(overrides?.protectedPaths ?? []).map(globToRegExp),
  ];
  if (protectedGlobs.some((re) => re.test(normalized))) return "protected";

  const reviewGlobs = [
    ...DEFAULT_REVIEW,
    ...(overrides?.reviewRequiredPaths ?? []).map(globToRegExp),
  ];
  if (reviewGlobs.some((re) => re.test(normalized))) return "review_required";

  const allowedGlobs = [
    ...DEFAULT_ALLOWED,
    ...(overrides?.allowedPaths ?? []).map(globToRegExp),
  ];
  if (allowedGlobs.some((re) => re.test(normalized))) return "allowed";

  return "review_required";
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

export function assertPathsSafeForAutoMerge(paths: string[]): {
  ok: boolean;
  violations: { path: string; classification: PathClass }[];
} {
  const violations = paths
    .map((path) => ({ path, classification: classifyPath(path) }))
    .filter((v) => v.classification !== "allowed");
  return { ok: violations.length === 0, violations };
}

export const SAFE_AUTO_MERGE_ACTIONS = new Set([
  "IMPROVE_TITLE_DESCRIPTION",
  "ADD_INTERNAL_LINKS",
  "UPDATE_SITEMAP",
  "ADD_STRUCTURED_DATA",
  "FIX_TECHNICAL_SEO",
  "IMPROVE_INDEXABILITY",
]);

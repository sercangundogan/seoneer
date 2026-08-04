import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  getFileContent,
  getRepoTreePaths,
} from "@/modules/github/client";
import { getInstallationForProject, getProjectRepository } from "@/modules/projects/service";
import {
  buildHeuristicIntelligence,
  type RepoAnalysisSummary,
} from "@/modules/repo-analysis/heuristic";

export type { RepoAnalysisSummary };
export { buildHeuristicIntelligence };

const PRIORITY_FILES = [
  "package.json",
  "README.md",
  "readme.md",
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/page.tsx",
  "src/app/page.tsx",
  "app/sitemap.ts",
  "src/app/sitemap.ts",
  "app/robots.ts",
  "src/app/robots.ts",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
];

function detectPackageManager(paths: string[]): string {
  if (paths.includes("pnpm-lock.yaml")) return "pnpm";
  if (paths.includes("yarn.lock")) return "yarn";
  if (paths.includes("bun.lockb") || paths.includes("bun.lock")) return "bun";
  if (paths.includes("package-lock.json")) return "npm";
  return "unknown";
}

function detectBlogDirs(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    if (/(^|\/)(content\/blog|app\/blog|src\/app\/blog|posts|content\/posts)\//.test(p)) {
      const parts = p.split("/");
      const idx = parts.findIndex((x) => ["blog", "posts"].includes(x));
      if (idx >= 0) dirs.add(parts.slice(0, idx + 1).join("/"));
    }
  }
  return [...dirs];
}

export async function analyseRepository(projectId: string): Promise<RepoAnalysisSummary> {
  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) throw new Error("Repository not connected");

  const cached = await db.query.cachedRepoSummaries.findFirst({
    where: eq(schema.cachedRepoSummaries.projectId, projectId),
  });

  const { sha, paths } = await getRepoTreePaths({
    installationId: installation.installationId,
    owner: repo.owner,
    repo: repo.name,
    ref: repo.defaultBranch,
  });

  if (cached && cached.commitSha === sha) {
    return cached.summary as RepoAnalysisSummary;
  }

  const contentFiles = paths.filter((p) => /\.(md|mdx)$/i.test(p)).slice(0, 40);
  const toRead = [
    ...PRIORITY_FILES.filter((p) => paths.includes(p)),
    ...contentFiles.slice(0, 8),
  ];

  const files: Record<string, string> = {};
  for (const path of toRead) {
    const content = await getFileContent({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      path,
      ref: repo.defaultBranch,
    });
    if (content) files[path] = content.slice(0, 20_000);
  }

  const directoryMap = [...new Set(paths.map((p) => p.split("/").slice(0, 2).join("/")))].sort();
  const blogDirectories = detectBlogDirs(paths);

  const summary: RepoAnalysisSummary = {
    commitSha: sha,
    paths: paths.slice(0, 2000),
    directoryMap,
    files,
    detected: {
      framework: paths.some((p) => p.includes("app/")) ? "next-app-router" : "unknown",
      packageManager: detectPackageManager(paths),
      blogDirectories,
      contentFiles,
      hasSitemap: paths.some((p) => /sitemap\.(ts|js|xml)$/.test(p)),
      hasRobots: paths.some((p) => /robots\.(ts|js|txt)$/.test(p)),
    },
  };

  const existingSame = await db.query.cachedRepoSummaries.findFirst({
    where: eq(schema.cachedRepoSummaries.projectId, projectId),
  });
  if (!existingSame || existingSame.commitSha !== sha) {
    await db.insert(schema.cachedRepoSummaries).values({ projectId, commitSha: sha, summary });
  }

  return summary;
}

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  getFileContent,
  getRepoTreePaths,
} from "@/modules/github/client";
import { getInstallationForProject, getProjectRepository } from "@/modules/projects/service";
import {
  buildHeuristicIntelligence,
  detectAppRoot,
  detectSitemapArtifact,
  detectRobotsArtifact,
  detectLayoutFeatures,
  detectNextSitemapPackage,
  detectBlogDirs,
  detectPackageManager,
  type RepoAnalysisSummary,
} from "@/modules/repo-analysis/heuristic";

export type { RepoAnalysisSummary };
export { buildHeuristicIntelligence };

const PRIORITY_FILES = [
  "package.json",
  "README.md",
  "readme.md",
  // Layouts — needed for metadata / OG / JSON-LD detection
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/layout.ts",
  "src/app/layout.ts",
  // Home pages
  "app/page.tsx",
  "src/app/page.tsx",
  // Next.js Metadata Routes
  "app/sitemap.ts",
  "src/app/sitemap.ts",
  "app/sitemap.js",
  "src/app/sitemap.js",
  "app/robots.ts",
  "src/app/robots.ts",
  "app/robots.js",
  "src/app/robots.js",
  // Static SEO files
  "public/robots.txt",
  "public/sitemap.xml",
  "public/sitemap_index.xml",
  // Third-party sitemap configs
  "next-sitemap.config.js",
  "next-sitemap.config.ts",
  "next-sitemap.config.mjs",
  // Next.js config
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
];

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
  const sitemap = detectSitemapArtifact(paths, files);
  const robots = detectRobotsArtifact(paths);
  const layout = detectLayoutFeatures(files);

  const summary: RepoAnalysisSummary = {
    commitSha: sha,
    paths: paths.slice(0, 2000),
    directoryMap,
    files,
    detected: {
      framework: detectAppRoot(paths) ? "next-app-router" : "unknown",
      packageManager: detectPackageManager(paths),
      blogDirectories,
      contentFiles,
      hasSitemap: sitemap.kind !== "none",
      hasRobots: robots.kind !== "none",
      appRoot: detectAppRoot(paths),
      sitemap,
      robots,
      layout,
      hasNextSitemapPackage: detectNextSitemapPackage(files),
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

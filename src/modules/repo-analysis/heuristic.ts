export type RepoAnalysisSummary = {
  commitSha: string;
  paths: string[];
  directoryMap: string[];
  files: Record<string, string>;
  detected: {
    framework: string;
    packageManager: string;
    blogDirectories: string[];
    contentFiles: string[];
    hasSitemap: boolean;
    hasRobots: boolean;
  };
};

export function buildHeuristicIntelligence(
  summary: RepoAnalysisSummary,
  projectName: string,
): import("@/modules/intelligence/schemas").ProjectIntelligenceProfile {
  const pkg = summary.files["package.json"];
  let pkgJson: { name?: string; dependencies?: Record<string, string> } = {};
  try {
    pkgJson = pkg ? JSON.parse(pkg) : {};
  } catch {
    pkgJson = {};
  }
  const readme = summary.files["README.md"] ?? summary.files["readme.md"] ?? "";
  const blogExists = summary.detected.blogDirectories.length > 0;
  const issues: string[] = [];
  if (!summary.detected.hasSitemap) issues.push("Missing sitemap implementation");
  if (!summary.detected.hasRobots) issues.push("Missing robots configuration");
  if (!blogExists) issues.push("No blog directory detected");

  return {
    product: {
      name: pkgJson.name ?? projectName,
      summary: readme.slice(0, 400) || `Software project ${projectName}`,
      problems: [],
      features: Object.keys(pkgJson.dependencies ?? {}).slice(0, 12),
      audiences: ["software teams"],
      useCases: [],
      conversionGoals: ["signup"],
      markets: ["global"],
      languages: ["en"],
      confidence: readme ? 0.55 : 0.35,
    },
    brand: {
      tone: ["clear", "technical"],
      writingPatterns: [],
      visualPatterns: [],
      avoid: ["hype", "unverified claims"],
      evidence: readme ? ["README.md"] : [],
    },
    technology: {
      framework: summary.detected.framework,
      frameworkVersion: pkgJson.dependencies?.next ?? "unknown",
      language: "TypeScript",
      packageManager: summary.detected.packageManager,
      deployment: "vercel-likely",
      contentSystem: blogExists ? "markdown-mdx" : "unknown",
      evidence: ["package.json", ...summary.detected.blogDirectories],
    },
    website: {
      routes: summary.directoryMap.filter((d) => d.startsWith("app") || d.startsWith("src/app")),
      commercialPages: [],
      contentPages: summary.detected.contentFiles.slice(0, 20),
      blogExists,
      blogDirectory: summary.detected.blogDirectories[0] ?? null,
      contentFormat: blogExists ? "mdx" : null,
    },
    seo: {
      metadata: {},
      sitemap: { present: summary.detected.hasSitemap },
      robots: { present: summary.detected.hasRobots },
      canonical: {},
      structuredData: {},
      openGraph: {},
      rss: {},
      analytics: {},
      issues,
      opportunities: blogExists
        ? ["Improve existing article metadata", "Add internal links"]
        : ["BUILD_BLOG_FOUNDATION"],
    },
    codeSafety: {
      allowedPaths: summary.detected.blogDirectories.map((d) => `${d}/**`),
      reviewRequiredPaths: ["package.json", "app/layout.tsx", "src/app/layout.tsx"],
      protectedPaths: [".env*", "**/auth/**", ".github/workflows/**"],
      recommendedChangeStrategy:
        "Create feature branches and PRs; prefer MD/MDX content paths; never write default branch.",
    },
    unknowns: ["Target audience confirmation", "Primary conversion action"],
    userConfirmationRequired: ["product.summary", "product.audiences", "product.conversionGoals"],
    decisionSummary: `Analysed repository at ${summary.commitSha.slice(0, 7)}. Framework=${summary.detected.framework}, blog=${blogExists}.`,
  };
}

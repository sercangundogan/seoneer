export type SeoArtifactKind =
  | "metadata-route" // Next.js app/sitemap.ts or robots.ts Metadata Route
  | "static-file" // public/sitemap.xml or public/robots.txt
  | "next-sitemap-pkg" // third-party next-sitemap package
  | "api-route" // custom API route serving sitemap/robots
  | "none";

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
    /** @deprecated use sitemap.kind !== "none" */
    hasSitemap: boolean;
    /** @deprecated use robots.kind !== "none" */
    hasRobots: boolean;
    appRoot: "app" | "src/app" | null;
    sitemap: {
      kind: SeoArtifactKind;
      path: string | null;
      /** True when sitemap only contains the homepage URL with no dynamic route enumeration */
      isHomepageOnly: boolean;
      hasGenerateSitemaps: boolean;
    };
    robots: {
      kind: SeoArtifactKind;
      path: string | null;
    };
    layout: {
      path: string | null;
      hasMetadataExport: boolean;
      hasGenerateMetadata: boolean;
      hasOpenGraph: boolean;
      hasTwitterCard: boolean;
      hasCanonical: boolean;
      hasJsonLd: boolean;
    };
    hasNextSitemapPackage: boolean;
  };
};

export function detectAppRoot(paths: string[]): "app" | "src/app" | null {
  if (paths.some((p) => p.startsWith("src/app/"))) return "src/app";
  if (paths.some((p) => p.startsWith("app/") && !p.startsWith("app/api/"))) return "app";
  return null;
}

export function detectSitemapArtifact(
  paths: string[],
  files: Record<string, string>,
): RepoAnalysisSummary["detected"]["sitemap"] {
  // Next.js Metadata Routes (preferred)
  const metadataRoutes = [
    "app/sitemap.ts",
    "app/sitemap.js",
    "src/app/sitemap.ts",
    "src/app/sitemap.js",
  ];
  for (const p of metadataRoutes) {
    if (paths.includes(p)) {
      const content = files[p] ?? "";
      // Homepage-only if: at most one `url:` entry, no loop/spread, no generateSitemaps
      const urlMatches = content.match(/\burl\s*:/g)?.length ?? 0;
      const hasDynamic =
        content.includes("generateSitemaps") ||
        /\.map\s*\(|\.flatMap\s*\(|for\s*\(|for\s+of/.test(content) ||
        /getContent|getPosts|getPages|fetchRoutes/.test(content);
      const isHomepageOnly = urlMatches <= 1 && !hasDynamic;
      return {
        kind: "metadata-route",
        path: p,
        isHomepageOnly,
        hasGenerateSitemaps: /export\s+(async\s+)?function\s+generateSitemaps/.test(content),
      };
    }
  }

  // API route sitemaps (app/api/sitemap or sitemap/route)
  const apiSitemapPath = paths.find(
    (p) =>
      /sitemap\/(route|index)\.(ts|js|tsx|jsx)$/.test(p) ||
      /api\/sitemap\.(ts|js)$/.test(p) ||
      /pages\/api\/sitemap/.test(p),
  );
  if (apiSitemapPath) {
    return { kind: "api-route", path: apiSitemapPath, isHomepageOnly: false, hasGenerateSitemaps: false };
  }

  // Static public file
  const staticPath = ["public/sitemap.xml", "public/sitemap_index.xml", "public/sitemap-0.xml"].find(
    (p) => paths.includes(p),
  );
  if (staticPath) {
    const content = files[staticPath] ?? "";
    const urlCount = (content.match(/<loc>/g) ?? []).length;
    return {
      kind: "static-file",
      path: staticPath,
      isHomepageOnly: urlCount <= 1,
      hasGenerateSitemaps: false,
    };
  }

  return { kind: "none", path: null, isHomepageOnly: false, hasGenerateSitemaps: false };
}

export function detectRobotsArtifact(paths: string[]): RepoAnalysisSummary["detected"]["robots"] {
  const metadataRoutes = [
    "app/robots.ts",
    "app/robots.js",
    "src/app/robots.ts",
    "src/app/robots.js",
  ];
  for (const p of metadataRoutes) {
    if (paths.includes(p)) return { kind: "metadata-route", path: p };
  }
  if (paths.includes("public/robots.txt")) return { kind: "static-file", path: "public/robots.txt" };
  return { kind: "none", path: null };
}

export const ROOT_LAYOUT_CANDIDATES = [
  "src/app/layout.tsx",
  "src/app/layout.ts",
  "src/app/layout.jsx",
  "src/app/layout.js",
  "app/layout.tsx",
  "app/layout.ts",
  "app/layout.jsx",
  "app/layout.js",
] as const;

export function detectLayoutFeatures(
  files: Record<string, string>,
  paths: string[] = [],
): RepoAnalysisSummary["detected"]["layout"] {
  const emptyFeatures = {
    hasMetadataExport: false,
    hasGenerateMetadata: false,
    hasOpenGraph: false,
    hasTwitterCard: false,
    hasCanonical: false,
    hasJsonLd: false,
  };

  const analyze = (path: string, content: string) => ({
    path,
    hasMetadataExport: /export\s+(const|let|var)\s+metadata\s*[=:]/.test(content),
    hasGenerateMetadata: /export\s+(async\s+)?function\s+generateMetadata/.test(content),
    hasOpenGraph: /openGraph\s*[=:{]|og:image|og:title|og:description/.test(content),
    hasTwitterCard: /twitter\s*[:{]|twitter:card|twitter:title/.test(content),
    hasCanonical: /canonical/.test(content),
    hasJsonLd:
      /application\/ld\+json|jsonLd|JsonLd|json-ld|"@type"\s*:/i.test(content) ||
      /structured.*data|schema\.org/i.test(content),
  });

  // Prefer candidates we already read
  for (const p of ROOT_LAYOUT_CANDIDATES) {
    const content = files[p];
    if (content) return analyze(p, content);
  }

  // Path present in tree but not yet read — still record location
  for (const p of ROOT_LAYOUT_CANDIDATES) {
    if (paths.includes(p)) return { path: p, ...emptyFeatures };
  }

  const found = paths.find((p) => /^(src\/)?app\/layout\.(tsx|ts|jsx|js)$/.test(p));
  if (found) return { path: found, ...emptyFeatures };

  return { path: null, ...emptyFeatures };
}

export function detectNextSitemapPackage(files: Record<string, string>): boolean {
  const pkg = files["package.json"];
  if (!pkg) return false;
  try {
    const parsed = JSON.parse(pkg) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return (
      "next-sitemap" in (parsed.dependencies ?? {}) ||
      "next-sitemap" in (parsed.devDependencies ?? {})
    );
  } catch {
    return false;
  }
}

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

  const sitemap = summary.detected.sitemap;
  const robots = summary.detected.robots;
  const layout = summary.detected.layout;

  const issues: string[] = [];

  // Sitemap issues
  if (sitemap.kind === "none") {
    issues.push("Missing sitemap — create a Next.js sitemap.ts Metadata Route at the app root");
  } else if (sitemap.isHomepageOnly) {
    issues.push("Sitemap only indexes the homepage — expand to include all content and key routes");
  }

  // Robots issues
  if (robots.kind === "none") {
    issues.push("Missing robots configuration — create a Next.js robots.ts Metadata Route");
  }

  // Metadata / Open Graph issues
  if (!layout.hasMetadataExport && !layout.hasGenerateMetadata) {
    issues.push(
      "Root layout lacks a metadata export — add title, description, and Open Graph tags",
    );
  } else {
    if (!layout.hasOpenGraph) {
      issues.push(
        "Missing Open Graph tags in root layout (og:title, og:description, og:image) — required for social sharing",
      );
    }
    if (!layout.hasTwitterCard) {
      issues.push("Missing Twitter/X Card metadata in root layout — add twitter:card and twitter:title");
    }
    if (!layout.hasCanonical && blogExists) {
      issues.push(
        "Missing canonical URL configuration — prevents duplicate content penalties on paginated or parameterised routes",
      );
    }
  }

  // Structured data
  if (!layout.hasJsonLd) {
    issues.push(
      "Missing structured data (JSON-LD) — add Organization and WebSite schema to root layout for rich results",
    );
  }

  // Blog
  if (!blogExists) {
    issues.push("No blog directory detected — content marketing requires a publishing structure");
  }

  const opportunities: string[] = [];
  if (blogExists) {
    opportunities.push("Improve existing article metadata and headings");
    opportunities.push("Add internal links between topically related articles");
    if (sitemap.isHomepageOnly) {
      opportunities.push("Update sitemap to include all indexed content pages");
    }
  }
  if (layout.hasMetadataExport || layout.hasGenerateMetadata) {
    opportunities.push("Expand metadata with richer per-page overrides and social images");
  }

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
      metadata: layout.path
        ? {
            present: layout.hasMetadataExport || layout.hasGenerateMetadata,
            path: layout.path,
            hasOpenGraph: layout.hasOpenGraph,
            hasTwitterCard: layout.hasTwitterCard,
            hasCanonical: layout.hasCanonical,
          }
        : { present: false },
      sitemap: {
        kind: sitemap.kind,
        path: sitemap.path,
        present: sitemap.kind !== "none",
        isHomepageOnly: sitemap.isHomepageOnly,
        hasGenerateSitemaps: sitemap.hasGenerateSitemaps,
      },
      robots: {
        kind: robots.kind,
        path: robots.path,
        present: robots.kind !== "none",
      },
      canonical: { present: layout.hasCanonical },
      structuredData: { present: layout.hasJsonLd },
      openGraph: { present: layout.hasOpenGraph },
      rss: {},
      analytics: {},
      issues,
      opportunities,
    },
    codeSafety: {
      allowedPaths: summary.detected.blogDirectories.map((d) => `${d}/**`),
      reviewRequiredPaths: [
        "package.json",
        "app/layout.tsx",
        "src/app/layout.tsx",
        layout.path ?? "app/layout.tsx",
      ].filter(Boolean),
      protectedPaths: [".env*", "**/auth/**", ".github/workflows/**"],
      recommendedChangeStrategy:
        "Create feature branches and PRs; prefer MD/MDX content paths; never write to default branch.",
    },
    unknowns: ["Target audience confirmation", "Primary conversion action"],
    userConfirmationRequired: ["product.summary", "product.audiences", "product.conversionGoals"],
    decisionSummary: `Analysed repository at ${summary.commitSha.slice(0, 7)}. Framework=${summary.detected.framework}, blog=${blogExists}, sitemap=${sitemap.kind}${sitemap.isHomepageOnly ? "(homepage-only)" : ""}, robots=${robots.kind}, ogTags=${layout.hasOpenGraph}, jsonLd=${layout.hasJsonLd}.`,
  };
}

// Re-export detectBlogDirs for use in service.ts
export { detectBlogDirs, detectPackageManager };

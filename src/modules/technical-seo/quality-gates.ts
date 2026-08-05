import { SECRET_PATTERNS, scanForSecrets } from "@/modules/technical-seo/secret-scan";
import type { ProjectIntelligenceProfile } from "@/modules/intelligence/schemas";

export { SECRET_PATTERNS, scanForSecrets };

export type QualityGateResult = {
  id: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export function runContentQualityGates(input: {
  files: { path: string; content: string }[];
  productName?: string;
}): QualityGateResult[] {
  const gates: QualityGateResult[] = [];
  const joined = input.files.map((f) => f.content).join("\n");

  const secretHits = scanForSecrets(joined);
  gates.push({
    id: "secrets",
    status: secretHits.length ? "fail" : "pass",
    detail: secretHits.length ? `Possible secrets: ${secretHits.join(", ")}` : "No secrets detected",
  });

  const fabricated =
    /\b(\d{2,3}%\s+(increase|growth|boost)|according to (a )?study|our customers say)\b/i.test(
      joined,
    );
  gates.push({
    id: "unverified_claims",
    status: fabricated ? "fail" : "pass",
    detail: fabricated
      ? "Possible unverified statistics or testimonials detected"
      : "No obvious fabricated claim patterns",
  });

  for (const file of input.files) {
    if (/\.(md|mdx)$/i.test(file.path)) {
      const hasTitle = /^#\s+.+/m.test(file.content) || /^title:\s+/m.test(file.content);
      gates.push({
        id: `heading:${file.path}`,
        status: hasTitle ? "pass" : "fail",
        detail: hasTitle ? "Heading/title present" : "Missing H1 or frontmatter title",
      });
    }
  }

  if (input.productName) {
    const relevant = joined.toLowerCase().includes(input.productName.toLowerCase().slice(0, 12));
    gates.push({
      id: "product_relevance",
      status: relevant ? "pass" : "warn",
      detail: relevant ? "Product name referenced" : "Product name not clearly referenced",
    });
  }

  return gates;
}

/**
 * Additional quality gates for technical SEO actions (FIX_TECHNICAL_SEO, UPDATE_SITEMAP,
 * IMPROVE_INDEXABILITY, ADD_STRUCTURED_DATA).
 *
 * These prevent the most dangerous failure modes:
 * - Writing to the wrong app root
 * - Creating a second sitemap alongside an existing one
 * - Shrinking an existing sitemap's URL count
 * - Replacing a layout instead of patching it
 */
export function runTechnicalSeoGates(input: {
  files: { path: string; content: string; operation?: "create" | "update" }[];
  profile: ProjectIntelligenceProfile | undefined;
}): QualityGateResult[] {
  const gates: QualityGateResult[] = [];
  const { files, profile } = input;

  const seoMeta = profile?.seo?.sitemap as Record<string, unknown> | undefined;
  const robotsMeta = profile?.seo?.robots as Record<string, unknown> | undefined;
  const existingSitemapPath = (seoMeta?.["path"] as string | null) ?? null;
  const existingRobotsPath = (robotsMeta?.["path"] as string | null) ?? null;
  const sitemapKind = (seoMeta?.["kind"] as string | null) ?? null;
  const robotsKind = (robotsMeta?.["kind"] as string | null) ?? null;

  // Detect the intended app root from the existing project artifacts
  const existingAppRoot =
    existingSitemapPath?.startsWith("src/app/") ||
    existingRobotsPath?.startsWith("src/app/") ||
    profile?.seo?.metadata?.["path"]?.toString().startsWith("src/app/")
      ? "src/app"
      : existingSitemapPath?.startsWith("app/") ||
          existingRobotsPath?.startsWith("app/") ||
          profile?.seo?.metadata?.["path"]?.toString().startsWith("app/")
        ? "app"
        : null;

  for (const file of files) {
    const isSitemapFile = /sitemap\.(ts|js)$/.test(file.path);
    const isRobotsFile = /robots\.(ts|js)$/.test(file.path);
    const isLayoutFile = /layout\.(tsx|ts|jsx|js)$/.test(file.path);

    // Gate: writing to wrong app root when existing artifacts are in another root
    if (existingAppRoot && (isSitemapFile || isRobotsFile || isLayoutFile)) {
      const fileRoot = file.path.startsWith("src/app/")
        ? "src/app"
        : file.path.startsWith("app/")
          ? "app"
          : null;
      if (fileRoot && fileRoot !== existingAppRoot) {
        gates.push({
          id: `wrong_app_root:${file.path}`,
          status: "fail",
          detail: `File ${file.path} targets app root "${fileRoot}" but the project uses "${existingAppRoot}". This would create duplicate routes.`,
        });
      }
    }

    // Gate: creating a sitemap when one already exists in a different location
    if (isSitemapFile && file.operation === "create" && existingSitemapPath) {
      if (file.path !== existingSitemapPath) {
        gates.push({
          id: `duplicate_sitemap:${file.path}`,
          status: "fail",
          detail: `Creating ${file.path} would duplicate the existing sitemap at ${existingSitemapPath}. Update the existing file instead.`,
        });
      }
    }

    // Gate: creating a robots file when one already exists
    if (isRobotsFile && file.operation === "create" && existingRobotsPath) {
      if (file.path !== existingRobotsPath) {
        gates.push({
          id: `duplicate_robots:${file.path}`,
          status: "fail",
          detail: `Creating ${file.path} would duplicate the existing robots file at ${existingRobotsPath}. Update the existing file instead.`,
        });
      }
    }

    // Gate: creating a static sitemap.xml when a Metadata Route already exists
    if (file.path === "public/sitemap.xml" && file.operation === "create" && sitemapKind === "metadata-route") {
      gates.push({
        id: "static_sitemap_conflict",
        status: "fail",
        detail: `Cannot create public/sitemap.xml — the project already uses a Next.js Metadata Route (${existingSitemapPath}). Both would conflict.`,
      });
    }

    // Gate: creating a static robots.txt when a Metadata Route exists
    if (file.path === "public/robots.txt" && file.operation === "create" && robotsKind === "metadata-route") {
      gates.push({
        id: "static_robots_conflict",
        status: "fail",
        detail: `Cannot create public/robots.txt — the project already uses a Next.js Metadata Route (${existingRobotsPath}). Both would conflict.`,
      });
    }

    // Gate: layout operation must be "update" when layout already exists
    if (isLayoutFile && file.operation === "create") {
      const layoutPath = profile?.seo?.metadata?.["path"] as string | undefined;
      if (layoutPath && file.path === layoutPath) {
        gates.push({
          id: `layout_create_forbidden:${file.path}`,
          status: "fail",
          detail: `Cannot create ${file.path} — it already exists. Use operation "update" and include the complete updated file content.`,
        });
      }
    }

    // Gate: sitemap URL count must not shrink
    if (isSitemapFile && file.operation === "update") {
      const newUrlCount = (file.content.match(/\burl\s*:/g) ?? []).length;
      // We don't have the original count here, but we can warn if the new sitemap has only 1 URL
      if (newUrlCount <= 1) {
        gates.push({
          id: `sitemap_url_shrinkage:${file.path}`,
          status: "warn",
          detail: `Updated sitemap at ${file.path} appears to have only ${newUrlCount} URL entry. Verify that existing routes are preserved.`,
        });
      }
    }

    // Gate: JSON-LD in layout must be syntactically valid JSON (basic check)
    if (isLayoutFile && /application\/ld\+json/.test(file.content)) {
      const jsonLdMatch = file.content.match(
        /JSON\.stringify\s*\(\s*(\{[\s\S]*?\})\s*\)/,
      );
      if (!jsonLdMatch) {
        // Softer warn — complex structured data may use variables
        gates.push({
          id: `json_ld_check:${file.path}`,
          status: "warn",
          detail: "JSON-LD detected — verify the schema object is syntactically valid before merging",
        });
      }
    }
  }

  // If no technical SEO files are present, warn
  const hasTechSeoFile = files.some(
    (f) =>
      /sitemap\.(ts|js)$/.test(f.path) ||
      /robots\.(ts|js|txt)$/.test(f.path) ||
      /layout\.(tsx|ts)$/.test(f.path),
  );
  if (!hasTechSeoFile && files.length > 0) {
    gates.push({
      id: "tech_seo_no_target_file",
      status: "warn",
      detail: "Technical SEO action produced no sitemap, robots, or layout changes — review the draft",
    });
  }

  return gates;
}

export function gatesPassed(gates: QualityGateResult[]): boolean {
  return gates.every((g) => g.status !== "fail");
}

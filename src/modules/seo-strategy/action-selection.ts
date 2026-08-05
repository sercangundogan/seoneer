import type { ProjectIntelligenceProfile } from "@/modules/intelligence/schemas";
import {
  CREDIT_WEIGHTS,
  type ActionSelection,
  type SeoActionType,
} from "@/modules/seo-strategy/schemas";

export const ESCAPE_ACTION_TYPES: SeoActionType[] = [
  "WAIT_FOR_MORE_DATA",
  "REQUEST_PRODUCT_INFORMATION",
  "NO_ACTION",
];

export function clampSelectionToAllowed(
  selection: ActionSelection,
  allowed: SeoActionType[] | null,
  fallback: () => ActionSelection,
): ActionSelection {
  if (!allowed || allowed.length === 0) return selection;
  const ok = new Set<SeoActionType>([...allowed, ...ESCAPE_ACTION_TYPES]);
  if (ok.has(selection.selected.actionType)) return selection;
  return fallback();
}

/** Read the seo.sitemap record safely — handles both old boolean shape and new structured shape. */
function readSeoRecord(record: Record<string, unknown>): {
  kind?: string;
  present?: boolean;
  isHomepageOnly?: boolean;
  path?: string;
  hasOpenGraph?: boolean;
  hasTwitterCard?: boolean;
  hasCanonical?: boolean;
} {
  return record as {
    kind?: string;
    present?: boolean;
    isHomepageOnly?: boolean;
    path?: string;
    hasOpenGraph?: boolean;
    hasTwitterCard?: boolean;
    hasCanonical?: boolean;
  };
}

export function heuristicSelectAction(
  profile: ProjectIntelligenceProfile | undefined,
  findings: unknown,
  allowed: SeoActionType[] | null = null,
): ActionSelection {
  const f = (findings ?? {}) as {
    technical?: string[];
    gscConnected?: boolean;
    keywordOpportunities?: { query: string; score: number }[];
  };

  const can = (type: SeoActionType) =>
    !allowed || allowed.length === 0 || allowed.includes(type);

  // --- Blog foundation ---
  if (!profile?.website.blogExists && can("BUILD_BLOG_FOUNDATION")) {
    return {
      candidates: [
        { actionType: "BUILD_BLOG_FOUNDATION", score: 88, rationale: "No blog detected" },
        { actionType: "NO_ACTION", score: 10, rationale: "Idle" },
      ],
      selected: {
        actionType: "BUILD_BLOG_FOUNDATION",
        target: "content/blog",
        primaryQueryOrIssue: "Missing blog foundation",
        whyNow: "Cannot publish sustainable organic content without a blog structure",
        evidence: ["website.blogExists=false"],
        expectedUserValue: "Readable, indexable articles in a clear content directory",
        expectedBusinessValue: "Enables all future high-value content actions",
        requiredRepositoryChanges: ["Add content/blog directory and a starter MDX post"],
        requiredResearch: [],
        risks: ["Touches app routing — human review mandatory"],
        confidence: 0.75,
        qualityGates: ["build", "path_policy"],
        estimatedCreditCost: CREDIT_WEIGHTS.BUILD_BLOG_FOUNDATION,
        humanReviewMandatory: true,
      },
      decisionSummary:
        "Selected BUILD_BLOG_FOUNDATION because no blog architecture was detected.",
    };
  }

  // --- Technical SEO: FIX critical foundations ---
  if (can("FIX_TECHNICAL_SEO") && f.technical?.length) {
    const issues = f.technical;
    // Critical: missing sitemap or robots
    const missingSitemap = issues.find((i) => /missing sitemap/i.test(i));
    const missingRobots = issues.find((i) => /missing robots/i.test(i));
    const missingMetadata = issues.find((i) => /layout lacks.*metadata|missing.*metadata/i.test(i));

    if (missingSitemap || missingRobots || missingMetadata) {
      const primaryIssue = missingSitemap ?? missingRobots ?? missingMetadata ?? issues[0];
      const changes: string[] = [];
      if (missingSitemap) changes.push("Create sitemap.ts Metadata Route at app root");
      if (missingRobots) changes.push("Create robots.ts Metadata Route at app root");
      if (missingMetadata) changes.push("Add metadata export to root layout");

      return {
        candidates: [
          {
            actionType: "FIX_TECHNICAL_SEO",
            score: 85,
            rationale: "Critical SEO foundations are missing",
          },
        ],
        selected: {
          actionType: "FIX_TECHNICAL_SEO",
          target: primaryIssue,
          primaryQueryOrIssue: primaryIssue,
          whyNow: "Missing technical foundations block all crawler and indexing signals",
          evidence: issues.map((i) => `issue: ${i}`),
          expectedUserValue: "Correct indexing signals for all site pages",
          expectedBusinessValue: "Enables organic discovery; prerequisite for all other SEO work",
          requiredRepositoryChanges: changes,
          requiredResearch: [],
          risks: ["Touches site-wide config — human review mandatory"],
          confidence: 0.8,
          qualityGates: ["no_overwrite_existing", "correct_app_root", "metadata", "build"],
          estimatedCreditCost: CREDIT_WEIGHTS.FIX_TECHNICAL_SEO,
          humanReviewMandatory: true,
        },
        decisionSummary: `Selected FIX_TECHNICAL_SEO to address: ${primaryIssue}.`,
      };
    }
  }

  // --- Technical SEO: UPDATE_SITEMAP when sitemap is homepage-only ---
  if (can("UPDATE_SITEMAP")) {
    const sitemapRecord = profile?.seo?.sitemap ? readSeoRecord(profile.seo.sitemap as Record<string, unknown>) : null;
    const isThinSitemap =
      sitemapRecord?.isHomepageOnly === true ||
      f.technical?.some((i) => /sitemap.*homepage|sitemap.*thin|expand.*sitemap/i.test(i));

    if (isThinSitemap && sitemapRecord?.path) {
      return {
        candidates: [
          {
            actionType: "UPDATE_SITEMAP",
            score: 78,
            rationale: "Sitemap exists but only indexes the homepage",
          },
          {
            actionType: "FIX_TECHNICAL_SEO",
            score: 55,
            rationale: "Other technical issues may exist",
          },
        ],
        selected: {
          actionType: "UPDATE_SITEMAP",
          target: sitemapRecord.path,
          primaryQueryOrIssue: "Sitemap only indexes the homepage — needs full content route coverage",
          whyNow: "Google cannot discover content pages that are not in the sitemap",
          evidence: [
            `sitemap.path=${sitemapRecord.path}`,
            "sitemap.isHomepageOnly=true",
          ],
          expectedUserValue: "All published content pages are crawlable and indexable",
          expectedBusinessValue: "Content pages can enter Google index and rank for target queries",
          requiredRepositoryChanges: [
            `Update ${sitemapRecord.path} to enumerate all content routes dynamically`,
          ],
          requiredResearch: [],
          risks: ["Must preserve existing sitemap format; never shrink URL list"],
          confidence: 0.78,
          qualityGates: ["no_url_shrinkage", "correct_app_root", "build"],
          estimatedCreditCost: CREDIT_WEIGHTS.UPDATE_SITEMAP,
          humanReviewMandatory: true,
        },
        decisionSummary: `Selected UPDATE_SITEMAP to expand homepage-only sitemap at ${sitemapRecord.path}.`,
      };
    }
  }

  // --- Technical SEO: IMPROVE_INDEXABILITY when OG/canonical missing ---
  if (can("IMPROVE_INDEXABILITY")) {
    const layoutRecord = profile?.seo?.metadata
      ? readSeoRecord(profile.seo.metadata as Record<string, unknown>)
      : null;
    const missingOg = !layoutRecord?.hasOpenGraph;
    const missingOgIssue = f.technical?.find((i) => /open graph|og:/i.test(i));
    const canonicalIssue = f.technical?.find((i) => /canonical/i.test(i));
    const twitterIssue = f.technical?.find((i) => /twitter|x card/i.test(i));

    if (missingOg || missingOgIssue || canonicalIssue || twitterIssue) {
      const issues = [missingOgIssue, canonicalIssue, twitterIssue].filter(Boolean) as string[];
      const primaryIssue =
        missingOgIssue ?? canonicalIssue ?? twitterIssue ?? "Missing Open Graph tags";
      const layoutPath = (layoutRecord?.path as string | undefined) ?? null;

      return {
        candidates: [
          {
            actionType: "IMPROVE_INDEXABILITY",
            score: 72,
            rationale: "Open Graph and social sharing metadata is missing",
          },
        ],
        selected: {
          actionType: "IMPROVE_INDEXABILITY",
          target: layoutPath ?? "root layout",
          primaryQueryOrIssue: primaryIssue,
          whyNow:
            "Missing OG/canonical metadata reduces social sharing effectiveness and risks duplicate content signals",
          evidence: issues.length ? issues.map((i) => `issue: ${i}`) : ["layout.hasOpenGraph=false"],
          expectedUserValue: "Correct rich previews when pages are shared on social platforms",
          expectedBusinessValue:
            "Better CTR from social sharing; canonical prevents duplicate content penalties",
          requiredRepositoryChanges: [
            `Update ${layoutPath ?? "root layout"} to add og:title, og:description, og:image, twitter:card`,
          ],
          requiredResearch: [],
          risks: ["Must preserve existing metadata fields — only add missing fields"],
          confidence: 0.7,
          qualityGates: ["preserves_existing_metadata", "build"],
          estimatedCreditCost: CREDIT_WEIGHTS.IMPROVE_INDEXABILITY,
          humanReviewMandatory: true,
        },
        decisionSummary: `Selected IMPROVE_INDEXABILITY to add missing Open Graph and social metadata.`,
      };
    }
  }

  // --- Technical SEO: ADD_STRUCTURED_DATA when JSON-LD missing ---
  if (can("ADD_STRUCTURED_DATA")) {
    const structuredDataRecord = profile?.seo?.structuredData
      ? readSeoRecord(profile.seo.structuredData as Record<string, unknown>)
      : null;
    const jsonLdIssue = f.technical?.find((i) => /json.?ld|structured data|schema/i.test(i));
    const missingJsonLd =
      structuredDataRecord?.present === false ||
      jsonLdIssue !== undefined;

    if (missingJsonLd) {
      const layoutPath = profile?.seo?.metadata
        ? (readSeoRecord(profile.seo.metadata as Record<string, unknown>).path as string | undefined)
        : null;

      return {
        candidates: [
          {
            actionType: "ADD_STRUCTURED_DATA",
            score: 68,
            rationale: "JSON-LD structured data is absent",
          },
        ],
        selected: {
          actionType: "ADD_STRUCTURED_DATA",
          target: layoutPath ?? "root layout",
          primaryQueryOrIssue: jsonLdIssue ?? "Missing JSON-LD structured data",
          whyNow:
            "Structured data enables rich results in Google Search (site links, breadcrumbs, FAQs)",
          evidence: [
            jsonLdIssue ? `issue: ${jsonLdIssue}` : "seo.structuredData.present=false",
          ],
          expectedUserValue: "Richer, more informative search result snippets",
          expectedBusinessValue:
            "Rich results can significantly increase CTR; Organization schema builds entity authority",
          requiredRepositoryChanges: [
            `Update ${layoutPath ?? "root layout"} to add Organization and WebSite JSON-LD`,
          ],
          requiredResearch: [],
          risks: ["Must not break existing layout rendering"],
          confidence: 0.68,
          qualityGates: ["valid_json_ld", "build"],
          estimatedCreditCost: CREDIT_WEIGHTS.ADD_STRUCTURED_DATA,
          humanReviewMandatory: true,
        },
        decisionSummary: `Selected ADD_STRUCTURED_DATA to add Organization/WebSite JSON-LD schema.`,
      };
    }
  }

  // --- Content: CREATE_ARTICLE ---
  if (can("CREATE_ARTICLE") && (profile?.website.blogExists || !can("BUILD_BLOG_FOUNDATION"))) {
    return {
      candidates: [
        { actionType: "CREATE_ARTICLE", score: 74, rationale: "Publishing program in scope" },
        ...(can("FIX_TECHNICAL_SEO")
          ? [{ actionType: "FIX_TECHNICAL_SEO" as const, score: 55, rationale: "Technical SEO also available" }]
          : []),
      ],
      selected: {
        actionType: "CREATE_ARTICLE",
        target: "content/blog",
        primaryQueryOrIssue: f.keywordOpportunities?.[0]?.query ?? "New helpful article",
        whyNow: "Publishing program is scheduled and the repository can accept a new article",
        evidence: [
          "work program: publish_posts",
          profile?.website.blogExists
            ? "website.blogExists=true"
            : "blog foundation not required for this cycle",
        ],
        expectedUserValue: "Fresh, useful content grounded in the product",
        expectedBusinessValue: "Organic discovery for a relevant topic",
        requiredRepositoryChanges: ["Add MDX article to blog directory"],
        requiredResearch: ["Topic brief from keyword opportunities"],
        risks: ["Needs human review before merge"],
        confidence: 0.62,
        qualityGates: ["content_quality", "brand_tone", "no_fabricated_claims"],
        estimatedCreditCost: CREDIT_WEIGHTS.CREATE_ARTICLE,
        humanReviewMandatory: true,
      },
      decisionSummary: "Selected CREATE_ARTICLE because the publishing work program is in scope.",
    };
  }

  // --- Content: IMPROVE_TITLE_DESCRIPTION ---
  if (can("IMPROVE_TITLE_DESCRIPTION")) {
    const topKw = f.keywordOpportunities?.[0];
    return {
      candidates: [
        { actionType: "IMPROVE_TITLE_DESCRIPTION", score: 72, rationale: "Low-risk CTR improvement" },
        ...(can("UPDATE_ARTICLE")
          ? [{ actionType: "UPDATE_ARTICLE" as const, score: 65, rationale: "Existing page improvement" }]
          : []),
      ],
      selected: {
        actionType: "IMPROVE_TITLE_DESCRIPTION",
        target: profile?.website.contentPages[0] ?? "blog",
        primaryQueryOrIssue: topKw?.query ?? "Low CTR pages",
        whyNow: "Improve-content is in scope and metadata refreshes are the safest next step",
        evidence: topKw ? [`gsc query: ${topKw.query}`] : ["content pages present"],
        expectedUserValue: "Clearer snippets in search results",
        expectedBusinessValue: "Potential CTR lift on existing impressions",
        requiredRepositoryChanges: ["Update frontmatter title/description on existing posts"],
        requiredResearch: ["Confirm current metadata before changing"],
        risks: ["Title changes need brand tone check"],
        confidence: 0.68,
        qualityGates: ["metadata", "brand_tone"],
        estimatedCreditCost: 1,
        humanReviewMandatory: false,
      },
      decisionSummary: "Selected IMPROVE_TITLE_DESCRIPTION within the improve-content work program.",
    };
  }

  // --- Content: UPDATE_ARTICLE ---
  if (can("UPDATE_ARTICLE")) {
    return {
      candidates: [
        { actionType: "UPDATE_ARTICLE", score: 68, rationale: "Refresh existing content" },
      ],
      selected: {
        actionType: "UPDATE_ARTICLE",
        target: profile?.website.contentPages[0] ?? "blog",
        primaryQueryOrIssue: f.keywordOpportunities?.[0]?.query ?? "Stale article",
        whyNow: "Improve-content is in scope and an existing page can be strengthened",
        evidence: ["work program: improve_content"],
        expectedUserValue: "Clearer, more complete existing page",
        expectedBusinessValue: "Better relevance on pages that already attract impressions",
        requiredRepositoryChanges: ["Update existing MDX article"],
        requiredResearch: ["Current page gaps"],
        risks: ["Needs human review before merge"],
        confidence: 0.6,
        qualityGates: ["content_quality", "brand_tone"],
        estimatedCreditCost: CREDIT_WEIGHTS.UPDATE_ARTICLE,
        humanReviewMandatory: true,
      },
      decisionSummary: "Selected UPDATE_ARTICLE within the improve-content work program.",
    };
  }

  const fallbackType = (allowed?.[0] ?? "NO_ACTION") as SeoActionType;
  return {
    candidates: [{ actionType: fallbackType, score: 40, rationale: "Constrained by work programs" }],
    selected: {
      actionType: fallbackType,
      target: "project",
      primaryQueryOrIssue: "Work program constraint",
      whyNow: "Respecting the user's selected work programs",
      evidence: allowed ? [`allowed=${allowed.join(",")}`] : [],
      expectedUserValue: "Stay within selected programs",
      expectedBusinessValue: "Predictable automation",
      requiredRepositoryChanges: [],
      requiredResearch: [],
      risks: [],
      confidence: 0.5,
      qualityGates: [],
      estimatedCreditCost: CREDIT_WEIGHTS[fallbackType] ?? 0,
      humanReviewMandatory: true,
    },
    decisionSummary: `Selected ${fallbackType} within enabled work programs.`,
  };
}

/** Resolve the hard allow-list for one action cycle from due / preferred programs. */
export function resolveCycleActionTypes(
  preferredKeys: string[],
  preferredTypes: SeoActionType[] | null,
  allEnabledTypes: SeoActionType[] | null,
): SeoActionType[] | null {
  if (preferredKeys.length > 0 && preferredTypes && preferredTypes.length > 0) {
    return preferredTypes;
  }
  return allEnabledTypes;
}

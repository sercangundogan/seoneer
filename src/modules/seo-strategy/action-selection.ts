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
        whyNow: "Cannot publish sustainable content without a blog structure",
        evidence: ["website.blogExists=false"],
        expectedUserValue: "Readable, indexable articles in a clear structure",
        expectedBusinessValue: "Enables future high-value content actions",
        requiredRepositoryChanges: ["Add MDX blog route and sample layout"],
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

  if (can("FIX_TECHNICAL_SEO") && f.technical?.length) {
    return {
      candidates: [
        {
          actionType: "FIX_TECHNICAL_SEO",
          score: 75,
          rationale: "Technical foundations need attention",
        },
      ],
      selected: {
        actionType: "FIX_TECHNICAL_SEO",
        target: f.technical[0] ?? "technical",
        primaryQueryOrIssue: f.technical[0] ?? "Technical SEO gaps",
        whyNow: "Technical foundations are missing",
        evidence: [`issues=${f.technical.length}`],
        expectedUserValue: "Clearer indexing and crawl signals",
        expectedBusinessValue: "Safer future content investment",
        requiredRepositoryChanges: ["Update sitemap/robots/metadata"],
        requiredResearch: [],
        risks: ["Touches site-wide config"],
        confidence: 0.65,
        qualityGates: ["metadata", "build"],
        estimatedCreditCost: CREDIT_WEIGHTS.FIX_TECHNICAL_SEO,
        humanReviewMandatory: true,
      },
      decisionSummary: "Selected FIX_TECHNICAL_SEO based on detected foundation gaps.",
    };
  }

  // Publishing must win over title/description when publish_posts is in scope.
  if (can("CREATE_ARTICLE") && (profile?.website.blogExists || !can("BUILD_BLOG_FOUNDATION"))) {
    return {
      candidates: [
        { actionType: "CREATE_ARTICLE", score: 74, rationale: "Publishing program in scope" },
        ...(can("FIX_TECHNICAL_SEO")
          ? [
              {
                actionType: "FIX_TECHNICAL_SEO" as const,
                score: 60,
                rationale: "Technical SEO also available",
              },
            ]
          : []),
      ],
      selected: {
        actionType: "CREATE_ARTICLE",
        target: "content/blog",
        primaryQueryOrIssue: f.keywordOpportunities?.[0]?.query ?? "New helpful article",
        whyNow: "Publish posts is scheduled and the repository can accept a new article",
        evidence: [
          "work program: publish_posts",
          profile?.website.blogExists
            ? "website.blogExists=true"
            : "blog foundation not required for this cycle",
        ],
        expectedUserValue: "Fresh, useful content grounded in the product",
        expectedBusinessValue: "Organic discovery for a relevant topic",
        requiredRepositoryChanges: ["Add MDX article"],
        requiredResearch: ["Topic brief"],
        risks: ["Needs human review before merge"],
        confidence: 0.62,
        qualityGates: ["content_quality", "brand_tone"],
        estimatedCreditCost: CREDIT_WEIGHTS.CREATE_ARTICLE,
        humanReviewMandatory: true,
      },
      decisionSummary: "Selected CREATE_ARTICLE because the publishing work program is in scope.",
    };
  }

  if (can("IMPROVE_TITLE_DESCRIPTION")) {
    const topKw = f.keywordOpportunities?.[0];
    return {
      candidates: [
        {
          actionType: "IMPROVE_TITLE_DESCRIPTION",
          score: 72,
          rationale: "Low-risk CTR improvement",
        },
        ...(can("UPDATE_ARTICLE")
          ? [
              {
                actionType: "UPDATE_ARTICLE" as const,
                score: 65,
                rationale: "Existing page improvement",
              },
            ]
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
        requiredRepositoryChanges: ["Update frontmatter title/description"],
        requiredResearch: ["Confirm current metadata"],
        risks: ["Title changes need brand tone check"],
        confidence: 0.68,
        qualityGates: ["metadata", "brand_tone"],
        estimatedCreditCost: 1,
        humanReviewMandatory: false,
      },
      decisionSummary:
        "Selected IMPROVE_TITLE_DESCRIPTION within the improve-content work program.",
    };
  }

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
      whyNow: "Respecting the user’s selected work programs",
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

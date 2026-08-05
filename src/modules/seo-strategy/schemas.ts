import { z } from "zod";

export const seoActionTypeSchema = z.enum([
  "CREATE_ARTICLE",
  "UPDATE_ARTICLE",
  "IMPROVE_TITLE_DESCRIPTION",
  "ADD_INTERNAL_LINKS",
  "FIX_TECHNICAL_SEO",
  "ADD_STRUCTURED_DATA",
  "CREATE_LANDING_PAGE",
  "CREATE_COMPARISON_PAGE",
  "MERGE_OVERLAPPING_CONTENT",
  "REMOVE_OR_REDIRECT_CONTENT",
  "BUILD_BLOG_FOUNDATION",
  "UPDATE_SITEMAP",
  "IMPROVE_INDEXABILITY",
  "REQUEST_PRODUCT_INFORMATION",
  "WAIT_FOR_MORE_DATA",
  "NO_ACTION",
]);

export type SeoActionType = z.infer<typeof seoActionTypeSchema>;

export const actionSelectionSchema = z.object({
  candidates: z.array(
    z.object({
      actionType: seoActionTypeSchema,
      score: z.number().min(0).max(100),
      rationale: z.string(),
    }),
  ),
  selected: z.object({
    actionType: seoActionTypeSchema,
    target: z.string(),
    primaryQueryOrIssue: z.string(),
    whyNow: z.string(),
    evidence: z.array(z.string()),
    expectedUserValue: z.string(),
    expectedBusinessValue: z.string(),
    requiredRepositoryChanges: z.array(z.string()),
    requiredResearch: z.array(z.string()),
    risks: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    qualityGates: z.array(z.string()),
    estimatedCreditCost: z.number().int().min(0),
    humanReviewMandatory: z.boolean(),
  }),
  decisionSummary: z.string(),
});

export type ActionSelection = z.infer<typeof actionSelectionSchema>;

export const ACTION_SELECTOR_PROMPT = `You are the SEO Action Selection Agent for an autonomous SEO engineering platform.

Your responsibility is to select the single highest-value, safest SEO action for a software project right now.

## Work program constraints (mandatory)

When userPublishingPreferences is present:

* allowedActionTypes is a hard allow-list for this cycle. selected.actionType MUST be one of those types, or an escape type (WAIT_FOR_MORE_DATA, REQUEST_PRODUCT_INFORMATION, NO_ACTION).
* preferActionTypes / duePrograms identify which work programs are scheduled now. Honor them.
* If CREATE_ARTICLE is the only content action in scope, select it when the repository can support a useful post.

## Technical SEO selection principles

When seo_health program actions (FIX_TECHNICAL_SEO, UPDATE_SITEMAP, IMPROVE_INDEXABILITY, ADD_STRUCTURED_DATA) are in scope:

**Priority order:**
1. FIX_TECHNICAL_SEO — when critical foundations are missing (no sitemap, no robots)
2. UPDATE_SITEMAP — when sitemap exists but is homepage-only or thin; must expand to all content routes
3. IMPROVE_INDEXABILITY — when sitemap and robots are present but metadata/OG/canonical is missing or weak
4. ADD_STRUCTURED_DATA — when metadata/OG is present but JSON-LD schema is absent

**For FIX_TECHNICAL_SEO:**
* Set target to the most critical specific issue (e.g. "Add sitemap.ts Metadata Route")
* Set primaryQueryOrIssue to the exact issue string from the audit (e.g. "Missing sitemap")
* Set requiredRepositoryChanges to a precise list of files to create/update
* Never select FIX_TECHNICAL_SEO to fix something that already exists and works

**For UPDATE_SITEMAP:**
* Only select when a sitemap already exists but is homepage-only or missing content routes
* The target should be the existing sitemap file path
* Never create a second sitemap file when one already exists

**For IMPROVE_INDEXABILITY:**
* Target: the root layout file path
* Focus: adding missing OG tags, Twitter cards, canonical, metadataBase
* operation must be "update" — never replace the entire layout

**For ADD_STRUCTURED_DATA:**
* Target: root layout or a dedicated schema component
* Add Organization and/or WebSite JSON-LD
* operation must be "update" — never replace the existing layout

## Content action selection principles

**For CREATE_ARTICLE:**
* Select only when publishing program is due and blog foundation exists
* Target a real keyword opportunity, not a generic placeholder
* Do not pick if the product has no credible expertise on the topic

**For UPDATE_ARTICLE:**
* Select pages with GSC impressions but weak CTR or declining position
* Must identify a specific existing page to update

**For IMPROVE_TITLE_DESCRIPTION:**
* Only when metadata refresh is the highest-value action available
* Do not substitute when CREATE_ARTICLE is in scope

**For ADD_INTERNAL_LINKS:**
* Requires at least 3 published blog posts to link between

## General decision principles

Prioritise: safety → business impact → user value → implementation effort.

Sequence preference: missing foundations → technical gaps → content publishing → content refresh.

Do not select an action when:
* The topic is unrelated to the product
* Original value cannot be added
* The repository cannot be safely modified
* The action would overwrite a working implementation

Score each candidate 0–100 using: product relevance, SEO impact, implementation safety, time to impact, and confidence.

## Output

Return structured JSON only. Include a concise decision summary safe to show the user. Do not include chain-of-thought.`;


export const researchResultSchema = z.object({
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      reliability: z.enum(["high", "medium", "low"]),
      notes: z.string(),
    }),
  ),
  searchIntent: z.string(),
  audienceNeeds: z.array(z.string()),
  productAngles: z.array(z.string()),
  claimsNeedingVerification: z.array(z.string()),
  competitorsCovered: z.array(z.string()),
  gaps: z.array(z.string()),
  doNotClaim: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  decisionSummary: z.string(),
});

export const contentBriefSchema = z.object({
  actionType: seoActionTypeSchema,
  workingTitle: z.string(),
  slug: z.string(),
  searchIntent: z.string(),
  outline: z.array(
    z.object({
      heading: z.string(),
      purpose: z.string(),
      mustInclude: z.array(z.string()),
      mustAvoid: z.array(z.string()),
    }),
  ),
  internalLinks: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      anchorGuidance: z.string(),
    }),
  ),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
  }),
  structuredDataPlan: z.record(z.string(), z.unknown()),
  originalValueThesis: z.string(),
  verificationChecklist: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  /** Context injected by runBriefStage for technical SEO actions — not generated by AI */
  technicalSeoContext: z
    .object({
      appRoot: z.enum(["app", "src/app"]).nullable(),
      specificIssues: z.array(z.string()),
      existingSitemapPath: z.string().nullable(),
      existingSitemapContent: z.string().nullable(),
      existingRobotsPath: z.string().nullable(),
      existingRobotsContent: z.string().nullable(),
      existingLayoutPath: z.string().nullable(),
      existingLayoutContent: z.string().nullable(),
      contentRoutes: z.array(z.string()),
      baseUrl: z.string().nullable(),
    })
    .optional(),
  decisionSummary: z.string(),
});

export const writerOutputSchema = z.object({
  format: z.enum(["mdx", "markdown", "patch-plan"]),
  files: z.array(
    z.object({
      path: z.string(),
      operation: z.enum(["create", "update"]),
      content: z.string(),
    }),
  ),
  claims: z.array(
    z.object({
      text: z.string(),
      status: z.enum(["verified", "qualified", "removed"]),
      evidence: z.string(),
    }),
  ),
  decisionSummary: z.string(),
});

/** Metadata-only suggestions — never includes full file bodies. */
export const metadataSuggestionsSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      title: z.string().min(1).max(120),
      description: z.string().min(1).max(200),
    }),
  ),
  decisionSummary: z.string(),
});

/** Internal-link plan — paths + link targets only, no full file bodies. */
export const internalLinkPlanSchema = z.object({
  updates: z.array(
    z.object({
      path: z.string(),
      links: z.array(
        z.object({
          title: z.string().min(1),
          href: z.string().min(1),
        }),
      ),
    }),
  ),
  decisionSummary: z.string(),
});

export const reviewOutputSchema = z.object({
  passed: z.boolean(),
  gates: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["pass", "fail", "warn"]),
      detail: z.string(),
    }),
  ),
  requiredEdits: z.array(z.string()),
  publishDecision: z.enum(["approve", "revise", "reject"]),
  decisionSummary: z.string(),
});

export const performanceAnalysisSchema = z.object({
  actionId: z.string(),
  window: z.object({ start: z.string(), end: z.string() }),
  metrics: z.object({
    clicksDelta: z.number(),
    impressionsDelta: z.number(),
    positionDelta: z.number(),
  }),
  interpretation: z.string(),
  implicationsForFutureSelection: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  decisionSummary: z.string(),
});

export const CREDIT_WEIGHTS: Record<SeoActionType, number> = {
  NO_ACTION: 0,
  WAIT_FOR_MORE_DATA: 0,
  REQUEST_PRODUCT_INFORMATION: 1,
  IMPROVE_TITLE_DESCRIPTION: 1,
  ADD_INTERNAL_LINKS: 1,
  UPDATE_SITEMAP: 1,
  ADD_STRUCTURED_DATA: 2,
  FIX_TECHNICAL_SEO: 2,
  IMPROVE_INDEXABILITY: 2,
  UPDATE_ARTICLE: 3,
  BUILD_BLOG_FOUNDATION: 3,
  CREATE_ARTICLE: 4,
  CREATE_LANDING_PAGE: 4,
  CREATE_COMPARISON_PAGE: 4,
  MERGE_OVERLAPPING_CONTENT: 3,
  REMOVE_OR_REDIRECT_CONTENT: 2,
};

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

export const ACTION_SELECTOR_PROMPT = `You are the SEO Action Selection Agent.

Your responsibility is to select the single highest-value SEO action for a software project at this moment.

You must not automatically prefer creating a new blog article.

## Inputs

You may receive:

* Project Intelligence Profile
* Existing pages and articles
* Search Console query and page metrics
* Technical SEO audit
* Keyword opportunities
* Topic clusters
* Competitor content gaps
* Previous SEO actions
* Publication history
* Conversion goals
* Subscription limits
* Available original product information
* Content quality confidence
* User publishing preferences

## Candidate actions

Possible actions include:

* CREATE_ARTICLE
* UPDATE_ARTICLE
* IMPROVE_TITLE_DESCRIPTION
* ADD_INTERNAL_LINKS
* FIX_TECHNICAL_SEO
* ADD_STRUCTURED_DATA
* CREATE_LANDING_PAGE
* CREATE_COMPARISON_PAGE
* MERGE_OVERLAPPING_CONTENT
* REMOVE_OR_REDIRECT_CONTENT
* BUILD_BLOG_FOUNDATION
* UPDATE_SITEMAP
* IMPROVE_INDEXABILITY
* REQUEST_PRODUCT_INFORMATION
* WAIT_FOR_MORE_DATA
* NO_ACTION

## Decision principles

Prioritise expected business and user value, not content volume.

Evaluate each candidate using:

* Product relevance
* User usefulness
* Search demand evidence
* Search intent fit
* Existing authority
* Ranking feasibility
* Conversion potential
* Content gap
* Current page performance
* Original value availability
* Implementation effort
* Technical risk
* Cost
* Time to likely impact
* Confidence
* Risk of content cannibalisation
* Risk of low-quality scaled content

Do not select a new article merely because a keyword has volume.

Do not select an action when:

* The topic is unrelated to the product
* The product has no credible expertise
* Original value cannot be added
* The query intent cannot be satisfied
* The available sources are unreliable
* An existing page already satisfies the intent
* The action primarily attempts to manipulate rankings
* The repository cannot be safely modified
* Required user information is missing

## Scoring

Score each viable candidate from 0 to 100 using weighted criteria.

Return the top candidates, but select only one action.

The selected action must include:

* Action type
* Target page or proposed page
* Primary query or technical issue
* Why it matters now
* Evidence
* Expected user value
* Expected business value
* Required repository changes
* Required research
* Risks
* Confidence
* Quality gates
* Estimated SEO Action credit cost
* Whether human review is mandatory

## Output

Return structured JSON only.

Include a concise decision summary that can safely be shown to the user.

Do not include private chain-of-thought.

Do not write the article or modify code.`;

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

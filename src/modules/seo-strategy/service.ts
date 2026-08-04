import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateStructured } from "@/lib/ai";
import { env } from "@/lib/env";
import { writeAuditLog } from "@/modules/audit-logs/service";
import { canStartActionCycle, markFreeEntitlement, reserveCredits } from "@/modules/billing/service";
import { getLatestIntelligence } from "@/modules/intelligence/service";
import type { ProjectIntelligenceProfile } from "@/modules/intelligence/schemas";
import {
  ACTION_SELECTOR_PROMPT,
  CREDIT_WEIGHTS,
  actionSelectionSchema,
  contentBriefSchema,
  metadataSuggestionsSchema,
  internalLinkPlanSchema,
  researchResultSchema,
  reviewOutputSchema,
  writerOutputSchema,
  type ActionSelection,
  type SeoActionType,
} from "@/modules/seo-strategy/schemas";
import type { z } from "zod";
import {
  gatesPassed,
  runContentQualityGates,
} from "@/modules/technical-seo/quality-gates";
import { classifyPath } from "@/modules/github/path-policy";
import {
  applyMetadataPatches,
  assertUpdatePreservesBody,
  splitFrontmatter,
} from "@/modules/content-patch/frontmatter";
import {
  applyInternalLinkPatches,
  buildHeuristicInternalLinkPlan,
  titleFromContent,
  contentPathToHref,
} from "@/modules/content-patch/internal-links";
import {
  createBranchAndCommit,
  getFileContent,
  getRepoTreePaths,
  githubCompareUrl,
  openPullRequest,
  mergePullRequest,
} from "@/modules/github/client";
import {
  getInstallationForProject,
  getProjectRepository,
} from "@/modules/projects/service";
import { sendPrReadyEmail } from "@/modules/notifications/service";
import { recommendCadence } from "@/modules/seo-strategy/cadence";
import {
  actionTypesForPrograms,
} from "@/modules/work-programs/catalog";
import {
  advanceScheduleForAction,
  allowedActionTypesForProject,
  preferredDueProgramKeys,
} from "@/modules/work-programs/service";

const ESCAPE_ACTION_TYPES: SeoActionType[] = [
  "WAIT_FOR_MORE_DATA",
  "REQUEST_PRODUCT_INFORMATION",
  "NO_ACTION",
];

export async function runInitialAudit(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");

  const intelligence = await getLatestIntelligence(projectId);
  const profile = intelligence?.profile as ProjectIntelligenceProfile | undefined;

  const gsc = await db.query.gscConnections.findFirst({
    where: eq(schema.gscConnections.projectId, projectId),
  });
  let snapshot = null;
  if (gsc) {
    snapshot = await db.query.gscSnapshots.findFirst({
      where: eq(schema.gscSnapshots.connectionId, gsc.id),
      orderBy: [desc(schema.gscSnapshots.fetchedAt)],
    });
  }

  const findings = {
    technical: profile?.seo.issues ?? [],
    opportunities: profile?.seo.opportunities ?? [],
    gscConnected: Boolean(gsc),
    topQueries: (snapshot?.queryRows as unknown[])?.slice(0, 20) ?? [],
    keywordOpportunities: deriveKeywordOpportunities(snapshot?.queryRows),
  };

  const [audit] = await db
    .insert(schema.seoAudits)
    .values({ projectId, status: "completed", findings })
    .returning();

  for (const kw of findings.keywordOpportunities.slice(0, 20)) {
    await db.insert(schema.keywordOpportunities).values({
      projectId,
      query: kw.query,
      metrics: kw.metrics,
      score: String(kw.score),
    });
  }

  const roadmapItems = buildRoadmapItems(profile, findings);
  await db.insert(schema.seoRoadmaps).values({
    projectId,
    items: roadmapItems,
  });

  const cadence = recommendCadence({
    blogExists: profile?.website.blogExists ?? false,
    gscConnected: Boolean(gsc),
    issueCount: findings.technical.length,
    opportunityCount: findings.opportunities.length,
    plan: "free",
  });

  await db
    .update(schema.projects)
    .set({
      recommendedCadence: cadence,
      status: "active",
      agentStatus: "idle",
      agentStatusDetail: "Initial audit complete",
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId));

  await markFreeEntitlement(project.workspaceId, "initialAuditUsed");
  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId,
    action: "audit.completed",
    summary: "Initial SEO audit and roadmap generated",
    evidence: { auditId: audit.id },
  });

  return { audit, roadmapItems, cadence };
}

function deriveKeywordOpportunities(queryRows: unknown): {
  query: string;
  metrics: Record<string, number>;
  score: number;
}[] {
  if (!Array.isArray(queryRows)) return [];
  return queryRows
    .map((row) => {
      const r = row as Record<string, unknown>;
      const query = String(r.keys ?? r.query ?? "");
      const clicks = Number(r.clicks ?? 0);
      const impressions = Number(r.impressions ?? 0);
      const position = Number(r.position ?? 50);
      const ctr = Number(r.ctr ?? (impressions ? clicks / impressions : 0));
      let score = 0;
      if (position >= 8 && position <= 20) score += 40;
      if (impressions > 50 && ctr < 0.05) score += 30;
      if (clicks > 0) score += 10;
      return { query, metrics: { clicks, impressions, position, ctr }, score };
    })
    .filter((x) => x.query)
    .sort((a, b) => b.score - a.score);
}

function buildRoadmapItems(
  profile: ProjectIntelligenceProfile | undefined,
  findings: { technical: string[]; opportunities: string[]; gscConnected: boolean },
) {
  const items: { priority: number; actionType: string; title: string; reason: string }[] = [];
  let p = 1;
  for (const issue of findings.technical) {
    items.push({
      priority: p++,
      actionType: issue.toLowerCase().includes("blog")
        ? "BUILD_BLOG_FOUNDATION"
        : "FIX_TECHNICAL_SEO",
      title: issue,
      reason: "Detected during repository analysis",
    });
  }
  for (const opp of findings.opportunities) {
    items.push({
      priority: p++,
      actionType: "UPDATE_ARTICLE",
      title: opp,
      reason: "Content opportunity from intelligence profile",
    });
  }
  if (!findings.gscConnected) {
    items.push({
      priority: p++,
      actionType: "WAIT_FOR_MORE_DATA",
      title: "Connect Google Search Console",
      reason: "Performance data improves action selection confidence",
    });
  }
  if (!profile?.website.blogExists) {
    items.unshift({
      priority: 1,
      actionType: "BUILD_BLOG_FOUNDATION",
      title: "Establish blog foundation",
      reason: "No blog architecture detected",
    });
  }
  return items;
}

export async function selectAction(projectId: string): Promise<ActionSelection> {
  const intelligence = await getLatestIntelligence(projectId);
  const audit = await db.query.seoAudits.findFirst({
    where: eq(schema.seoAudits.projectId, projectId),
    orderBy: [desc(schema.seoAudits.createdAt)],
  });
  const keywords = await db.query.keywordOpportunities.findMany({
    where: eq(schema.keywordOpportunities.projectId, projectId),
    limit: 20,
  });
  const previous = await db.query.seoActions.findMany({
    where: eq(schema.seoActions.projectId, projectId),
    orderBy: [desc(schema.seoActions.createdAt)],
    limit: 10,
  });

  const profile = intelligence?.profile as ProjectIntelligenceProfile | undefined;
  const allowed = await allowedActionTypesForProject(projectId);
  const preferredKeys = await preferredDueProgramKeys(projectId);
  const preferredTypes =
    preferredKeys.length > 0 ? actionTypesForPrograms(preferredKeys) : allowed;

  const heuristic = () =>
    heuristicSelectAction(profile, audit?.findings, preferredTypes ?? allowed);

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system: ACTION_SELECTOR_PROMPT,
        prompt: JSON.stringify({
          // Keep payload small — full profiles often stall structured generation
          product: profile?.product,
          website: profile?.website,
          seo: profile?.seo,
          audit: audit?.findings,
          keywords: keywords.map((k) => ({
            query: k.query,
            score: k.score,
            metrics: k.metrics,
          })),
          previousActions: previous.map((a) => ({
            type: a.actionType,
            status: a.status,
            summary: a.decisionSummary,
          })),
          userPublishingPreferences: {
            allowedActionTypes: allowed,
            preferActionTypes: preferredTypes,
            duePrograms: preferredKeys,
          },
        }),
        schema: actionSelectionSchema,
      });
      return clampSelectionToAllowed(
        result.object,
        allowed,
        () => heuristicSelectAction(profile, audit?.findings, preferredTypes ?? allowed),
      );
    } catch (error) {
      console.error("Action selection AI failed; using heuristic", error);
      return heuristic();
    }
  }

  return heuristic();
}

function clampSelectionToAllowed(
  selection: ActionSelection,
  allowed: SeoActionType[] | null,
  fallback: () => ActionSelection,
): ActionSelection {
  if (!allowed || allowed.length === 0) return selection;
  const ok = new Set<SeoActionType>([...allowed, ...ESCAPE_ACTION_TYPES]);
  if (ok.has(selection.selected.actionType)) return selection;
  return fallback();
}

function heuristicSelectAction(
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
        whyNow:
          "Improving titles/descriptions is safer than publishing new content without strong evidence",
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
        "Selected IMPROVE_TITLE_DESCRIPTION as the highest-value safe action over creating a new article.",
    };
  }

  if (can("CREATE_ARTICLE")) {
    return {
      candidates: [
        { actionType: "CREATE_ARTICLE", score: 70, rationale: "Publishing program enabled" },
      ],
      selected: {
        actionType: "CREATE_ARTICLE",
        target: "content/blog",
        primaryQueryOrIssue: f.keywordOpportunities?.[0]?.query ?? "New helpful article",
        whyNow: "User enabled publish_posts and no higher-priority fix is selected",
        evidence: ["work program: publish_posts"],
        expectedUserValue: "Fresh, useful content",
        expectedBusinessValue: "Organic discovery for a relevant topic",
        requiredRepositoryChanges: ["Add MDX article"],
        requiredResearch: ["Topic brief"],
        risks: ["Needs human review before merge"],
        confidence: 0.6,
        qualityGates: ["content_quality", "brand_tone"],
        estimatedCreditCost: CREDIT_WEIGHTS.CREATE_ARTICLE,
        humanReviewMandatory: true,
      },
      decisionSummary: "Selected CREATE_ARTICLE based on enabled publishing program.",
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

export async function runActionCycle(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");

  try {
    return await runActionCycleInner(projectId, project);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO action cycle failed";
    if (!/already waiting|already in progress/i.test(message)) {
      await db
        .update(schema.projects)
        .set({
          agentStatus: "error",
          agentStatusDetail: message.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId));
    }
    throw error;
  }
}

async function runActionCycleInner(
  projectId: string,
  project: typeof schema.projects.$inferSelect,
) {
  const active = await db.query.seoActions.findFirst({
    where: and(
      eq(schema.seoActions.projectId, projectId),
      ne(schema.seoActions.status, "merged"),
      ne(schema.seoActions.status, "failed"),
      ne(schema.seoActions.status, "skipped"),
      ne(schema.seoActions.status, "cancelled"),
    ),
  });
  // Block while a cycle is mid-flight; awaiting_approval still counts as open work
  if (active) {
    await db
      .update(schema.projects)
      .set({
        agentStatus:
          active.status === "awaiting_approval" ? "awaiting_approval" : "selecting_action",
        agentStatusDetail:
          active.status === "awaiting_approval"
            ? "An SEO update is already waiting for your approval"
            : "An SEO action cycle is already in progress",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    throw new Error(
      active.status === "awaiting_approval"
        ? "An SEO update is already waiting for your approval"
        : "An SEO action cycle is already in progress for this project",
    );
  }

  const billing = await canStartActionCycle(project.workspaceId);
  if (!billing.ok) {
    await db
      .update(schema.projects)
      .set({
        agentStatus: "blocked",
        agentStatusDetail: billing.reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    return { status: "blocked" as const, reason: billing.reason };
  }

  await setProjectAgentStatus(
    projectId,
    "selecting_action",
    "Choosing the highest-value SEO action",
  );

  const selection = await selectAction(projectId);
  const actionType = selection.selected.actionType;
  // Billing uses catalog weights — never trust unbounded AI cost estimates
  const creditCost = CREDIT_WEIGHTS[actionType] ?? 1;

  if (!billing.useFreeSample && creditCost > 0) {
    const billingForCost = await canStartActionCycle(project.workspaceId, creditCost);
    if (!billingForCost.ok) {
      await db
        .update(schema.projects)
        .set({
          agentStatus: "blocked",
          agentStatusDetail: billingForCost.reason,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId));
      return { status: "blocked" as const, reason: billingForCost.reason };
    }
  }

  const [action] = await db
    .insert(schema.seoActions)
    .values({
      projectId,
      actionType,
      status: "queued",
      selection: {
        ...selection,
        selected: { ...selection.selected, estimatedCreditCost: creditCost },
      },
      creditCost,
      humanReviewMandatory: selection.selected.humanReviewMandatory,
      decisionSummary: selection.decisionSummary,
    })
    .returning();

  await db.insert(schema.agentRuns).values({
    seoActionId: action.id,
    projectId,
    stage: "seo_strategist",
    status: "succeeded",
    input: {},
    output: selection,
    decisionSummary: selection.decisionSummary,
    confidence: String(selection.selected.confidence),
    model: env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "configured" : "heuristic",
  });

  if (
    actionType === "NO_ACTION" ||
    actionType === "WAIT_FOR_MORE_DATA" ||
    actionType === "REQUEST_PRODUCT_INFORMATION"
  ) {
    await db
      .update(schema.seoActions)
      .set({ status: "skipped", updatedAt: new Date() })
      .where(eq(schema.seoActions.id, action.id));
    await db
      .update(schema.projects)
      .set({
        agentStatus: actionType === "REQUEST_PRODUCT_INFORMATION" ? "needs_input" : "idle",
        agentStatusDetail: selection.decisionSummary,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    await writeAuditLog({
      workspaceId: project.workspaceId,
      projectId,
      action: "seo_action.skipped",
      entityType: "seo_action",
      entityId: action.id,
      summary: selection.decisionSummary,
    });
    return { status: "skipped" as const, action, selection };
  }

  await reserveCredits({
    workspaceId: project.workspaceId,
    projectId,
    seoActionId: action.id,
    amount: Math.max(creditCost, 1),
    useFreeSample: billing.useFreeSample,
  });
  await db
    .update(schema.seoActions)
    .set({ creditsReserved: true, status: "researching", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, action.id));

  await setProjectAgentStatus(projectId, "researching", "Researching the selected SEO action");
  const research = await runResearchStage(projectId, action.id, selection);

  await setProjectAgentStatus(projectId, "briefing", "Preparing the content brief");
  const brief = await runBriefStage(projectId, action.id, selection, research);

  await setProjectAgentStatus(projectId, "writing", "Writing repository changes");
  const draft = await runWriterStage(projectId, action.id, brief);

  if (draft.files.length === 0) {
    await db
      .update(schema.seoActions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(schema.seoActions.id, action.id));
    await setProjectAgentStatus(
      projectId,
      "idle",
      draft.decisionSummary || "No safe file changes were produced",
    );
    return { status: "failed_empty_draft" as const, action, draft };
  }

  // Never allow "create new stub post" for update-oriented actions
  if (
    (brief.actionType === "ADD_INTERNAL_LINKS" ||
      brief.actionType === "IMPROVE_TITLE_DESCRIPTION" ||
      brief.actionType === "UPDATE_ARTICLE") &&
    draft.files.some((f) => f.operation === "create")
  ) {
    await db
      .update(schema.seoActions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(schema.seoActions.id, action.id));
    await setProjectAgentStatus(
      projectId,
      "idle",
      "Rejected draft that created new files instead of updating existing posts",
    );
    return { status: "failed_unsafe_draft" as const, action, draft };
  }

  await setProjectAgentStatus(projectId, "validating", "Running quality gates");
  const review = await runReviewStage(projectId, action.id, draft);

  if (!review.passed || review.publishDecision === "reject") {
    await db
      .update(schema.seoActions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(schema.seoActions.id, action.id));
    await db
      .update(schema.projects)
      .set({
        agentStatus: "idle",
        agentStatusDetail: review.decisionSummary,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    return { status: "failed_review" as const, action, review };
  }

  await setProjectAgentStatus(projectId, "creating_pr", "Opening pull request on GitHub");
  const pr = await executeAndOpenPr(projectId, action.id, selection, draft, review);
  return { status: "awaiting_approval" as const, action, pr, selection };
}

async function setProjectAgentStatus(
  projectId: string,
  agentStatus: string,
  agentStatusDetail: string,
) {
  await db
    .update(schema.projects)
    .set({ agentStatus, agentStatusDetail, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

async function runResearchStage(
  projectId: string,
  seoActionId: string,
  selection: ActionSelection,
) {
  const started = Date.now();
  const research = {
    sources: [] as { url: string; title: string; reliability: "high" | "medium" | "low"; notes: string }[],
    searchIntent: selection.selected.primaryQueryOrIssue,
    audienceNeeds: ["Clear, accurate guidance"],
    productAngles: [selection.selected.expectedUserValue],
    claimsNeedingVerification: [],
    competitorsCovered: [],
    gaps: selection.selected.requiredResearch,
    doNotClaim: ["Unverified statistics", "Fabricated customer quotes"],
    confidence: selection.selected.confidence,
    decisionSummary: `Research scoped for ${selection.selected.actionType}`,
  };

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system:
          "You are the Researcher agent. Return structured JSON only. Do not invent sources.",
        prompt: JSON.stringify({ selection }),
        schema: researchResultSchema,
      });
      Object.assign(research, result.object);
    } catch {
      // keep heuristic
    }
  }

  await db.insert(schema.agentRuns).values({
    seoActionId,
    projectId,
    stage: "researcher",
    status: "succeeded",
    input: { selection: selection.selected },
    output: research,
    decisionSummary: research.decisionSummary,
    confidence: String(research.confidence),
    durationMs: Date.now() - started,
    model: "researcher",
  });
  return research;
}

async function runBriefStage(
  projectId: string,
  seoActionId: string,
  selection: ActionSelection,
  research: unknown,
) {
  await db
    .update(schema.seoActions)
    .set({ status: "briefing", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, seoActionId));

  const intelligence = await getLatestIntelligence(projectId);
  const profile = intelligence?.profile as ProjectIntelligenceProfile | undefined;
  const blogDir = profile?.website.blogDirectory ?? "content/blog";

  let brief: z.infer<typeof contentBriefSchema> = {
    actionType: selection.selected.actionType,
    workingTitle: selection.selected.target,
    slug: selection.selected.target
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60),
    searchIntent: selection.selected.primaryQueryOrIssue,
    outline: [
      {
        heading: "Overview",
        purpose: "Set context",
        mustInclude: ["Product-relevant framing"],
        mustAvoid: ["Fabricated claims"],
      },
    ],
    internalLinks: [],
    metadata: {
      title: `${selection.selected.target} | Seoneer update`,
      description: selection.selected.expectedUserValue.slice(0, 155),
    },
    structuredDataPlan: {},
    originalValueThesis: selection.selected.expectedUserValue,
    verificationChecklist: ["No fabricated stats"],
    acceptanceCriteria: selection.selected.qualityGates,
    decisionSummary: `Brief prepared for ${selection.selected.actionType}`,
  };

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system: "You are the Content Architect. Return a detailed brief as JSON only.",
        prompt: JSON.stringify({ selection, research, blogDir }),
        schema: contentBriefSchema,
      });
      brief = result.object;
    } catch {
      // heuristic brief
    }
  }

  await db
    .update(schema.seoActions)
    .set({ brief, updatedAt: new Date() })
    .where(eq(schema.seoActions.id, seoActionId));

  await db.insert(schema.agentRuns).values({
    seoActionId,
    projectId,
    stage: "content_architect",
    status: "succeeded",
    input: { selection: selection.selected },
    output: brief,
    decisionSummary: brief.decisionSummary,
  });

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (project) await markFreeEntitlement(project.workspaceId, "briefUsed");

  return brief;
}

async function listBlogContentPaths(projectId: string): Promise<string[]> {
  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) return [];

  const cached = await db.query.cachedRepoSummaries.findFirst({
    where: eq(schema.cachedRepoSummaries.projectId, projectId),
  });
  const fromCache = (cached?.summary as { detected?: { contentFiles?: string[] } } | null)
    ?.detected?.contentFiles;
  if (fromCache?.length) {
    return fromCache.filter((p) => /\.(md|mdx)$/i.test(p)).slice(0, 40);
  }

  const { paths } = await getRepoTreePaths({
    installationId: installation.installationId,
    owner: repo.owner,
    repo: repo.name,
    ref: repo.defaultBranch,
  });
  return paths
    .filter((p) => /\.(md|mdx)$/i.test(p))
    .filter((p) => /(^|\/)(content|blog|posts)\//i.test(p) || classifyPath(p) === "allowed")
    .slice(0, 40);
}

function heuristicMetadataFromFile(path: string, content: string): {
  title: string;
  description: string;
} {
  const { frontmatter, body } = splitFrontmatter(content);
  const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const existingTitle = titleMatch?.[1]?.replace(/^["']|["']$/g, "").trim();
  const existingDesc = descMatch?.[1]?.replace(/^["']|["']$/g, "").trim();
  const slugTitle = path
    .split("/")
    .pop()
    ?.replace(/\.(md|mdx)$/i, "")
    .replace(/[-_]+/g, " ");
  const title = existingTitle || h1 || slugTitle || "Untitled";
  const plain = body
    .replace(/^#+\s+.*/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description =
    existingDesc ||
    plain.slice(0, 155) ||
    `Learn more about ${title}.`;
  return { title, description };
}

async function writeTitleDescriptionPatches(
  projectId: string,
  brief: z.infer<typeof contentBriefSchema>,
): Promise<z.infer<typeof writerOutputSchema>> {
  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) {
    throw new Error("Repository not connected");
  }

  const paths = await listBlogContentPaths(projectId);
  if (paths.length === 0) {
    return {
      format: "mdx",
      files: [],
      claims: [],
      decisionSummary: "No blog Markdown/MDX files found to update metadata on",
    };
  }

  const originals: Record<string, string> = {};
  const excerpts: { path: string; excerpt: string; currentTitle?: string; currentDescription?: string }[] =
    [];

  for (const path of paths.slice(0, 15)) {
    const content = await getFileContent({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      path,
      ref: repo.defaultBranch,
    });
    if (!content) continue;
    originals[path] = content;
    const { frontmatter, body } = splitFrontmatter(content);
    excerpts.push({
      path,
      excerpt: body.slice(0, 400),
      currentTitle: frontmatter.match(/^title:\s*(.+)$/m)?.[1],
      currentDescription: frontmatter.match(/^description:\s*(.+)$/m)?.[1],
    });
  }

  let suggestions: z.infer<typeof metadataSuggestionsSchema>["files"] = excerpts.map((item) => {
    const meta = heuristicMetadataFromFile(item.path, originals[item.path]);
    return { path: item.path, title: meta.title, description: meta.description };
  });
  let decisionSummary = `Updated title/description frontmatter on ${suggestions.length} existing posts (body preserved)`;

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system: `You improve SEO title and meta description only.
Return JSON with path, title, description for each file.
Rules:
- Never invent article body content
- Keep brand/product names accurate
- Titles <= 60 chars preferred; descriptions <= 155 chars
- Only include paths from the provided list`,
        prompt: JSON.stringify({
          action: "IMPROVE_TITLE_DESCRIPTION",
          brief: {
            workingTitle: brief.workingTitle,
            searchIntent: brief.searchIntent,
            metadata: brief.metadata,
          },
          files: excerpts,
        }),
        schema: metadataSuggestionsSchema,
      });
      const allowed = new Set(Object.keys(originals));
      suggestions = result.object.files.filter((f) => allowed.has(f.path));
      decisionSummary = result.object.decisionSummary;
    } catch {
      // keep heuristic suggestions
    }
  }

  const files = applyMetadataPatches(originals, suggestions);
  return {
    format: "mdx",
    files,
    claims: [],
    decisionSummary:
      files.length > 0
        ? decisionSummary
        : "No metadata changes were needed after reviewing existing frontmatter",
  };
}

async function writeInternalLinkPatches(
  projectId: string,
  brief: z.infer<typeof contentBriefSchema>,
): Promise<z.infer<typeof writerOutputSchema>> {
  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) {
    throw new Error("Repository not connected");
  }

  const paths = await listBlogContentPaths(projectId);
  if (paths.length < 2) {
    return {
      format: "mdx",
      files: [],
      claims: [],
      decisionSummary: "Need at least two existing posts to add internal links",
    };
  }

  const originals: Record<string, string> = {};
  const catalog: { path: string; title: string; href: string; excerpt: string }[] = [];

  for (const path of paths.slice(0, 20)) {
    const content = await getFileContent({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      path,
      ref: repo.defaultBranch,
    });
    if (!content) continue;
    // Skip tiny/placeholder stubs
    if (content.length < 120) continue;
    originals[path] = content;
    const { body } = splitFrontmatter(content);
    catalog.push({
      path,
      title: titleFromContent(path, content),
      href: contentPathToHref(path),
      excerpt: body.slice(0, 280),
    });
  }

  if (Object.keys(originals).length < 2) {
    return {
      format: "mdx",
      files: [],
      claims: [],
      decisionSummary: "Not enough real posts to safely add internal links",
    };
  }

  let plan = buildHeuristicInternalLinkPlan(Object.keys(originals), originals);
  let decisionSummary = `Added related-reading links across ${plan.length} existing posts (bodies preserved)`;

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system: `You plan internal links between existing blog posts.
Return JSON updates only: path + links[{title, href}].
Rules:
- Only use paths from the provided catalog
- Only use hrefs from the catalog
- 1–3 links per source post
- Never invent article body content or new files
- Prefer relevant topical connections`,
        prompt: JSON.stringify({
          action: "ADD_INTERNAL_LINKS",
          brief: { workingTitle: brief.workingTitle, searchIntent: brief.searchIntent },
          catalog,
        }),
        schema: internalLinkPlanSchema,
      });
      const allowed = new Set(Object.keys(originals));
      const hrefAllowed = new Set(catalog.map((c) => c.href));
      plan = result.object.updates
        .filter((u) => allowed.has(u.path))
        .map((u) => ({
          path: u.path,
          links: u.links.filter((l) => hrefAllowed.has(l.href)).slice(0, 3),
        }));
      decisionSummary = result.object.decisionSummary;
    } catch {
      // keep heuristic plan
    }
  }

  const files = applyInternalLinkPatches(originals, plan);
  return {
    format: "mdx",
    files,
    claims: [],
    decisionSummary:
      files.length > 0
        ? decisionSummary
        : "No internal link updates were applied (posts may already have related links)",
  };
}

async function runWriterStage(
  projectId: string,
  seoActionId: string,
  brief: z.infer<typeof contentBriefSchema>,
) {
  await db
    .update(schema.seoActions)
    .set({ status: "executing", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, seoActionId));

  const intelligence = await getLatestIntelligence(projectId);
  const profile = intelligence?.profile as ProjectIntelligenceProfile | undefined;
  const blogDir = profile?.website.blogDirectory ?? "content/blog";

  // Title/description must surgically patch existing files — never rewrite bodies.
  if (brief.actionType === "IMPROVE_TITLE_DESCRIPTION") {
    const draft = await writeTitleDescriptionPatches(projectId, brief);
    await db.insert(schema.agentRuns).values({
      seoActionId,
      projectId,
      stage: "writer",
      status: "succeeded",
      input: { brief, mode: "metadata_patch" },
      output: draft,
      decisionSummary: draft.decisionSummary,
    });
    return draft;
  }

  if (brief.actionType === "ADD_INTERNAL_LINKS") {
    const draft = await writeInternalLinkPatches(projectId, brief);
    await db.insert(schema.agentRuns).values({
      seoActionId,
      projectId,
      stage: "writer",
      status: "succeeded",
      input: { brief, mode: "internal_link_patch" },
      output: draft,
      decisionSummary: draft.decisionSummary,
    });
    return draft;
  }

  let draft: z.infer<typeof writerOutputSchema> = {
    format: "mdx",
    files: [
      {
        path: `${blogDir}/${brief.slug || "seoneer-update"}.mdx`,
        operation: "create",
        content: `---
title: ${brief.metadata.title}
description: ${brief.metadata.description}
---

# ${brief.workingTitle}

${brief.originalValueThesis}

This update was prepared by Seoneer as a reviewable repository change. Claims are limited to verified product context.
`,
      },
    ],
    claims: [
      {
        text: brief.originalValueThesis,
        status: "qualified",
        evidence: "Derived from project intelligence and selected action rationale",
      },
    ],
    decisionSummary: `Drafted files for ${brief.actionType}`,
  };

  if (brief.actionType === "BUILD_BLOG_FOUNDATION") {
    draft.files = [
      {
        path: "content/blog/.gitkeep",
        operation: "create",
        content: "",
      },
      {
        path: "content/blog/hello-seoneer.mdx",
        operation: "create",
        content: `---
title: Hello from your SEO engineer
description: Starter post establishing the blog foundation for organic growth.
---

# Hello from your SEO engineer

This post establishes a safe Markdown/MDX content location for future SEO work.
`,
      },
    ];
  }

  if (brief.actionType === "UPDATE_SITEMAP" || brief.actionType === "FIX_TECHNICAL_SEO") {
    draft.format = "patch-plan";
    draft.files = [
      {
        path: "src/app/sitemap.ts",
        operation: "create",
        content: `import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [{ url: base, lastModified: new Date() }];
}
`,
      },
      {
        path: "src/app/robots.ts",
        operation: "create",
        content: `import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/" }, sitemap: \`\${base}/sitemap.xml\` };
}
`,
      },
    ];
  }

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "strong",
        system: `You are the Writer agent. Produce file changes only.
For operation "update", you MUST include the COMPLETE original file content with only the intended edits.
Never replace an article with only frontmatter/title/description.
Never fabricate statistics, quotes, customers, or product capabilities.`,
        prompt: JSON.stringify({ brief, profile }),
        schema: writerOutputSchema,
      });
      draft = result.object;
    } catch {
      // keep heuristic draft
    }
  }

  await db.insert(schema.agentRuns).values({
    seoActionId,
    projectId,
    stage: "writer",
    status: "succeeded",
    input: { brief },
    output: draft,
    decisionSummary: draft.decisionSummary,
  });
  return draft;
}

async function runReviewStage(
  projectId: string,
  seoActionId: string,
  draft: {
    files: { path: string; content: string; operation?: "create" | "update" }[];
    decisionSummary: string;
  },
) {
  await db
    .update(schema.seoActions)
    .set({ status: "validating", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, seoActionId));

  const intelligence = await getLatestIntelligence(projectId);
  const profile = intelligence?.profile as ProjectIntelligenceProfile | undefined;
  const gates = runContentQualityGates({
    files: draft.files,
    productName: profile?.product.name,
  });

  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);

  for (const file of draft.files) {
    const classification = classifyPath(file.path, profile?.codeSafety);
    if (classification === "protected") {
      gates.push({
        id: `path:${file.path}`,
        status: "fail",
        detail: "Protected path cannot be modified autonomously",
      });
    } else if (classification === "review_required") {
      gates.push({
        id: `path:${file.path}`,
        status: "warn",
        detail: "Path requires human review",
      });
    }

    if (
      file.operation === "update" &&
      repo &&
      installation &&
      /\.(md|mdx)$/i.test(file.path)
    ) {
      const original = await getFileContent({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        path: file.path,
        ref: repo.defaultBranch,
      });
      if (original) {
        const preserve = assertUpdatePreservesBody(original, file.content);
        if (!preserve.ok) {
          gates.push({
            id: `body:${file.path}`,
            status: "fail",
            detail: preserve.reason ?? "Update would strip article body",
          });
        }
      }
    }
  }

  const passed = gatesPassed(gates);
  const review = {
    passed,
    gates,
    requiredEdits: gates.filter((g) => g.status === "fail").map((g) => g.detail),
    publishDecision: passed ? ("approve" as const) : ("reject" as const),
    decisionSummary: passed
      ? "Quality gates passed"
      : `Quality gates failed: ${gates
          .filter((g) => g.status === "fail")
          .map((g) => g.id)
          .join(", ")}`,
  };

  if (env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY) {
    try {
      const result = await generateStructured({
        tier: "mid",
        system: "You are the SEO Reviewer. Enforce people-first quality gates. JSON only.",
        prompt: JSON.stringify({ draft, gates }),
        schema: reviewOutputSchema,
      });
      // Prefer deterministic secret/path fails
      if (!passed) {
        result.object.passed = false;
        result.object.publishDecision = "reject";
      }
      Object.assign(review, result.object, { gates: review.gates, passed });
    } catch {
      // keep deterministic review
    }
  }

  await db.insert(schema.agentRuns).values({
    seoActionId,
    projectId,
    stage: "seo_reviewer",
    status: review.passed ? "succeeded" : "aborted",
    input: { fileCount: draft.files.length },
    output: review,
    decisionSummary: review.decisionSummary,
  });
  return review;
}

async function executeAndOpenPr(
  projectId: string,
  seoActionId: string,
  selection: ActionSelection,
  draft: { files: { path: string; content: string; operation: "create" | "update" }[]; decisionSummary: string },
  review: { gates: unknown; decisionSummary: string },
) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");
  const repo = await getProjectRepository(projectId);
  const installation = await getInstallationForProject(projectId);
  if (!repo || !installation) throw new Error("Repository not connected");

  const branch = `seoneer/${selection.selected.actionType.toLowerCase()}-${seoActionId.slice(0, 8)}`;
  const qualityReport = {
    gates: review.gates,
    actionType: selection.selected.actionType,
    decisionSummary: selection.decisionSummary,
    generatedAt: new Date().toISOString(),
  };

  const prBody = `## Summary
${selection.decisionSummary}

### Why now
${selection.selected.whyNow}

### Expected benefit
- User: ${selection.selected.expectedUserValue}
- Business: ${selection.selected.expectedBusinessValue}

### Files
${draft.files.map((f) => `- \`${f.path}\` (${f.operation})`).join("\n")}

### Quality report
\`\`\`json
${JSON.stringify(qualityReport, null, 2)}
\`\`\`

---
Generated by Seoneer. Review carefully before merging.
`;

  let commitSha = "local-dry-run";
  let prNumber = 0;
  let prUrl = "";
  let reviewHref = "";
  let statusDetail = selection.decisionSummary;

  try {
    const committed = await createBranchAndCommit({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      baseBranch: repo.defaultBranch,
      branch,
      files: draft.files,
      commitMessage: `seo: ${selection.selected.actionType} via Seoneer`,
    });
    commitSha = committed.commitSha;
    reviewHref = githubCompareUrl({
      owner: repo.owner,
      repo: repo.name,
      baseBranch: repo.defaultBranch,
      branch,
    });

    try {
      const opened = await openPullRequest({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        baseBranch: repo.defaultBranch,
        branch,
        prTitle: `Seoneer: ${selection.selected.actionType} — ${selection.selected.target}`,
        prBody,
      });
      prNumber = opened.prNumber;
      prUrl = opened.prUrl;
      reviewHref = opened.prUrl;
    } catch (prError) {
      // Branch+commit succeeded; expose compare URL so the user can still review
      prUrl = reviewHref;
      statusDetail =
        prError instanceof Error
          ? `${prError.message} Open the compare link to create the PR manually.`
          : "Branch pushed but PR could not be opened. Open the compare link on GitHub.";
      await writeAuditLog({
        workspaceId: project.workspaceId,
        projectId,
        action: "pull_request.open_failed",
        summary:
          prError instanceof Error
            ? prError.message
            : "Failed to open pull request after pushing branch",
        evidence: { branch, commitSha, compareUrl: reviewHref },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub push failed";
    await writeAuditLog({
      workspaceId: project.workspaceId,
      projectId,
      action: "pull_request.failed",
      summary: message,
    });
    throw new Error(message);
  }

  const [pr] = await db
    .insert(schema.pullRequests)
    .values({
      seoActionId,
      projectId,
      branch,
      baseBranch: repo.defaultBranch,
      commitSha,
      prNumber: prNumber || null,
      prUrl: prUrl || reviewHref,
      qualityReport,
      checks: { seoneer_quality: "pass" },
      mergeStatus: "open",
    })
    .returning();

  await db
    .update(schema.seoActions)
    .set({ status: "awaiting_approval", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, seoActionId));

  await db.insert(schema.agentRuns).values({
    seoActionId,
    projectId,
    stage: "code_agent",
    status: "succeeded",
    input: { files: draft.files.map((f) => f.path) },
    output: { branch, commitSha, prUrl: prUrl || reviewHref, prNumber: prNumber || null },
    decisionSummary: draft.decisionSummary,
  });

  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId,
    action: prNumber ? "pull_request.opened" : "pull_request.branch_ready",
    entityType: "pull_request",
    entityId: pr.id,
    summary: prNumber
      ? `Opened PR #${prNumber} for ${selection.selected.actionType}`
      : `Pushed branch for ${selection.selected.actionType} (PR not opened)`,
    evidence: { prUrl: prUrl || reviewHref, branch, prNumber: prNumber || null },
  });

  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(schema.workspaceMembers.workspaceId, project.workspaceId),
  });
  if (membership) {
    const user = await db.query.user.findFirst({
      where: eq(schema.user.id, membership.userId),
    });
    const emailHref = prUrl || reviewHref;
    if (user?.email && emailHref && !emailHref.startsWith("dry-run://")) {
      await sendPrReadyEmail({
        to: user.email,
        actionType: selection.selected.actionType,
        why: selection.selected.whyNow,
        benefit: selection.selected.expectedBusinessValue,
        fileCount: draft.files.length,
        prUrl: emailHref,
        decisionSummary: selection.decisionSummary,
      });
    }
  }

  // Always await human review — never auto-merge into the default branch.
  await db
    .update(schema.projects)
    .set({
      agentStatus: "awaiting_approval",
      agentStatusDetail: statusDetail,
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, projectId));

  await advanceScheduleForAction(projectId, selection.selected.actionType);

  return pr;
}

export async function mergeApprovedPr(input: {
  pullRequestId: string;
  userId: string;
  source: "email" | "dashboard";
}) {
  const pr = await db.query.pullRequests.findFirst({
    where: eq(schema.pullRequests.id, input.pullRequestId),
  });
  if (!pr) throw new Error("PR not found");
  if (pr.mergeStatus !== "open") throw new Error("PR is not open");

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, pr.projectId),
  });
  if (!project) throw new Error("Project not found");

  const billing = await canStartActionCycle(project.workspaceId);
  // For merge we only block on paused/past_due, not credit balance
  if (project.status === "paused") throw new Error("Project paused");
  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.workspaceId, project.workspaceId),
  });
  if (sub?.status === "paused" || sub?.status === "past_due") {
    throw new Error("Subscription inactive");
  }

  const action = await db.query.seoActions.findFirst({
    where: eq(schema.seoActions.id, pr.seoActionId),
  });
  if (!action) throw new Error("Action not found");

  const repo = await getProjectRepository(pr.projectId);
  const installation = await getInstallationForProject(pr.projectId);
  if (!repo || !installation) throw new Error("Repository not connected");

  if (pr.prNumber && pr.prUrl && !pr.prUrl.startsWith("dry-run://")) {
    await mergePullRequest({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      prNumber: pr.prNumber,
      commitSha: pr.commitSha,
    });
  }

  await db
    .update(schema.pullRequests)
    .set({ mergeStatus: "merged", mergedAt: new Date() })
    .where(eq(schema.pullRequests.id, pr.id));
  await db
    .update(schema.seoActions)
    .set({ status: "merged", updatedAt: new Date() })
    .where(eq(schema.seoActions.id, action.id));
  await db
    .update(schema.projects)
    .set({
      agentStatus: "idle",
      agentStatusDetail: "Last action merged",
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, project.id));

  await writeAuditLog({
    workspaceId: project.workspaceId,
    projectId: project.id,
    userId: input.userId,
    action: "pull_request.merged",
    entityType: "pull_request",
    entityId: pr.id,
    summary: `Merged via ${input.source}`,
    evidence: { billingOk: billing.ok },
  });

  return pr;
}

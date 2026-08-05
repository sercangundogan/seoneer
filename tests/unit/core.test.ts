import { describe, expect, it } from "vitest";
import {
  buildHeuristicIntelligence,
  type RepoAnalysisSummary,
} from "@/modules/repo-analysis/heuristic";
import { recommendCadence } from "@/modules/seo-strategy/cadence";
import { scanForSecrets } from "@/modules/technical-seo/secret-scan";
import {
  gatesPassed,
  runContentQualityGates,
} from "@/modules/technical-seo/quality-gates";
import { projectIntelligenceProfileSchema } from "@/modules/intelligence/schemas";
import {
  actionSelectionSchema,
  CREDIT_WEIGHTS,
} from "@/modules/seo-strategy/schemas";
import {
  clampSelectionToAllowed,
  heuristicSelectAction,
  resolveCycleActionTypes,
} from "@/modules/seo-strategy/action-selection";
import {
  actionTypesForPrograms,
  defaultWorkProgramInputs,
} from "@/modules/work-programs/catalog";
import { sha256 } from "@/lib/crypto";
import {
  applyMetadataPatches,
  assertUpdatePreservesBody,
  ensureCreatedPostPublishDate,
  todayPublishDate,
  upsertFrontmatterFields,
} from "@/modules/content-patch/frontmatter";
import {
  appendRelatedReadingLinks,
  applyInternalLinkPatches,
  buildHeuristicInternalLinkPlan,
  contentPathToHref,
} from "@/modules/content-patch/internal-links";
import {
  assertPathsSafeForAutoMerge,
  classifyPath,
  SAFE_AUTO_MERGE_ACTIONS,
} from "@/modules/github/path-policy";

describe("frontmatter patch", () => {
  const original = `---
title: "Old title"
description: "Old description"
author: jane
---

# Old title

Full article body with **markdown** and details.

## Section

More content that must survive.
`;

  it("updates title/description without touching the body", () => {
    const next = upsertFrontmatterFields(original, {
      title: "Better title for CTR",
      description: "A clearer meta description under 155 characters.",
    });
    expect(next).toContain('title: "Better title for CTR"');
    expect(next).toContain("author: jane");
    expect(next).toContain("Full article body with **markdown** and details.");
    expect(next).toContain("More content that must survive.");
    expect(assertUpdatePreservesBody(original, next).ok).toBe(true);
  });

  it("forces today's publish date on newly created posts", () => {
    const invented = `---
title: "Old invented date post"
description: "Desc"
date: "2024-06-10"
---

# Body

Content here.
`;
    const fixed = ensureCreatedPostPublishDate(invented, "2026-08-05");
    expect(fixed).toContain('date: "2026-08-05"');
    expect(fixed).not.toContain("2024-06-10");
    expect(fixed).toContain("Content here.");
    expect(todayPublishDate(new Date("2026-08-05T15:00:00.000Z"))).toBe("2026-08-05");
  });

  it("rejects updates that wipe the body", () => {
    const wiped = `---
title: "Only meta"
description: "Gone"
---
`;
    const result = assertUpdatePreservesBody(original, wiped);
    expect(result.ok).toBe(false);
  });

  it("applies metadata patches only to known originals", () => {
    const files = applyMetadataPatches(
      { "content/blog/a.mdx": original },
      [
        {
          path: "content/blog/a.mdx",
          title: "New",
          description: "Desc",
        },
        {
          path: "content/blog/missing.mdx",
          title: "X",
          description: "Y",
        },
      ],
    );
    expect(files).toHaveLength(1);
    expect(files[0].operation).toBe("update");
    expect(files[0].content).toContain("Full article body");
  });
});

describe("internal link patch", () => {
  it("appends related reading without wiping the body", () => {
    const original = `---
title: "Post A"
---

# Post A

Useful article body.
`;
    const next = appendRelatedReadingLinks(original, [
      { title: "Post B", href: "/blog/post-b" },
    ]);
    expect(next).toContain("Useful article body.");
    expect(next).toContain("## Related reading");
    expect(next).toContain("[Post B](/blog/post-b)");
    expect(assertUpdatePreservesBody(original, next).ok).toBe(true);
  });

  it("maps content paths to blog hrefs", () => {
    expect(contentPathToHref("content/blog/hello-world.mdx")).toBe("/blog/hello-world");
  });

  it("builds update-only patches from a catalog", () => {
    const originals = {
      "content/blog/a.mdx": `---\ntitle: A\n---\n\n# A\n\nBody A long enough.\n`,
      "content/blog/b.mdx": `---\ntitle: B\n---\n\n# B\n\nBody B long enough.\n`,
    };
    const plan = buildHeuristicInternalLinkPlan(Object.keys(originals), originals);
    const files = applyInternalLinkPatches(originals, plan);
    expect(files.every((f) => f.operation === "update")).toBe(true);
    expect(files.some((f) => f.content.includes("Related reading"))).toBe(true);
  });
});

describe("path policy", () => {
  it("classifies content as allowed and env as protected", () => {
    expect(classifyPath("content/blog/hello.mdx")).toBe("allowed");
    expect(classifyPath(".env.local")).toBe("protected");
    expect(classifyPath("package.json")).toBe("review_required");
  });

  it("blocks protected paths from automatic PR content", () => {
    const result = assertPathsSafeForAutoMerge(["content/blog/a.mdx", "package.json"]);
    expect(result.ok).toBe(false);
  });

  it("marks title/meta improvements as low-risk action types", () => {
    expect(SAFE_AUTO_MERGE_ACTIONS.has("IMPROVE_TITLE_DESCRIPTION")).toBe(true);
    expect(SAFE_AUTO_MERGE_ACTIONS.has("CREATE_ARTICLE")).toBe(false);
  });
});

describe("cadence", () => {
  it("prefers foundation-first without a blog", () => {
    const c = recommendCadence({
      blogExists: false,
      gscConnected: false,
      issueCount: 2,
      opportunityCount: 0,
      plan: "free",
    });
    expect(c.preferUpdatesOverNew).toBe(true);
    expect(c.label).toBe("Foundation first");
  });
});

describe("secrets and quality gates", () => {
  it("detects github pats", () => {
    expect(scanForSecrets("token ghp_abcdefghijklmnopqrstuvwxyz0123456789")).toContain(
      "github_pat",
    );
  });

  it("fails gates on fabricated claim patterns", () => {
    const gates = runContentQualityGates({
      files: [
        {
          path: "content/blog/a.mdx",
          content: "# Title\n\nWe saw a 85% increase according to a study.",
        },
      ],
      productName: "Acme",
    });
    expect(gatesPassed(gates)).toBe(false);
  });
});

describe("agent schemas", () => {
  it("accepts a minimal intelligence profile", () => {
    const summary = {
      commitSha: "abc",
      paths: ["package.json", "content/blog/hi.mdx"],
      directoryMap: ["content", "app"],
      files: {
        "package.json": JSON.stringify({ name: "demo", dependencies: { next: "15.0.0" } }),
        "README.md": "Demo product for teams",
      },
      detected: {
        framework: "next-app-router",
        packageManager: "pnpm",
        blogDirectories: ["content/blog"],
        contentFiles: ["content/blog/hi.mdx"],
        hasSitemap: false,
        hasRobots: false,
        appRoot: "src/app",
        sitemap: {
          kind: "none",
          path: null,
          isHomepageOnly: false,
          hasGenerateSitemaps: false,
        },
        robots: { kind: "none", path: null },
        layout: {
          path: null,
          hasMetadataExport: false,
          hasGenerateMetadata: false,
          hasOpenGraph: false,
          hasTwitterCard: false,
          hasCanonical: false,
          hasJsonLd: false,
        },
        hasNextSitemapPackage: false,
      },
    } satisfies RepoAnalysisSummary;

    const profile = buildHeuristicIntelligence(summary, "demo");
    expect(projectIntelligenceProfileSchema.parse(profile).product.name).toBe("demo");
  });

  it("validates action selection shape", () => {
    const parsed = actionSelectionSchema.parse({
      candidates: [{ actionType: "NO_ACTION", score: 10, rationale: "none" }],
      selected: {
        actionType: "NO_ACTION",
        target: "n/a",
        primaryQueryOrIssue: "none",
        whyNow: "insufficient value",
        evidence: [],
        expectedUserValue: "none",
        expectedBusinessValue: "none",
        requiredRepositoryChanges: [],
        requiredResearch: [],
        risks: [],
        confidence: 0.9,
        qualityGates: [],
        estimatedCreditCost: 0,
        humanReviewMandatory: false,
      },
      decisionSummary: "No action",
    });
    expect(parsed.selected.actionType).toBe("NO_ACTION");
  });

  it("maps credit weights", () => {
    expect(CREDIT_WEIGHTS.CREATE_ARTICLE).toBeGreaterThan(
      CREDIT_WEIGHTS.IMPROVE_TITLE_DESCRIPTION,
    );
  });
});

describe("work program action selection", () => {
  it("defaults onboarding to publish_posts + seo_health", () => {
    const enabled = defaultWorkProgramInputs()
      .filter((p) => p.enabled)
      .map((p) => p.programKey)
      .sort();
    expect(enabled).toEqual(["publish_posts", "seo_health"]);
  });

  it("scopes publish_posts to CREATE_ARTICLE only", () => {
    expect(actionTypesForPrograms(["publish_posts"])).toEqual(["CREATE_ARTICLE"]);
  });

  it("hard-constrains the cycle to preferred program types", () => {
    const preferred = actionTypesForPrograms(["publish_posts"]);
    const allEnabled = actionTypesForPrograms(["publish_posts", "improve_content"]);
    expect(resolveCycleActionTypes(["publish_posts"], preferred, allEnabled)).toEqual([
      "CREATE_ARTICLE",
    ]);
  });

  it("picks CREATE_ARTICLE when publish_posts is in scope and a blog exists", () => {
    const selection = heuristicSelectAction(
      {
        website: { blogExists: true, contentPages: ["content/blog/hello.mdx"] },
      } as never,
      {},
      ["CREATE_ARTICLE", "IMPROVE_TITLE_DESCRIPTION"],
    );
    expect(selection.selected.actionType).toBe("CREATE_ARTICLE");
  });

  it("picks FIX_TECHNICAL_SEO when technical gaps exist", () => {
    const selection = heuristicSelectAction(
      { website: { blogExists: true, contentPages: [] } } as never,
      { technical: ["Missing sitemap"] },
      ["CREATE_ARTICLE", "FIX_TECHNICAL_SEO", "IMPROVE_TITLE_DESCRIPTION"],
    );
    expect(selection.selected.actionType).toBe("FIX_TECHNICAL_SEO");
  });

  it("rejects out-of-scope AI selections when running publish_posts", () => {
    const outOfScope = actionSelectionSchema.parse({
      candidates: [
        { actionType: "IMPROVE_TITLE_DESCRIPTION", score: 90, rationale: "bias" },
      ],
      selected: {
        actionType: "IMPROVE_TITLE_DESCRIPTION",
        target: "blog",
        primaryQueryOrIssue: "CTR",
        whyNow: "soft preference ignored",
        evidence: [],
        expectedUserValue: "x",
        expectedBusinessValue: "y",
        requiredRepositoryChanges: [],
        requiredResearch: [],
        risks: [],
        confidence: 0.9,
        qualityGates: [],
        estimatedCreditCost: 1,
        humanReviewMandatory: false,
      },
      decisionSummary: "Wrong program",
    });
    const clamped = clampSelectionToAllowed(outOfScope, ["CREATE_ARTICLE"], () =>
      heuristicSelectAction(
        { website: { blogExists: true, contentPages: ["a.mdx"] } } as never,
        {},
        ["CREATE_ARTICLE"],
      ),
    );
    expect(clamped.selected.actionType).toBe("CREATE_ARTICLE");
  });
});

describe("crypto", () => {
  it("hashes tokens stably", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abcd"));
  });
});

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
import { sha256 } from "@/lib/crypto";
import {
  applyMetadataPatches,
  assertUpdatePreservesBody,
  upsertFrontmatterFields,
} from "@/modules/content-patch/frontmatter";
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

describe("crypto", () => {
  it("hashes tokens stably", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abcd"));
  });
});

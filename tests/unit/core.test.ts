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
  assertPathsSafeForAutoMerge,
  classifyPath,
  SAFE_AUTO_MERGE_ACTIONS,
} from "@/modules/github/path-policy";

describe("path policy", () => {
  it("classifies content as allowed and env as protected", () => {
    expect(classifyPath("content/blog/hello.mdx")).toBe("allowed");
    expect(classifyPath(".env.local")).toBe("protected");
    expect(classifyPath("package.json")).toBe("review_required");
  });

  it("blocks auto-merge when review paths touched", () => {
    const result = assertPathsSafeForAutoMerge(["content/blog/a.mdx", "package.json"]);
    expect(result.ok).toBe(false);
  });

  it("allows safe auto-merge action types", () => {
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

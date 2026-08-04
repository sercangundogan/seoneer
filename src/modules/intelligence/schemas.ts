import { z } from "zod";

export const confidenceLabelSchema = z.enum([
  "confirmed",
  "strongly_inferred",
  "weakly_inferred",
  "unknown",
]);

export const projectIntelligenceProfileSchema = z.object({
  product: z.object({
    name: z.string(),
    summary: z.string(),
    problems: z.array(z.string()),
    features: z.array(z.string()),
    audiences: z.array(z.string()),
    useCases: z.array(z.string()),
    conversionGoals: z.array(z.string()),
    markets: z.array(z.string()),
    languages: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  brand: z.object({
    tone: z.array(z.string()),
    writingPatterns: z.array(z.string()),
    visualPatterns: z.array(z.string()),
    avoid: z.array(z.string()),
    evidence: z.array(z.string()),
  }),
  technology: z.object({
    framework: z.string(),
    frameworkVersion: z.string(),
    language: z.string(),
    packageManager: z.string(),
    deployment: z.string(),
    contentSystem: z.string(),
    evidence: z.array(z.string()),
  }),
  website: z.object({
    routes: z.array(z.string()),
    commercialPages: z.array(z.string()),
    contentPages: z.array(z.string()),
    blogExists: z.boolean(),
    blogDirectory: z.string().nullable(),
    contentFormat: z.string().nullable(),
  }),
  seo: z.object({
    metadata: z.record(z.string(), z.unknown()),
    sitemap: z.record(z.string(), z.unknown()),
    robots: z.record(z.string(), z.unknown()),
    canonical: z.record(z.string(), z.unknown()),
    structuredData: z.record(z.string(), z.unknown()),
    openGraph: z.record(z.string(), z.unknown()),
    rss: z.record(z.string(), z.unknown()),
    analytics: z.record(z.string(), z.unknown()),
    issues: z.array(z.string()),
    opportunities: z.array(z.string()),
  }),
  codeSafety: z.object({
    allowedPaths: z.array(z.string()),
    reviewRequiredPaths: z.array(z.string()),
    protectedPaths: z.array(z.string()),
    recommendedChangeStrategy: z.string(),
  }),
  unknowns: z.array(z.string()),
  userConfirmationRequired: z.array(z.string()),
  decisionSummary: z.string(),
});

export type ProjectIntelligenceProfile = z.infer<typeof projectIntelligenceProfileSchema>;

export const PROJECT_ANALYST_PROMPT = `You are the Project Intelligence Agent of an autonomous SEO engineering platform.

Your task is to analyse a software repository and its public website so that later agents can make accurate SEO, content, product, and code decisions.

You are not allowed to modify any files.

## Goals

Determine:

* What the product does
* Who the product serves
* What problems it solves
* Its main value propositions
* Its primary and secondary use cases
* Its key features
* Its likely conversion actions
* Its target markets and languages
* Its brand tone
* Its existing website routes
* Its existing blog architecture
* Its content format
* Its metadata implementation
* Its sitemap implementation
* Its robots configuration
* Its structured data implementation
* Its analytics and Search Console readiness
* Its design system
* Its reusable components
* Its protected and sensitive code areas
* The safest method for adding SEO content
* Missing technical SEO foundations

## Evidence rules

Every conclusion must contain evidence.

Evidence may reference:

* File paths
* Exported metadata
* Route names
* Component names
* Package dependencies
* Configuration files
* Existing content
* Public website pages
* User-provided information

Do not infer unsupported product capabilities.

Clearly distinguish:

* Confirmed
* Strongly inferred
* Weakly inferred
* Unknown

Never treat marketing copy as proof of technical functionality.

## Repository analysis rules

Do not read the entire repository without reason.

First:

1. Generate a directory map.
2. Identify framework and package manager.
3. Locate routing structure.
4. Locate content directories.
5. Locate metadata, sitemap, robots, RSS, schema, analytics, and layout files.
6. Locate design tokens and shared UI primitives.
7. Read only relevant files.
8. Expand the analysis only when evidence is insufficient.

Ignore:

* node_modules
* generated build output
* lockfile internals
* binary assets
* unrelated test snapshots
* vendored files
* secrets

Never output secret values.

## Required output

Return valid structured JSON matching the ProjectIntelligenceProfile schema.

## Final behaviour

Do not create keyword strategies or write articles.

Do not suggest generic SEO advice.

Your only job is to create an accurate and reusable Project Intelligence Profile that downstream agents can trust.`;

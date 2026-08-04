import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
  date,
} from "drizzle-orm/pg-core";

export const memberRoleEnum = pgEnum("member_role", ["owner", "member"]);
export const publicationModeEnum = pgEnum("publication_mode", [
  "review_all",
  "one_click",
  "auto_safe",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "onboarding",
  "active",
  "paused",
  "error",
]);
export const seoActionStatusEnum = pgEnum("seo_action_status", [
  "queued",
  "researching",
  "briefing",
  "executing",
  "validating",
  "awaiting_approval",
  "merged",
  "failed",
  "skipped",
  "cancelled",
]);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "aborted",
]);
export const mergeStatusEnum = pgEnum("merge_status", [
  "open",
  "merged",
  "closed",
  "failed",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "paused",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspace_members_unique").on(t.workspaceId, t.userId)],
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  primarySeoGoal: text("primary_seo_goal"),
  publicationMode: publicationModeEnum("publication_mode").notNull().default("review_all"),
  status: projectStatusEnum("status").notNull().default("onboarding"),
  recommendedCadence: jsonb("recommended_cadence"),
  defaultBranch: text("default_branch"),
  agentStatus: text("agent_status").default("idle"),
  agentStatusDetail: text("agent_status_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const githubInstallations = pgTable("github_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  installationId: bigint("installation_id", { mode: "number" }).notNull().unique(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectRepositories = pgTable("project_repositories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  installationId: uuid("installation_id")
    .notNull()
    .references(() => githubInstallations.id, { onDelete: "cascade" }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull(),
  htmlUrl: text("html_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectIntelligenceProfiles = pgTable(
  "project_intelligence_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    profile: jsonb("profile").notNull(),
    userOverrides: jsonb("user_overrides"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("intelligence_project_version").on(t.projectId, t.version)],
);

export const gscConnections = pgTable("gsc_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  siteUrl: text("site_url").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  scopes: text("scopes").array(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gscSnapshots = pgTable("gsc_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => gscConnections.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  queryRows: jsonb("query_rows").notNull().default([]),
  pageRows: jsonb("page_rows").notNull().default([]),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seoAudits = pgTable("seo_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  findings: jsonb("findings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seoRoadmaps = pgTable("seo_roadmaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull().default([]),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const keywordOpportunities = pgTable("keyword_opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  metrics: jsonb("metrics").notNull().default({}),
  score: numeric("score"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitorResearchCache = pgTable("competitor_research_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  cacheKey: text("cache_key").notNull(),
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cachedRepoSummaries = pgTable(
  "cached_repo_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    summary: jsonb("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cached_repo_sha").on(t.projectId, t.commitSha)],
);

export const seoActions = pgTable("seo_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  status: seoActionStatusEnum("status").notNull().default("queued"),
  selection: jsonb("selection"),
  brief: jsonb("brief"),
  creditCost: integer("credit_cost").notNull().default(1),
  creditsReserved: boolean("credits_reserved").notNull().default(false),
  humanReviewMandatory: boolean("human_review_mandatory").notNull().default(true),
  decisionSummary: text("decision_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  seoActionId: uuid("seo_action_id").references(() => seoActions.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  status: agentRunStatusEnum("status").notNull().default("pending"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  decisionSummary: text("decision_summary"),
  model: text("model"),
  estimatedCostUsd: numeric("estimated_cost_usd"),
  actualCostUsd: numeric("actual_cost_usd"),
  durationMs: integer("duration_ms"),
  confidence: numeric("confidence"),
  retryReason: text("retry_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pullRequests = pgTable("pull_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  seoActionId: uuid("seo_action_id")
    .notNull()
    .references(() => seoActions.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  branch: text("branch").notNull(),
  baseBranch: text("base_branch").notNull(),
  commitSha: text("commit_sha").notNull(),
  prNumber: integer("pr_number"),
  prUrl: text("pr_url"),
  qualityReport: jsonb("quality_report"),
  checks: jsonb("checks"),
  mergeStatus: mergeStatusEnum("merge_status").notNull().default("open"),
  mergedAt: timestamp("merged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalTokens = pgTable("approval_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  pullRequestId: uuid("pull_request_id")
    .notNull()
    .references(() => pullRequests.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull().default("approve_and_publish"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByUserId: text("used_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" })
    .unique(),
  dodoCustomerId: text("dodo_customer_id"),
  dodoSubscriptionId: text("dodo_subscription_id"),
  plan: text("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seoActionCredits = pgTable("seo_action_credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageLedgers = pgTable("usage_ledgers", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull().default(1),
  seoActionId: uuid("seo_action_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_provider_external").on(t.provider, t.externalId)],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("email"),
  template: text("template").notNull(),
  payload: jsonb("payload").notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  userId: text("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const freeEntitlements = pgTable("free_entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" })
    .unique(),
  initialAnalysisUsed: boolean("initial_analysis_used").notNull().default(false),
  initialAuditUsed: boolean("initial_audit_used").notNull().default(false),
  keywordViewsUsed: integer("keyword_views_used").notNull().default(0),
  keywordViewsLimit: integer("keyword_views_limit").notNull().default(20),
  briefUsed: boolean("brief_used").notNull().default(false),
  samplePrUsed: boolean("sample_pr_used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

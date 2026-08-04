# Implementation Phases

## Phase 0 — Architecture docs

Deliver all files under `docs/`. Stop for review before large implementation if needed; otherwise continue sequentially.

**Exit:** docs complete and consistent with product vision.

## Phase 1 — Foundation

- Scaffold Next.js App Router + TypeScript strict
- ESLint, Vitest, scripts: `typecheck`, `lint`, `test`, `build`
- Drizzle + PostgreSQL schema bootstrap (auth + workspaces + projects stubs)
- Better Auth with GitHub OAuth
- Zod env validation
- Sentry + PostHog stubs
- Design tokens + app shell + marketing landing stub
- `.env.example`, README

**Exit:** typecheck, lint, tests, build pass; user can sign in in local env when secrets present.

## Phase 2 — Workspaces, projects, GitHub App

- Workspace creation on first login
- GitHub App install link + webhook (install/uninstall)
- Repo picker → project + `project_repositories`
- GitHub client: create branch, commit files, open PR (never default branch)
- Path policy helpers

**Exit:** install → select repo → project record; unit tests for path policy.

## Phase 3 — Repository analysis + intelligence

- Trigger.dev task: analyse repository
- Directory map + selective file reads + cache by commit SHA
- Project Intelligence Agent + Zod schema
- Confirm/edit UI for product summary
- Persist profile versions + audit log

**Exit:** confirmed profile stored; analysis job retryable.

## Phase 4 — GSC + audit + roadmap

- GSC OAuth connect + encrypted tokens + snapshots
- Initial audit job (technical + content + GSC keywords)
- Roadmap persistence + UI
- Cadence recommendation stub from audit signals

**Exit:** audit + roadmap visible on project.

## Phase 5 — Action selection + research + brief

- `seo.runActionCycle` orchestration start
- Action Selection Agent + credit reservation
- Researcher + Content Architect stages
- Brief UI; handle `NO_ACTION` / `WAIT` / `REQUEST_PRODUCT_INFORMATION`

**Exit:** selected action + brief or explainable stop.

## Phase 6 — Execution + quality gates + PR

- Writer + SEO Reviewer
- Code Agent → branch + commits
- Validation pipeline (content/SEO checks + optional repo scripts)
- Open PR with summary + quality report
- Activity log entries

**Exit:** sample PR opened against fixture or real test repo.

## Phase 7 — Approvals and publish modes

- Resend email template
- Signed approval tokens
- Merge revalidation
- Auto-merge safe allowlist
- Dashboard approve/reject

**Exit:** email approve path works in staging; replay rejected.

## Phase 8 — Billing

- Dodo products/plans wiring
- Free entitlement grants
- Webhooks idempotent
- Credit ledger + upgrade CTA
- Pause on failed payment

**Exit:** free limits enforced; paid credits unlock cycles.

## Phase 9 — Monitoring + polish

- Performance Analyst scheduled job
- Feed outcomes into selection context
- Dashboard polish (five questions)
- Cadence recommendations refined
- Audit log completeness pass

**Exit:** MVP definition of done from `02-mvp-scope.md`.

## Phase exit checklist (every phase)

1. Run typecheck  
2. Run lint  
3. Run tests  
4. Run build  
5. Summarise changes  
6. List remaining risks  
7. Do not silently ignore failures  

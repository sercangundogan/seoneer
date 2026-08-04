# Testing Strategy

## Principles

- Prefer fast unit tests for pure domain logic
- Mock external systems (GitHub, GSC, Dodo, AI, Resend)
- Use fixture repositories for MDX/Next.js analysis
- Phase exit requires typecheck, lint, test, build — failures are blocking

## Layers

### Unit

- Zod agent contracts (valid/invalid fixtures)
- Action scoring helpers and credit weight mapping
- Path policy (allowed / review / protected)
- Approval token hash + expiry + replay guards
- Secret pattern scanner
- Cadence recommendation pure functions

### Integration

- Drizzle queries against test database (or transactional test DB)
- Route handler authz (unauthorized cross-workspace)
- Webhook idempotency (`webhook_events` unique)
- Trigger task handlers with mocked module deps

### Job / agent

- Each stage: given fixed input → schema-valid output (AI mocked to return fixtures)
- Orchestrator abort paths: low confidence, failed gates, `NO_ACTION`
- Retry requires `retry_reason`

### End-to-end (selective)

- Onboarding happy path with mocked GitHub App
- Approval link merge revalidation happy path + replay failure
- Free entitlement exhaustion blocks second sample PR

## Fixtures

`tests/fixtures/repos/next-mdx-blog/` — minimal Next.js App Router blog with:

- `app/blog/**`
- MDX posts
- metadata / sitemap / robots samples
- intentional SEO gaps for audit tests

## Tooling

- Vitest for unit/integration
- Playwright optional later for UI e2e (not required for Phase 1)
- CI runs `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Quality gates for generated content (product, not only CI)

Covered in SEO Reviewer + `seo.validateRepo`; regression tests assert gate runner marks known-bad fixtures as fail (fabricated claim patterns, missing canonical, broken internal link).

## Definition of done per PR/phase

- New behaviour covered by tests at the appropriate layer
- No skipped failing tests without documented risk in phase summary
- Types strict; no `any` escapes without justification

# Folder Structure

Monorepo-style single app at repository root (no unnecessary `apps/` split in MVP).

```
seoneer/
  docs/                          # Architecture deliverables
  drizzle/
    schema/                      # Table definitions split by domain
    migrations/
  public/
  src/
    app/
      (marketing)/               # Landing
      (auth)/                    # Sign-in routes
      (app)/                     # Authenticated shell
        dashboard/
        onboarding/
        projects/[projectId]/
          overview/
          intelligence/
          roadmap/
          actions/
          activity/
          settings/
      api/
        auth/[...all]/
        github/
        gsc/
        projects/
        actions/
        approvals/
        billing/
        webhooks/
    components/
      ui/                        # Primitives
      dashboard/
      onboarding/
    modules/
      auth/
      workspaces/
      projects/
      github/
      repo-analysis/
      intelligence/
      seo-strategy/
      keywords/
      competitors/
      content-planning/
      content-generation/
      technical-seo/
      pull-requests/
      jobs/
      search-console/
      billing/
      notifications/
      audit-logs/
    lib/
      db.ts
      env.ts
      ai/                        # Provider facade
      crypto/
      urls.ts
    styles/
      globals.css
  trigger/                       # Trigger.dev tasks
    seo/
    project/
    billing/
    notify/
  tests/
    unit/
    integration/
    fixtures/repos/
  package.json
  tsconfig.json
  drizzle.config.ts
  trigger.config.ts
  next.config.ts
  eslint.config.mjs
  vitest.config.ts
  README.md
  .env.example
```

## Module package shape

Each module typically:

```
modules/<name>/
  index.ts           # public API
  schemas.ts         # Zod
  service.ts         # domain functions
  policy.ts          # authz helpers when needed
  types.ts
```

No generic `BaseRepository` / `ServiceManager` layers.

## Import rules

- `app/**` may import `modules/**`, `components/**`, `lib/**`
- `modules/**` must not import from `app/**` or React components
- `trigger/**` calls `modules/**` and `lib/**`
- Route handlers stay thin

## Design tokens

CSS variables in `src/styles/globals.css`; UI primitives in `components/ui`.

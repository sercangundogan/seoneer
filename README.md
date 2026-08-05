# Seoneer

Autonomous SEO engineer for GitHub-hosted Next.js software projects.

Changes ship as Pull Requests. The system prefers high-value, people-first actions over content volume.

## Documentation

Architectural deliverables live in [`docs/`](./docs/):

| Doc | Topic |
|---|---|
| [01-prd](./docs/01-prd.md) | Product requirements |
| [02-mvp-scope](./docs/02-mvp-scope.md) | MVP / non-MVP |
| [03-user-flows](./docs/03-user-flows.md) | User flows |
| [04-system-architecture](./docs/04-system-architecture.md) | System architecture |
| [05-database-schema](./docs/05-database-schema.md) | Database schema |
| [06-github-app-permissions](./docs/06-github-app-permissions.md) | GitHub App permissions |
| [07-background-jobs](./docs/07-background-jobs.md) | Background jobs |
| [08-agent-contracts](./docs/08-agent-contracts.md) | Agent contracts |
| [09-folder-structure](./docs/09-folder-structure.md) | Folder structure |
| [10-security-threat-model](./docs/10-security-threat-model.md) | Security |
| [11-cost-model](./docs/11-cost-model.md) | Cost model |
| [12-billing-model](./docs/12-billing-model.md) | Billing |
| [13-design-system](./docs/13-design-system.md) | Design system |
| [14-implementation-phases](./docs/14-implementation-phases.md) | Implementation phases |
| [15-testing-strategy](./docs/15-testing-strategy.md) | Testing |

## Local development

Use **Supabase Postgres** for the database. See [docs/16-supabase-setup.md](./docs/16-supabase-setup.md).

```bash
pnpm install
cp .env.example .env
# Fill DATABASE_URL + DIRECT_URL from Supabase
pnpm db:push
pnpm dev
```

Setup guides:

- [GitHub App](./docs/18-github-app-setup.md) — `GITHUB_APP_*`
- [Dodo Payments](./docs/19-dodo-setup.md) — `DODO_*`
- [Google Search Console](./docs/20-gsc-setup.md) — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

Scripts:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm db:push`

Without AI/GitHub/GSC credentials, agents fall back to heuristics and PR creation dry-runs so the workflow can be exercised locally.

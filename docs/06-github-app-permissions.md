# GitHub App Permission Model

## Principles

- Minimum permissions required for analysis and PR delivery
- Never write to the default branch
- Never expose or commit secrets
- Protected and sensitive paths require explicit human review
- Installation is per workspace; repo selection is per project

## Permissions (MVP)

| Permission | Access | Why |
|---|---|---|
| Repository metadata | Read | List repos, default branch, basic info |
| Contents | Read & write | Read for analysis; write only to feature branches |
| Pull requests | Read & write | Create PRs, comment with summaries, read state |
| Checks | Read | Observe CI status before merge when available |

### Explicitly not requested in MVP

- Administration
- Secrets
- Workflows (write)
- Deployments (write)
- Pages
- Issues (unless later needed for REQUEST_PRODUCT_INFORMATION UX)
- Members / org administration

## Operational rules

### Branching

1. Create dedicated branch: `seoneer/<action-type>-<short-id>`
2. Commit atomically (logical units: content, metadata, sitemap, etc.)
3. Never force-push; never push to default/protected production branch
4. Open PR against default branch

### Path policy

Derived from Project Intelligence `codeSafety` and static defaults:

| Class | Examples | Policy |
|---|---|---|
| Allowed | `content/**`, `app/blog/**`, `public/robots.txt`, sitemap routes under known patterns | May change when gates pass |
| Review required | layout shells, shared UI used outside blog, package.json minor content scripts | PR + human review always |
| Protected | `.env*`, auth, middleware secrets, billing, CI secrets, deploy configs, `next.config` security headers without approval | Block autonomous edits; escalate |

Structural, dependency, authentication, API, and configuration changes always require human review regardless of publication mode.

### PR requirements

Every Seoneer PR must include:

- Human-readable summary (what / why / expected benefit)
- Machine-readable quality report (JSON, also stored in DB/R2)
- Passed and failed checks listed
- Link to activity log entry in Seoneer
- Rollback guidance (revert merge commit / close PR)

### Secrets

- Scan staged diffs for high-entropy secrets and known secret patterns before commit
- Redact tokens from logs and agent outputs
- Ignore `.env`, credential files, and lockfile internals during analysis

### Installation lifecycle

- Store `installation_id` and account metadata
- Handle suspend / uninstall webhooks: pause projects, clear usable tokens
- Re-auth path when installation missing or insufficient permissions

## Publication modes vs GitHub

| Mode | GitHub behaviour |
|---|---|
| Review every change | Open PR; wait for user merge |
| One-click approval | Open PR; merge via Seoneer after signed approval + revalidation |
| Auto-merge safe | Open PR; merge automatically only if safe allowlist + checks + path policy pass |

## Revalidation before merge

- User still authorised for workspace/project
- PR open and mergeable
- Head SHA matches recorded commit
- Required checks green (when configured)
- Subscription active / credits ok
- Project publication policy still allows merge
- Approval token unused and unexpired (for email path)

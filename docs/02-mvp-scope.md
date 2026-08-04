# MVP and Non-MVP Scope

## MVP in scope

### Onboarding and access

- Sign in with GitHub (Better Auth)
- Install GitHub App
- Select one repository (free: one project)
- Confirm/edit generated Project Intelligence Profile
- Select work programs (multi-select) and per-program periods
- Start initial analysis + free sample action

### Analysis and strategy

- Safe repository analysis (directory map → selective reads)
- Project Intelligence Profile (versioned, evidence-backed)
- Google Search Console connect (read-only)
- Initial technical, content, keyword (GSC-first), and shallow competitor audit
- Prioritised SEO roadmap
- User-selected work programs with per-program periods (schedules of record)
- Recommended publishing cadence (advisory, from audit)

### Action loop

Single highest-value action per cycle:

1. Select action
2. Research
3. Generate brief
4. Execute repository changes on a new branch
5. Run validation and quality gates
6. Open Pull Request with explanation + machine-readable quality report
7. User reviews / one-click email approve / auto-merge if safe and allowed
8. Monitor outcomes for future selection

### MVP action types

- `CREATE_ARTICLE`
- `UPDATE_ARTICLE`
- `IMPROVE_TITLE_DESCRIPTION`
- `ADD_INTERNAL_LINKS`
- `FIX_TECHNICAL_SEO`
- `BUILD_BLOG_FOUNDATION`
- `ADD_STRUCTURED_DATA`
- `UPDATE_SITEMAP`
- `IMPROVE_INDEXABILITY`
- `REQUEST_PRODUCT_INFORMATION`
- `WAIT_FOR_MORE_DATA`
- `NO_ACTION`

### Publication modes

- Review every change
- One-click approval (email + dashboard)
- Automatically merge safe changes after all checks pass

Structural, dependency, authentication, API, and configuration changes always require human review.

### Product surfaces

- Calm operations dashboard (status, why, recent, needs attention, impact)
- Activity / audit log
- Email notifications for approvals and key events
- Free entitlement + paid SEO Action credits via Dodo Payments

### Stack support (MVP)

- GitHub repositories
- Next.js App Router
- TypeScript
- Markdown or MDX blog content
- Vercel deployments (assumed; detected when possible)
- Google Search Console
- English content

## Explicitly out of MVP

| Area | Deferred |
|---|---|
| Frameworks | Pages Router-only, Remix, Astro, Nuxt, etc. |
| CMS | Contentful, Sanity, WordPress, Notion as source of truth |
| Languages | Non-English generation and localisation |
| Actions at scale | Mass comparison/landing page factories |
| Keywords | Paid keyword APIs as primary signal |
| Workspaces | Complex multi-team RBAC beyond owner/member |
| Multi-repo | Many repos under free plan |
| White-label | Custom domains / reseller |
| Chat | Chatbot-first SEO interaction |
| Guarantees | Ranking / traffic SLAs |
| Infra | Microservices split |

## Stretch candidates (post-MVP, still adjacent)

- `CREATE_LANDING_PAGE` / `CREATE_COMPARISON_PAGE` with strict product-relevance gates
- `MERGE_OVERLAPPING_CONTENT` / `REMOVE_OR_REDIRECT_CONTENT`
- Topic cluster planner UI
- Additional frameworks via adapters without premature abstraction in MVP
- Team roles (admin/editor/viewer)
- Multi-language content with explicit locale strategy

## Definition of MVP done

A founder with a Next.js MDX blog can go from signup → analysis → one validated SEO PR (or an explainable no-action) → approve/merge → see the action and rationale in the activity log, within free or paid credit limits.

# Product Requirements Document — Seoneer

## Vision

Seoneer is an autonomous SEO engineering platform for software projects. It connects to a GitHub repository, deeply understands the product and codebase, and executes the highest-value SEO actions — delivered as reviewable Pull Requests.

It is not a generic AI blog writer. It is an operations system that prefers updating, linking, fixing, and structuring over publishing volume for its own sake.

## Problem

Technical founders and small software teams know organic search matters, but:

- Recurring SEO work competes with product development
- Traditional SEO tools produce dashboards and recommendations, not shippable changes
- Generic AI content tools produce low-trust, low-value articles that damage brand and rankings
- Safe repository changes require context the founder already has but cannot continually apply

## Target user

Primary: technical SaaS founder, indie hacker, developer, or small software team who:

- Uses GitHub
- Has a Next.js + TypeScript project
- Has limited time for recurring SEO
- Wants sustainable organic growth
- Prefers reviewing changes as code
- Does not want a complicated traditional SEO dashboard

## Success metrics

| Metric | Definition |
|---|---|
| Time to first value | Minutes from signup to first actionable audit or sample PR |
| Action acceptance rate | % of Seoneer PRs merged without major rewrite |
| Organic impact | GSC clicks/impressions/position deltas attributed to merged actions |
| No-action integrity | Willingness to recommend `NO_ACTION` / `WAIT` when value is insufficient |
| Interaction cost | Median user decisions per completed SEO action (target: very low) |
| Safety | Zero default-branch writes; zero secret exposure; protected-path violations blocked |

## Product principles

1. User value over content volume
2. Helpful, people-first content
3. No keyword stuffing
4. No mass low-quality AI content
5. No unverified factual claims
6. No fabricated statistics, quotes, studies, customers, or product capabilities
7. No publication when adequate original value cannot be added
8. Human review by default
9. Safe and reversible repository changes
10. Every autonomous decision must be explainable
11. Full activity log inspectable by the user
12. Extremely low required user interactions
13. Strong defaults over excessive settings
14. Simple, explicit, typed, maintainable codebase
15. No premature microservices or over-engineered abstractions

## Core capabilities

### Understanding

- GitHub repository analysis (Next.js App Router, TypeScript, MDX/Markdown)
- Project Intelligence Profile (product, audience, brand, site structure, SEO foundations)
- Google Search Console performance data
- Competitor and content-gap signals (shallow first; deeper when justified)

### Deciding

- Prioritised SEO roadmap
- Single highest-value safe action selection per cycle
- Explicit stop conditions (`NO_ACTION`, `WAIT_FOR_MORE_DATA`, `REQUEST_PRODUCT_INFORMATION`)

### Executing

- Research and structured briefs
- Content and technical repository changes on a dedicated branch
- Validation, quality gates, and Pull Request delivery
- Email / in-app approval and optional auto-merge for safe changes

### Learning

- Monitor post-merge Search Console outcomes
- Feed results into future action selection

## Possible SEO actions

| Action | Description |
|---|---|
| `CREATE_ARTICLE` | New high-quality blog article |
| `UPDATE_ARTICLE` | Improve an existing article |
| `IMPROVE_TITLE_DESCRIPTION` | Titles and meta descriptions |
| `ADD_INTERNAL_LINKS` | Contextual internal links |
| `FIX_TECHNICAL_SEO` | Technical SEO fixes |
| `ADD_STRUCTURED_DATA` | Structured data |
| `CREATE_LANDING_PAGE` | Product-relevant landing page (limited in MVP) |
| `CREATE_COMPARISON_PAGE` | Comparison page (post-MVP primary) |
| `MERGE_OVERLAPPING_CONTENT` | Resolve cannibalisation |
| `REMOVE_OR_REDIRECT_CONTENT` | Cleanup / redirects |
| `BUILD_BLOG_FOUNDATION` | Blog structure when missing |
| `UPDATE_SITEMAP` | Sitemap / RSS updates |
| `IMPROVE_INDEXABILITY` | Robots, canonicals, index signals |
| `REQUEST_PRODUCT_INFORMATION` | Ask user for missing product facts |
| `WAIT_FOR_MORE_DATA` | Defer until GSC/authority/content maturity improves |
| `NO_ACTION` | Explicitly do nothing this cycle |

## Non-goals (product)

- Replacing a full CMS or marketing suite
- Guaranteeing rankings or traffic
- Acting as a chatbot-first interface
- Publishing unverified claims to “win” keywords
- Supporting every framework and CMS in MVP

## Constraints

- Initial stack: GitHub, Next.js App Router, TypeScript, MD/MDX, Vercel, GSC, English
- All normal code/content changes via GitHub PR
- Long AI, analysis, crawl, and build work must not run inside regular HTTP requests
- Modular monolith; feature-oriented modules; domain logic outside React and route handlers

## Acceptance criteria (product-level)

A user can:

1. Sign in and install the GitHub App
2. Select a repository and receive a Project Intelligence Profile
3. Confirm or edit the product summary
4. Connect Search Console
5. Receive an initial audit and prioritised roadmap
6. Have Seoneer select and execute one highest-value action as a PR (or correctly choose no action)
7. Approve via dashboard or signed email link, or use safe auto-merge
8. Inspect a full activity log with decision summaries and evidence
9. Stay within free or paid SEO Action credit limits without seeing model token meters

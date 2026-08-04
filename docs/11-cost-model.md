# Cost Model

## Goals

- Keep unit economics viable on SEO Action credits
- Prefer high expected value per dollar of model + infra spend
- Prevent repeated generation loops

## Cost drivers

1. AI model tokens (by stage and tier)
2. Trigger.dev compute time (analysis, builds)
3. GitHub API rate usage (soft cost)
4. GSC API usage (soft cost)
5. R2 storage for artifacts
6. Email volume

## Controls

| Control | Mechanism |
|---|---|
| Model routing | Low-cost for classification/scoring; strong only for analyst/strategist/writer/code |
| Cache repo summaries | `cached_repo_summaries` keyed by commit SHA; analyse diffs when possible |
| Shallow-first discovery | Score candidates cheaply before Researcher/Writer |
| GSC-first keywords | Avoid paid keyword APIs in MVP |
| Reuse research | `competitor_research_cache` with TTL |
| Credit caps | Per workspace monthly SEO Action credits; per-project concurrency 1 |
| Track costs | `agent_runs.estimated_cost_usd` / `actual_cost_usd` |
| Anti-loop | Max retries; explicit `retry_reason`; abort on low confidence |
| Stop early | `NO_ACTION` / `WAIT` / failed gates release or avoid deep spend |

## Estimated credit weights (MVP defaults)

| Action class | Credits |
|---|---|
| `NO_ACTION` / `WAIT_FOR_MORE_DATA` | 0 |
| `REQUEST_PRODUCT_INFORMATION` | 0–1 |
| `IMPROVE_TITLE_DESCRIPTION` | 1 |
| `ADD_INTERNAL_LINKS` / `UPDATE_SITEMAP` / `ADD_STRUCTURED_DATA` | 1–2 |
| `FIX_TECHNICAL_SEO` / `IMPROVE_INDEXABILITY` | 2 |
| `UPDATE_ARTICLE` | 2–3 |
| `BUILD_BLOG_FOUNDATION` | 3 |
| `CREATE_ARTICLE` | 3–4 |

Exact costs are stored on the selected action and shown as Action credits — never as model tokens.

## Free tier cost containment

- One repository
- Initial analysis + audit
- Limited keyword opportunities
- One content brief
- One sample PR

Deep research and additional PRs require paid credits.

## Monitoring

- Weekly aggregate: cost per merged action, cost per project, abort rate, retry rate
- Alert when project cost spikes without merges

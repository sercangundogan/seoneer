# Billing Model

## Provider

**Dodo Payments** for subscriptions, customer portal, and webhooks.

## Conceptual product

Users buy **SEO Action credits**, not model tokens. Credits map to valuable completed work units (selected and executed actions / sample entitlements).

## Plans (initial)

| Plan | Price | Repos | Monthly SEO Action credits | Notes |
|---|---|---|---|---|
| Free | $0 | 1 | Entitlement pack (not recurring unlimited) | Analysis, audit, limited keywords, 1 brief, 1 sample PR |
| Starter | $39/mo | 1 | 10 | Core loop |
| Growth | $99/mo | 3 | 30 | Small teams |
| Scale | $249/mo | 10 | 100 | Higher caps |

Prices are shown on `/billing` from Dodo product data (with static fallbacks). Charge amounts live on the Dodo products.

## Free entitlement

On workspace create (or first project):

- Grant free entitlement flags / ledger entries for: initial analysis, initial audit, limited keyword views, one brief, one sample PR
- Track consumption in `usage_ledgers`
- Soft upsell when entitlement exhausted

## Subscription lifecycle

Supported:

- Trial (optional via Dodo) or free entitlement
- Upgrade / downgrade
- Cancellation
- Failed payment → grace period → pause action cycles
- Customer portal access
- Idempotent webhook processing via `webhook_events(provider, external_id)`

## Credit ledger

- `seo_action_credits.balance` per workspace per billing period
- Reserve credits when action selected and deep work begins
- Commit on PR opened (or merge — prefer commit at PR open to prevent abuse)
- Release on early abort before expensive stages when policy says so
- Never show token counts in UI

## Webhooks

Handle at minimum:

- subscription created/updated/cancelled
- invoice/payment succeeded/failed
- checkout completed

All handlers: verify signature → insert webhook event uniquely → process → mark processed.

## Authorisation coupling

Before enqueueing paid action cycles or merging:

- Subscription status active (or free entitlement remaining)
- Sufficient credits for estimated cost
- Project not paused

## UX

- Settings → Billing: plan, credits remaining, portal link, upgrade
- Dashboard banner when credits low
- Clear copy: “SEO Actions” not “tokens”

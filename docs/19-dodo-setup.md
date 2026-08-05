# Dodo Payments setup

## API key & products

Put your secret API key in `.env`:

```env
DODO_API_KEY=test_...   # sandbox — use test_* keys only in test mode
DODO_WEBHOOK_SECRET=whsec_...
DODO_PRODUCT_STARTER=pdt_...
DODO_PRODUCT_GROWTH=pdt_...
DODO_PRODUCT_SCALE=pdt_...
```

Create **subscription products** in the Dodo dashboard for Starter, Growth, and Scale. Copy each product ID into the matching env var. Without product IDs, upgrade buttons stay disabled.

Checkout uses `POST /checkouts` with `metadata.workspace_id` so webhooks can activate the correct workspace.

## Testing without a real charge

1. Use a **test mode** API key (`test_…`) from the Dodo dashboard.
2. Billing page shows a test-mode banner with the sandbox card: `4242 4242 4242 4242`, expiry `06/32`, CVC `123`.
3. Complete checkout on Dodo’s hosted page — no real money moves.
4. Point webhooks to your public URL (ngrok or production) so `subscription.active` updates plan + credits.

Other test cards: `4000 0000 0000 0002` (decline), `4000 0000 0000 9995` (insufficient funds).

## Webhook endpoint (dashboard)

Dodo requires a **public HTTPS** URL. `http://localhost:3000` will not work.

### Local testing

```bash
npx ngrok http 3000
```

Use:

```text
https://<your-subdomain>.ngrok-free.app/api/webhooks/dodo
```

### Production (Vercel)

```text
https://your-domain.com/api/webhooks/dodo
```

### Form values

| Field | Value |
|---|---|
| Integration | **Custom webhook** |
| Endpoint URL | `https://…/api/webhooks/dodo` |
| Description | `Seoneer billing` |
| Enabled | On |

### Subscribed events (MVP)

Select these (do not leave “all events” unless you want noise):

**Subscription**
- `subscription.active`
- `subscription.renewed`
- `subscription.plan_changed`
- `subscription.updated`
- `subscription.cancelled`
- `subscription.expired`
- `subscription.failed`
- `subscription.on_hold`

**Payment**
- `payment.succeeded`
- `payment.failed`

Optional later: `refund.succeeded`, `dispute.*`

## Webhook secret

After the endpoint is created:

1. Open the webhook → copy **Secret / Signing key**
2. Put it in `.env`:

```env
DODO_WEBHOOK_SECRET=whsec_...
```

Restart `pnpm dev` after saving.

## Handler in this repo

Route: [`src/app/api/webhooks/dodo/route.ts`](../src/app/api/webhooks/dodo/route.ts)

It verifies Standard Webhooks signatures, enqueues processing, and updates subscription/credits when `workspace_id` is present in event metadata.

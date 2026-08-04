# Dodo Payments setup

## API key

Put your secret API key in `.env`:

```env
DODO_API_KEY=...
```

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

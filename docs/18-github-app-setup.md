# GitHub App setup

The **GitHub App** grants Seoneer repo access (analysis + PRs).  
This is separate from the **OAuth App** used for Better Auth sign-in.

## 1. Create the app

1. Open [https://github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Fill in:

| Field | Value (local) | Value (production) |
|---|---|---|
| **GitHub App name** | `Seoneer` | same |
| **Homepage URL** | `http://localhost:3000` | `https://seoneer.site` |
| **Callback URL** | `http://localhost:3000/onboarding` | `https://seoneer.site/onboarding` |
| **Setup URL** (required for redirect) | `http://localhost:3000/onboarding` | `https://seoneer.site/onboarding` |
| **Redirect on update** | Checked | Checked |
| **Webhook URL** | ngrok or disabled | `https://seoneer.site/api/github/webhooks` |
| **Webhook secret** | `GITHUB_APP_WEBHOOK_SECRET` | same |

Without a **Setup URL**, GitHub leaves users on `github.com/settings/installations/...` and Seoneer never receives `installation_id`. Onboarding can still recover via **I’ve already installed — sync**.


### Permissions → Repository permissions

| Permission | Access |
|---|---|
| **Metadata** | Read-only (required) |
| **Contents** | Read and write |
| **Pull requests** | Read and write |
| **Checks** | Read-only |

Leave everything else **No access**.

### Subscribe to events

- **Installation**
- **Installation target** (optional)

### Where can this GitHub App be installed?

- **Only on this account** (fine for personal testing), or **Any account** if you will install on orgs later.

Click **Create GitHub App**.

## 2. Collect credentials

On the app settings page:

1. **App ID** → `GITHUB_APP_ID`
2. **Client ID** → `GITHUB_APP_CLIENT_ID`
3. **Generate a new client secret** → `GITHUB_APP_CLIENT_SECRET`
4. **Generate a private key** → download the `.pem` file → `GITHUB_APP_PRIVATE_KEY`
5. Note the public URL slug (`https://github.com/apps/<slug>`) → `GITHUB_APP_SLUG`

## 3. Put the private key in `.env`

PEM files are multi-line. Store as **one line** with `\n`:

```env
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

PowerShell helper (from the downloaded `.pem` path):

```powershell
$pem = Get-Content -Raw .\path\to\seoneer.private-key.pem
$escaped = $pem -replace "`r","" -replace "`n","\n"
# Then set GITHUB_APP_PRIVATE_KEY="$escaped" in .env (keep the quotes)
```

## 4. Final `.env` block

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_APP_CLIENT_ID=Iv23...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_WEBHOOK_SECRET=<already set>
GITHUB_APP_SLUG=seoneer
```

Use your real slug if the app name was not exactly `seoneer`.

## 5. Local webhooks (optional)

GitHub cannot reach `localhost`. For install/uninstall webhooks while developing:

```bash
npx ngrok http 3000
```

Then set the GitHub App **Webhook URL** to `https://<ngrok-id>.ngrok-free.app/api/github/webhooks`.

Onboarding still works without live webhooks: after install, GitHub redirects to `/onboarding?installation_id=...` and the app registers the installation.

## 6. Verify

```bash
pnpm dev
```

Sign in → **Onboarding** → **Install GitHub App** → pick repos → continue.

### Pull requests permission (required)

If Seoneer pushes a branch but no PR appears, the app almost always lacks **Pull requests: Read and write**, or the installation has not accepted a permission update yet.

1. GitHub → **Settings → Developer settings → GitHub Apps → Seoneer → Permissions**
2. Set **Pull requests** to **Read and write** → **Save**
3. Open the installation (user or org) and **Accept** the new permissions
4. Re-run an SEO action in Seoneer

Without this, Contents write can still create branches while `pulls.create` returns `Resource not accessible by integration`.

## Do not confuse with OAuth App

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | User login (Better Auth) |
| `GITHUB_APP_*` | Repo install, analysis, PRs |

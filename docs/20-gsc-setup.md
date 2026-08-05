# Google Search Console setup

Seoneer uses **read-only** Google Search Console (GSC) access to:

- Rank real queries and pages when choosing SEO actions
- Measure click / impression / position impact after merged PRs
- Raise confidence so the agent waits less often for more data

Without GSC, analysis still runs, but with lower confidence and weaker keyword signals.

## Environment variables

Add these to `.env` (see `.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes (for real OAuth) | OAuth 2.0 Client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Yes (for real OAuth) | OAuth 2.0 Client secret |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app origin used as OAuth redirect base (e.g. `http://localhost:3000`) |
| `TOKEN_ENCRYPTION_KEY` | Yes | Encrypts the GSC refresh token at rest (min 32 characters) |

If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are empty, local **Connect Search Console** uses a **dev stub** (fake site + sample metrics) so you can exercise the product without Google credentials.

## 1. Create a Google Cloud OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services → Library** → enable **Google Search Console API**
4. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal for Workspace-only)
   - App name: `Seoneer`
   - Add your email as a test user while the app is in Testing
   - Scopes: you can leave empty here; the app requests `webmasters.readonly` at connect time
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Seoneer local` (or production)

### Authorized redirect URIs

| Environment | Redirect URI |
|---|---|
| Local | `http://localhost:3000/api/gsc/callback` |
| Production | `https://<your-domain>/api/gsc/callback` |

The path must match `${NEXT_PUBLIC_APP_URL}/api/gsc/callback` exactly.

## 2. Put credentials in `.env`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
TOKEN_ENCRYPTION_KEY=dev-encryption-key-32-characters!
```

Restart `pnpm dev` after changing env vars.

## 3. Verify in the product

1. Sign in and open a project
2. In **Search Console**, click **Connect Search Console**
3. Approve read-only access in Google
4. You should land back on the project with `?gsc=connected`

The user who connects must already have that property verified in [Google Search Console](https://search.google.com/search-console).

## Scope

Seoneer requests only:

```text
https://www.googleapis.com/auth/webmasters.readonly
```

No write access to Search Console or Analytics.

## Troubleshooting

### “App is being tested / only approved test users can access” (or Turkish: *Google doğrulama sürecini tamamlamadı*)

The OAuth consent screen is in **Testing**. Google blocks everyone except listed test users — including you, until your account is added.

1. Open [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Under **Test users**, click **Add users**
3. Add the **exact Google account email** you use on the consent screen (the one you pick when connecting GSC)
4. Save, wait ~1 minute, try **Connect Search Console** again

Publishing the app to **Production** lets any Google user connect, but sensitive scopes (including Search Console) often need Google’s verification. For personal/dev use, stay in **Testing** and add test users.

## Checklist

- [ ] Search Console API enabled
- [ ] OAuth client is **Web application**
- [ ] Redirect URI matches `NEXT_PUBLIC_APP_URL` + `/api/gsc/callback`
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set
- [ ] `TOKEN_ENCRYPTION_KEY` set (32+ chars)
- [ ] Consent screen has your Google account as a test user (while in Testing)

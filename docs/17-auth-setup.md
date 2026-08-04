# Auth setup (Better Auth + GitHub)

Seoneer signs users in with **Better Auth** and **GitHub OAuth**.  
Repository access uses a separate **GitHub App** (next step after Auth).

## 1. App secrets (local)

Already in `.env`:

```env
BETTER_AUTH_SECRET=<random 32+ bytes>
BETTER_AUTH_URL=http://localhost:3000
```

For production, set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Vercel URL.

## 2. Create a GitHub OAuth App

This is an **OAuth App**, not a GitHub App.

1. Open [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. **New OAuth App**
3. Fill in:
   - **Application name:** `Seoneer Local` (or `Seoneer`)
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Register the application
5. Copy **Client ID**
6. **Generate a new client secret** and copy it once

## 3. Put credentials in `.env`

```env
GITHUB_CLIENT_ID=Ov23...
GITHUB_CLIENT_SECRET=...
```

Do **not** put these in `GITHUB_APP_*` — those are for the GitHub App later.

## 4. Verify

```bash
pnpm dev
```

Open [http://localhost:3000/signin](http://localhost:3000/signin) → **Continue with GitHub**.

After first sign-in, Better Auth should create a user row and a workspace (via the `user.create` hook).

## Production later

Create a second OAuth App (or update URLs) with:

- Homepage: `https://your-domain.com`
- Callback: `https://your-domain.com/api/auth/callback/github`
- `BETTER_AUTH_URL=https://your-domain.com`

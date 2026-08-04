# Local setup with Supabase

Seoneer uses **Supabase only as Postgres** (Better Auth stays the auth layer).

## 1. Create a project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → set a database password and save it
3. Wait until the project is ready

## 2. Copy the connection string

**Project Settings → Database → Connection string → URI**  
Use the **Transaction** pooler URI (port `6543`).

Add `?sslmode=require` if it is missing. URL-encode special characters in the password.

## 3. Set `.env`

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
```

One URL only — no separate direct URL.

## 4. Push schema

```bash
pnpm db:push
```

## 5. Run the app

```bash
pnpm dev
```

You do **not** need Supabase Auth, Storage, or Edge Functions for the MVP.

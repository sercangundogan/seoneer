import { z } from "zod";

function resolveBetterAuthUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit && !explicit.includes("localhost")) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && !appUrl.includes("localhost")) return appUrl;
  return explicit ?? appUrl ?? "http://localhost:3000";
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/seoneer"),
  BETTER_AUTH_SECRET: z.string().min(32).default("dev-secret-change-me-32-characters!!"),
  BETTER_AUTH_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Seoneer <hello@seoneer.site>"),
  APPROVAL_TOKEN_SECRET: z.string().min(16).default("dev-approval-secret-32chars!!"),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).default("dev-encryption-key-32-characters!"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DODO_API_KEY: z.string().optional(),
  DODO_WEBHOOK_SECRET: z.string().optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DODO_ENVIRONMENT: z.enum(["test", "live", "test_mode", "live_mode"]).optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const withAuthUrl = {
    ...process.env,
    BETTER_AUTH_URL: resolveBetterAuthUrl(),
  };
  const parsed = envSchema.safeParse(withAuthUrl);
  if (!parsed.success) {
    console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();

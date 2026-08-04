import { env } from "@/lib/env";

/** Sentry stub — wire @sentry/nextjs when SENTRY_DSN is set in production. */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (env.SENTRY_DSN) {
    console.error("[sentry]", error, context);
    return;
  }
  if (env.NODE_ENV !== "test") {
    console.error(error, context);
  }
}

import { env } from "@/lib/env";

/** PostHog stub — initialize client SDK in the browser when key is present. */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
  console.info("[posthog]", event, properties);
}

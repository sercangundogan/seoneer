import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";
import { env } from "@/lib/env";

export type ModelTier = "low" | "mid" | "strong";

/** Current Anthropic Sonnet — `claude-sonnet-4-20250514` was retired June 2026. */
const ANTHROPIC_SONNET = "claude-sonnet-4-6";
const ANTHROPIC_HAIKU = "claude-haiku-4-5-20251001";

function resolveModel(tier: ModelTier) {
  if (tier === "strong" && env.ANTHROPIC_API_KEY) {
    return anthropic(ANTHROPIC_SONNET);
  }
  if (env.OPENAI_API_KEY) {
    if (tier === "low") return openai("gpt-4.1-nano");
    if (tier === "mid") return openai("gpt-4.1-mini");
    return openai("gpt-4.1");
  }
  if (env.ANTHROPIC_API_KEY) {
    if (tier === "low") return anthropic(ANTHROPIC_HAIKU);
    return anthropic(ANTHROPIC_SONNET);
  }
  return null;
}

export type StructuredGenerateArgs<T extends z.ZodType> = {
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: T;
  temperature?: number;
};

/**
 * Provider-agnostic structured generation.
 * Throws when no API keys are configured (callers should use heuristics).
 */
export async function generateStructured<T extends z.ZodType>(
  args: StructuredGenerateArgs<T>,
): Promise<{ object: z.infer<T>; model: string; estimatedCostUsd: number }> {
  const model = resolveModel(args.tier);
  if (!model) {
    throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
  }

  try {
    const result = await generateObject({
      model,
      system: args.system,
      prompt: args.prompt,
      temperature: args.temperature ?? 0.2,
      schema: args.schema,
    });

    return {
      object: result.object as z.infer<T>,
      model: args.tier,
      estimatedCostUsd: estimateCost(args.tier),
    };
  } catch (error) {
    throw new Error(formatAiError(error), { cause: error });
  }
}

/** Turn cryptic provider errors into something actionable in the UI / logs. */
export function formatAiError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown AI error";

  const raw = error.message;
  // Anthropic often returns: `model: claude-…` or JSON with not_found_error
  if (/model:\s*claude-|not_found_error|does not exist|retired/i.test(raw)) {
    return `AI model unavailable (${raw.slice(0, 120)}). Check ANTHROPIC_API_KEY and model access.`;
  }
  if (/401|authentication|invalid.?api.?key|incorrect api key/i.test(raw)) {
    return "AI authentication failed. Check ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.";
  }
  if (/429|rate.?limit|overloaded/i.test(raw)) {
    return "AI provider rate-limited. Try again in a moment.";
  }
  if (/credit|billing|quota|insufficient/i.test(raw)) {
    return "AI provider billing/quota issue. Check your Anthropic or OpenAI account.";
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

function estimateCost(tier: ModelTier): number {
  if (tier === "low") return 0.002;
  if (tier === "mid") return 0.01;
  return 0.05;
}

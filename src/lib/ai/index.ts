import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";
import { env } from "@/lib/env";

export type ModelTier = "low" | "mid" | "strong";

function resolveModel(tier: ModelTier) {
  if (tier === "strong" && env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4-20250514");
  }
  if (env.OPENAI_API_KEY) {
    if (tier === "low") return openai("gpt-4.1-nano");
    if (tier === "mid") return openai("gpt-4.1-mini");
    return openai("gpt-4.1");
  }
  if (env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4-20250514");
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
}

function estimateCost(tier: ModelTier): number {
  if (tier === "low") return 0.002;
  if (tier === "mid") return 0.01;
  return 0.05;
}

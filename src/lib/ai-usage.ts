import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { aiUsageLogs } from "./db/schema";

type AiUsageFeature = "company_lookup" | "job_posting_suggestion" | "resume_parse" | "skill_suggestion" | "match_scoring";

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} | null;

/**
 * Logs one completed AI call — called right before a route's success
 * response, from every LLM-backed endpoint. Never throws into the caller: a
 * logging failure must not turn an otherwise-successful AI response into an
 * error for the user, so this only logs the failure itself server-side.
 */
export async function logAiUsage(params: {
  userId: string;
  feature: AiUsageFeature;
  provider: string | null;
  // The specific model string sent in the request (e.g. "deepseek-chat",
  // "mimo-v2.5", "mimo-v2.5-asr") — a provider can serve more than one
  // model, so this is separate from `provider`.
  model?: string | null;
  usage: TokenUsage;
  durationMs: number | null;
  // Perplexity Search calls — no token usage to report, so this is the only
  // volume metric available for that provider.
  callCount?: number | null;
}) {
  try {
    await db.insert(aiUsageLogs).values({
      userId: params.userId,
      feature: params.feature,
      provider: params.provider,
      model: params.model ?? null,
      promptTokens: params.usage?.prompt_tokens ?? null,
      completionTokens: params.usage?.completion_tokens ?? null,
      totalTokens: params.usage?.total_tokens ?? null,
      callCount: params.callCount ?? null,
      durationMs: params.durationMs,
    });
  } catch (err) {
    console.error("Failed to log AI usage:", err);
  }
}

// Published list pricing, not a negotiated/actual rate — for an
// approximate cost estimate on the dashboard, not a billing-accurate
// figure. Rates change over time and provider dashboards are the source of
// truth for real spend.
//
// DeepSeek (deepseek-chat, standard/non-discounted hours):
//   https://api-docs.deepseek.com/quick_start/pricing — $0.27 / 1M input
//   tokens (cache miss), $1.10 / 1M output tokens, as of DeepSeek's Sept
//   2025 pricing update. Off-peak (UTC 16:30–00:30) is ~50% cheaper and
//   a cache-hit input rate is far lower ($0.07/1M) — neither is
//   distinguishable from the usage this app logs, so this always uses the
//   standard/cache-miss rate, which is a worst-case (upper-bound) estimate.
//   Source confidence: high.
//
// Perplexity Search API: https://docs.perplexity.ai/getting-started/pricing
//   — request-based, tiered by search_context_size. This app always
//   requests "high", priced at $12 / 1000 requests ($0.012/call).
//   Source confidence: medium — verify against your actual invoice.
//
// MiMo (api.xiaomimimo.com, model "mimo-v2.5"): Xiaomi has no official
// public pricing page this app could locate — the rate below is taken from
// third-party AI-pricing aggregators (e.g. pricepertoken.com), NOT from
// Xiaomi/MiMo directly, and other aggregators quote different numbers for
// other MiMo variants. Treat this as a rough guess, not a verified rate.
// Source confidence: low — replace with the real rate as soon as one is
// confirmed from Xiaomi's own docs or console.
const DEEPSEEK_INPUT_PER_M = 0.27;
const DEEPSEEK_OUTPUT_PER_M = 1.1;
const PERPLEXITY_PER_CALL = 0.012;
const MIMO_INPUT_PER_M = 1.0;
const MIMO_OUTPUT_PER_M = 3.0;

function estimateCostUsd(
  provider: string,
  promptTokens: number,
  completionTokens: number,
  callCount: number,
): number | null {
  if (provider === "deepseek") {
    return (promptTokens / 1_000_000) * DEEPSEEK_INPUT_PER_M + (completionTokens / 1_000_000) * DEEPSEEK_OUTPUT_PER_M;
  }
  if (provider === "perplexity") {
    return callCount * PERPLEXITY_PER_CALL;
  }
  if (provider === "mimo") {
    return (promptTokens / 1_000_000) * MIMO_INPUT_PER_M + (completionTokens / 1_000_000) * MIMO_OUTPUT_PER_M;
  }
  return null;
}

/**
 * The signed-in user's own AI usage, broken down by provider + model — for
 * the employer dashboard's "AI usage" card. Perplexity has no token usage (a
 * search API, not a chat completion), so its row's callCount is the volume
 * metric instead; the other providers report tokens with callCount null.
 * costUsd is an estimate from published list pricing (see above) — MiMo's
 * rate is an unverified third-party estimate, not an official Xiaomi rate.
 */
export async function getAiUsageByProviderForUser(userId: string) {
  const rows = await db
    .select({
      provider: aiUsageLogs.provider,
      model: aiUsageLogs.model,
      rowCount: sql<number>`count(*)::int`,
      totalPromptTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptTokens}), 0)::int`,
      totalCompletionTokens: sql<number>`coalesce(sum(${aiUsageLogs.completionTokens}), 0)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLogs.totalTokens}), 0)::int`,
      totalCallCount: sql<number>`coalesce(sum(${aiUsageLogs.callCount}), 0)::int`,
    })
    .from(aiUsageLogs)
    .where(eq(aiUsageLogs.userId, userId))
    .groupBy(aiUsageLogs.provider, aiUsageLogs.model);

  return rows
    .filter((r): r is typeof r & { provider: string } => !!r.provider && r.provider !== "none")
    .map((r) => {
      // Perplexity logs one row per request-with-N-search-calls, so its
      // "calls" figure is the summed callCount, not the row count.
      const calls = r.provider === "perplexity" ? r.totalCallCount : r.rowCount;
      return {
        provider: r.provider,
        model: r.model,
        calls,
        totalTokens: r.totalTokens,
        costUsd: estimateCostUsd(r.provider, r.totalPromptTokens, r.totalCompletionTokens, calls),
      };
    });
}

const RECENT_CALLS_LIMIT = 50;

/**
 * The signed-in user's own AI usage — a summary (call count + token totals)
 * plus their most recent calls, for the "AI Usage" page linked from the
 * navbar avatar menu. Every user only ever sees their own rows here; there's
 * no cross-user usage view.
 */
export async function getAiUsageForUser(userId: string) {
  const [summary] = await db
    .select({
      totalCalls: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLogs.totalTokens}), 0)::int`,
    })
    .from(aiUsageLogs)
    .where(eq(aiUsageLogs.userId, userId));

  const recent = await db
    .select()
    .from(aiUsageLogs)
    .where(eq(aiUsageLogs.userId, userId))
    .orderBy(desc(aiUsageLogs.createdAt))
    .limit(RECENT_CALLS_LIMIT);

  return {
    totalCalls: summary?.totalCalls ?? 0,
    totalTokens: summary?.totalTokens ?? 0,
    recent,
  };
}

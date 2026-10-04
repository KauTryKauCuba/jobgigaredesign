import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { aiUsageLogs } from "./db/schema";

type AiUsageFeature =
  | "company_lookup"
  | "job_posting_suggestion"
  | "resume_parse"
  | "skill_suggestion"
  | "match_scoring"
  | "cover_letter"
  | "poster_generation"
  | "assistant_chat";

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
  // Real per-call cost the provider itself reported (e.g. icreat's
  // `costUSD`) — when present, this is used instead of the published-list-
  // pricing estimate the other providers rely on.
  actualCostUsd?: number | null;
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
      actualCostUsd: params.actualCostUsd ?? null,
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
//
// icreat (Seedream 5.0 image generation): every logged row already carries
// the real per-call cost icreat's own API returns (`costUSD`, stored as
// `actualCostUsd`), so this fallback only applies to older/edge-case rows
// where that wasn't captured. $0.035/call is what a single generation
// actually cost during testing — not a published rate, just an observed one.
const DEEPSEEK_INPUT_PER_M = 0.27;
const DEEPSEEK_OUTPUT_PER_M = 1.1;
const PERPLEXITY_PER_CALL = 0.012;
const MIMO_INPUT_PER_M = 1.0;
const MIMO_OUTPUT_PER_M = 3.0;
const ICREAT_PER_CALL_FALLBACK = 0.035;

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
  if (provider === "icreat") {
    return callCount * ICREAT_PER_CALL_FALLBACK;
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
      totalActualCostUsd: sql<number | null>`sum(${aiUsageLogs.actualCostUsd})`,
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
        // Real reported cost (e.g. icreat) wins over the token-based
        // published-pricing estimate when any row in the group has one.
        costUsd:
          r.totalActualCostUsd ?? estimateCostUsd(r.provider, r.totalPromptTokens, r.totalCompletionTokens, calls),
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

export const AI_FEATURE_LABEL: Record<AiUsageFeature, string> = {
  company_lookup: "Company lookup",
  job_posting_suggestion: "Job posting writer",
  resume_parse: "Resume parsing",
  skill_suggestion: "Skill suggestions",
  match_scoring: "Match scoring",
  cover_letter: "Cover letters",
  poster_generation: "Poster generation",
  assistant_chat: "AI assistant chat",
};

type UsageTotals = { calls: number; tokens: number; costUsd: number };
function emptyTotals(): UsageTotals {
  return { calls: 0, tokens: 0, costUsd: 0 };
}
function addTo(target: UsageTotals, calls: number, tokens: number, costUsd: number) {
  target.calls += calls;
  target.tokens += tokens;
  target.costUsd += costUsd;
}

/**
 * Platform-wide AI usage for the superadmin page: totals, a per-day series,
 * a per-feature breakdown and the heaviest users, over the last `days` days
 * (Malaysia time for day boundaries). Costs are the same published-pricing
 * estimates as above — approximate, not billing-accurate.
 */
export async function getPlatformAiUsage(days = 30) {
  const rows = await db.execute<{
    day: string;
    feature: AiUsageFeature;
    provider: string | null;
    user_id: string;
    email: string | null;
    name: string | null;
    role: string | null;
    row_count: string;
    prompt_tokens: string;
    completion_tokens: string;
    total_tokens: string;
    call_count: string;
    actual_cost: number | null;
  }>(sql`
    SELECT
      to_char((l.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date, 'YYYY-MM-DD') AS day,
      l.feature,
      l.provider,
      l.user_id,
      u.email,
      u.name,
      u.role,
      count(*) AS row_count,
      coalesce(sum(l.prompt_tokens), 0) AS prompt_tokens,
      coalesce(sum(l.completion_tokens), 0) AS completion_tokens,
      coalesce(sum(l.total_tokens), 0) AS total_tokens,
      coalesce(sum(l.call_count), 0) AS call_count,
      sum(l.actual_cost_usd) AS actual_cost
    FROM ai_usage_logs l
    LEFT JOIN users u ON u.id = l.user_id
    WHERE l.created_at > now() - make_interval(days => ${days})
    GROUP BY 1, 2, 3, 4, 5, 6, 7
  `);

  const totals = emptyTotals();
  const byDay = new Map<string, UsageTotals>();
  const byFeature = new Map<AiUsageFeature, UsageTotals>();
  const byUser = new Map<string, UsageTotals & { email: string | null; name: string | null; role: string | null }>();

  for (const r of rows.rows) {
    // "none" = a no-op lookup that never reached an AI provider.
    if (r.provider === "none") continue;
    const calls = r.provider === "perplexity" ? Number(r.call_count) : Number(r.row_count);
    const tokens = Number(r.total_tokens);
    const cost =
      r.actual_cost ??
      (r.provider ? estimateCostUsd(r.provider, Number(r.prompt_tokens), Number(r.completion_tokens), calls) : null) ??
      0;

    addTo(totals, calls, tokens, cost);
    if (!byDay.has(r.day)) byDay.set(r.day, emptyTotals());
    addTo(byDay.get(r.day)!, calls, tokens, cost);
    if (!byFeature.has(r.feature)) byFeature.set(r.feature, emptyTotals());
    addTo(byFeature.get(r.feature)!, calls, tokens, cost);
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, { ...emptyTotals(), email: r.email, name: r.name, role: r.role });
    addTo(byUser.get(r.user_id)!, calls, tokens, cost);
  }

  // Every day in the window, including quiet ones, oldest first.
  const series: ({ day: string } & UsageTotals)[] = [];
  const todayMy = new Date(Date.now() + 8 * 60 * 60 * 1000);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayMy.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    series.push({ day: d, ...(byDay.get(d) ?? emptyTotals()) });
  }

  return {
    days,
    totals,
    today: series[series.length - 1],
    series,
    features: [...byFeature.entries()]
      .map(([feature, t]) => ({ feature, label: AI_FEATURE_LABEL[feature] ?? feature, ...t }))
      .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
    topUsers: [...byUser.entries()]
      .map(([userId, t]) => ({ userId, ...t }))
      .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
      .slice(0, 10),
  };
}

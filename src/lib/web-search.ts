import "server-only";
import { logAiUsage } from "./ai-usage";

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/search";
const TIMEOUT_MS = 20_000;
const MAX_RESULTS = 6;
const SNIPPET_MAX = 1200;

export type WebResult = { title: string; url: string; snippet: string };

/** A live web search for the assistant. Each call is logged, as Perplexity bills per search. */
export async function searchWeb(userId: string, query: string): Promise<{ ok: true; results: WebResult[] } | { ok: false; error: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { ok: false, error: "Web search isn't set up." };
  const startedAt = Date.now();
  try {
    const res = await fetch(PERPLEXITY_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: MAX_RESULTS, search_context_size: "high", country: "MY" }),
    });
    if (!res.ok) return { ok: false, error: "The web search failed." };
    const data = (await res.json().catch(() => ({}))) as { results?: { title?: string; url?: string; snippet?: string }[] };
    await logAiUsage({
      userId,
      feature: "assistant_chat",
      provider: "perplexity",
      model: "search",
      usage: null,
      durationMs: Date.now() - startedAt,
      callCount: 1,
    });
    return {
      ok: true,
      results: (data.results ?? [])
        .filter((r) => r.url && /^https?:\/\//i.test(r.url))
        .map((r) => ({ title: r.title ?? r.url!, url: r.url!, snippet: (r.snippet ?? "").slice(0, SNIPPET_MAX) })),
    };
  } catch {
    return { ok: false, error: "The web search failed." };
  }
}

import "server-only";

// Shared by every route that races DeepSeek and MiMo for a single JSON-mode
// chat completion (skill suggestions on both sides, cover letters, and any
// future one) — each provider is genuinely called (not just whichever
// answers first), so the caller can log every attempt's real usage/cost
// afterward rather than only the winner's.
export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: ProviderUsage;
  error?: { message?: string };
};

export class ProviderRaceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ProviderRaceAttempt = { content: string; usage: ProviderUsage | null; provider: string; model: string };

async function callProvider(
  endpoint: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  temperature: number,
  maxTokens: number,
  providerLabel: string,
  taskLabel: string,
): Promise<{ ok: true; content: string; usage: ProviderUsage | null } | { ok: false; error: string; status: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      const data: ChatCompletionResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error(`${providerLabel} ${taskLabel} failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${upstream.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;
      return { ok: true, content, usage: data.usage ?? null };
    } catch (err) {
      lastError = err;
      console.error(`${providerLabel} ${taskLabel} failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }
  console.error(`${providerLabel} ${taskLabel} failed after all retries:`, lastError);
  return { ok: false, error: `Couldn't reach the ${taskLabel} service.`, status: 502 };
}

// Races MiMo and DeepSeek (whichever are configured) via Promise.any —
// either can be intermittently flaky, and these are quick generation calls
// with no search grounding, so there's little cost to running both and
// taking whichever answers first. `collectedAttempts` is mutated (not just
// returned) so the caller can log every attempt's real usage afterward, not
// just the winner's.
export async function raceChatProviders(params: {
  systemPrompt: string;
  userContent: string;
  deepseekKey: string | null;
  mimoKey: string | null;
  temperature: number;
  maxTokens: number;
  taskLabel: string;
  notConfiguredError: string;
  collectedAttempts: Promise<ProviderRaceAttempt>[];
}): Promise<({ ok: true } & ProviderRaceAttempt) | { ok: false; error: string; status: number }> {
  const {
    systemPrompt,
    userContent,
    deepseekKey,
    mimoKey,
    temperature,
    maxTokens,
    taskLabel,
    notConfiguredError,
    collectedAttempts,
  } = params;

  const attempts: Promise<ProviderRaceAttempt>[] = [];
  if (mimoKey) {
    attempts.push(
      callProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, systemPrompt, userContent, temperature, maxTokens, "MiMo", taskLabel).then(
        (r) => {
          if (!r.ok) throw new ProviderRaceError(r.error, r.status);
          return { ...r, provider: "mimo", model: "mimo-v2.5" };
        },
      ),
    );
  }
  if (deepseekKey) {
    attempts.push(
      callProvider(
        DEEPSEEK_ENDPOINT,
        "deepseek-chat",
        deepseekKey,
        systemPrompt,
        userContent,
        temperature,
        maxTokens,
        "DeepSeek",
        taskLabel,
      ).then((r) => {
        if (!r.ok) throw new ProviderRaceError(r.error, r.status);
        return { ...r, provider: "deepseek", model: "deepseek-chat" };
      }),
    );
  }
  if (attempts.length === 0) {
    return { ok: false, error: notConfiguredError, status: 500 };
  }
  collectedAttempts.push(...attempts);
  try {
    const result = await Promise.any(attempts);
    return { ok: true, ...result };
  } catch (err) {
    const first = err instanceof AggregateError ? (err.errors[0] as ProviderRaceError | undefined) : undefined;
    return {
      ok: false,
      error: first?.message ?? `Couldn't reach the ${taskLabel} service.`,
      status: first?.status ?? 502,
    };
  }
}

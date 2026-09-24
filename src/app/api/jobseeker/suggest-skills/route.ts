import { after, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { getSession } from "@/lib/session";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SUGGESTIONS = 25;

const SYSTEM_PROMPT = `You suggest relevant skills for a jobseeker's profile on a Malaysian job platform, based on the role they're targeting. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "professionalSkills": string[],
  "softSkills": string[]
}
"professionalSkills" are hard/technical skills, tools, and technologies specific to succeeding in that role (e.g. software, methodologies, technical competencies) — up to ${MAX_SUGGESTIONS} items. "softSkills" are general work-style/interpersonal skills relevant to that role — up to ${MAX_SUGGESTIONS} items. Each item should be short (1-4 words) and Title Case, with no duplicates within or across the two lists. If the target role is too vague, empty, or nonsensical to suggest anything meaningful for, return empty arrays for both rather than guessing generically.`;

type SuggestUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type SuggestResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: SuggestUsage;
  error?: { message?: string };
};

type Suggestions = { professionalSkills: string[]; softSkills: string[] };

function sanitizeSkillList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

function validateSuggestions(raw: unknown): Suggestions {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    professionalSkills: sanitizeSkillList(obj.professionalSkills),
    softSkills: sanitizeSkillList(obj.softSkills),
  };
}

async function callProvider(
  endpoint: string,
  model: string,
  apiKey: string,
  userContent: string,
  providerLabel: string,
): Promise<{ ok: true; content: string; usage: SuggestUsage | null } | { ok: false; error: string; status: number }> {
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
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });

      const data: SuggestResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error(`${providerLabel} skill suggestion failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${upstream.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;
      return { ok: true, content, usage: data.usage ?? null };
    } catch (err) {
      lastError = err;
      console.error(`${providerLabel} skill suggestion failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }
  console.error(`${providerLabel} skill suggestion failed after all retries:`, lastError);
  return { ok: false, error: "Couldn't reach the suggestion service.", status: 502 };
}

class SuggestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Races MiMo and DeepSeek (whichever are configured) the same way company
// lookup does — either can be intermittently flaky, and this is a quick
// generation call with no search grounding, so there's little cost to
// running both and taking whichever answers first.
async function raceProviders(
  userContent: string,
  deepseekKey: string | null,
  mimoKey: string | null,
  // Every attempt this call makes gets pushed here (mutated, not returned)
  // so the caller can log every provider's real usage afterward — both are
  // actually called every time (racing for speed), not just whichever wins.
  collectedAttempts: Promise<{ content: string; usage: SuggestUsage | null; provider: string; model: string }>[],
): Promise<
  | { ok: true; content: string; usage: SuggestUsage | null; provider: string; model: string }
  | { ok: false; error: string; status: number }
> {
  const attempts: Promise<{ content: string; usage: SuggestUsage | null; provider: string; model: string }>[] = [];
  if (mimoKey) {
    attempts.push(
      callProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, userContent, "MiMo").then((r) => {
        if (!r.ok) throw new SuggestError(r.error, r.status);
        return { ...r, provider: "mimo", model: "mimo-v2.5" };
      }),
    );
  }
  if (deepseekKey) {
    attempts.push(
      callProvider(DEEPSEEK_ENDPOINT, "deepseek-chat", deepseekKey, userContent, "DeepSeek").then((r) => {
        if (!r.ok) throw new SuggestError(r.error, r.status);
        return { ...r, provider: "deepseek", model: "deepseek-chat" };
      }),
    );
  }
  if (attempts.length === 0) {
    return { ok: false, error: "Skill suggestions are not configured.", status: 500 };
  }
  collectedAttempts.push(...attempts);
  try {
    const result = await Promise.any(attempts);
    return { ok: true, ...result };
  } catch (err) {
    const first = err instanceof AggregateError ? (err.errors[0] as SuggestError | undefined) : undefined;
    return {
      ok: false,
      error: first?.message ?? "Couldn't reach the suggestion service.",
      status: first?.status ?? 502,
    };
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) {
    return NextResponse.json({ error: "Skill suggestions are not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { targetRole } = (body ?? {}) as Record<string, unknown>;
  if (typeof targetRole !== "string" || !targetRole.trim()) {
    return NextResponse.json({ error: "Enter your target role first." }, { status: 400 });
  }

  const startedAt = Date.now();
  const attempts: Promise<{ content: string; usage: SuggestUsage | null; provider: string; model: string }>[] = [];
  const result = await raceProviders(`Target role: ${targetRole.trim()}`, deepseekKey, mimoKey, attempts);
  const durationMs = Date.now() - startedAt;
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    return NextResponse.json({ error: "Couldn't generate suggestions. Try again." }, { status: 502 });
  }

  // Both providers were actually called (racing for speed) — logging only
  // the winner would silently undercount the loser's real usage/cost, so
  // every attempt that completed gets its own row.
  after(async () => {
    const settled = await Promise.allSettled(attempts);
    await Promise.all(
      settled
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{ content: string; usage: SuggestUsage | null; provider: string; model: string }> =>
            r.status === "fulfilled",
        )
        .map((r) =>
          logAiUsage({
            userId: session.userId,
            feature: "skill_suggestion",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  return NextResponse.json({ suggestions: validateSuggestions(parsed), usage: result.usage, durationMs });
}

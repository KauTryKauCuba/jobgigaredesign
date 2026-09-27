import { after, NextResponse } from "next/server";
import { type ProviderRaceAttempt, raceChatProviders } from "@/lib/ai-provider-race";
import { logAiUsage } from "@/lib/ai-usage";
import { getSession } from "@/lib/session";

const MAX_SUGGESTIONS = 40;

const SYSTEM_PROMPT = `You suggest relevant skills for a jobseeker's profile on a Malaysian job platform, based on the role they're targeting. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "professionalSkills": string[],
  "softSkills": string[]
}
"professionalSkills" are hard/technical skills, tools, and technologies specific to succeeding in that role (e.g. software, methodologies, technical competencies) — up to ${MAX_SUGGESTIONS} items. "softSkills" are general work-style/interpersonal skills relevant to that role — up to ${MAX_SUGGESTIONS} items. Each item should be short (1-4 words) and Title Case, with no duplicates within or across the two lists. If the target role is too vague, empty, or nonsensical to suggest anything meaningful for, return empty arrays for both rather than guessing generically.`;

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
  const professionalSkills = sanitizeSkillList(obj.professionalSkills);
  const professionalSet = new Set(professionalSkills.map((s) => s.toLowerCase()));
  return {
    professionalSkills,
    // The prompt asks the model for no cross-list duplicates, but that's
    // not reliable — enforce it in code, same as the employer route already
    // does for niceToHaveSkills vs professionalSkills.
    softSkills: sanitizeSkillList(obj.softSkills).filter((s) => !professionalSet.has(s.toLowerCase())),
  };
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
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const result = await raceChatProviders({
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Target role: ${targetRole.trim()}`,
    deepseekKey,
    mimoKey,
    temperature: 0.3,
    maxTokens: 900,
    taskLabel: "skill suggestion",
    notConfiguredError: "Skill suggestions are not configured.",
    collectedAttempts: attempts,
  });
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
        .filter((r): r is PromiseFulfilledResult<ProviderRaceAttempt> => r.status === "fulfilled")
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

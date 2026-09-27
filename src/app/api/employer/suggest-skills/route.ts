import { after, NextResponse } from "next/server";
import { type ProviderRaceAttempt, raceChatProviders } from "@/lib/ai-provider-race";
import { logAiUsage } from "@/lib/ai-usage";
import { getSession } from "@/lib/session";

const MAX_SUGGESTIONS = 40;

// Mirrors /api/jobseeker/suggest-skills — same provider-racing shape, but
// prompted for an employer filling out a job posting rather than a
// jobseeker's own profile, and with a third "niceToHaveSkills" bucket to
// match the posting form's three skill fields (required/soft/nice-to-have).
const SYSTEM_PROMPT = `You suggest relevant skills for a job posting on a Malaysian job platform, based on the role's title. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "professionalSkills": string[],
  "softSkills": string[],
  "niceToHaveSkills": string[]
}
"professionalSkills" are hard/technical skills, tools, and technologies a candidate must have to do this job (e.g. software, methodologies, technical competencies) — up to ${MAX_SUGGESTIONS} items. "softSkills" are general work-style/interpersonal skills relevant to the role — up to ${MAX_SUGGESTIONS} items. "niceToHaveSkills" are bonus technical or tool skills that would help but aren't required — up to ${MAX_SUGGESTIONS} items, and must not repeat anything already in "professionalSkills". Each item should be short (1-4 words) and Title Case, with no duplicates within or across the three lists. If the job title is too vague, empty, or nonsensical to suggest anything meaningful for, return empty arrays for all three rather than guessing generically.`;

type Suggestions = { professionalSkills: string[]; softSkills: string[]; niceToHaveSkills: string[] };

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
  // The prompt asks the model for no cross-list duplicates, but that's not
  // reliable — enforce it in code. softSkills is cross-filtered against
  // professionalSkills; niceToHaveSkills against both, since it's meant to
  // be a distinct "bonus" bucket from either.
  const softSkills = sanitizeSkillList(obj.softSkills).filter((s) => !professionalSet.has(s.toLowerCase()));
  const softSet = new Set(softSkills.map((s) => s.toLowerCase()));
  return {
    professionalSkills,
    softSkills,
    niceToHaveSkills: sanitizeSkillList(obj.niceToHaveSkills).filter(
      (s) => !professionalSet.has(s.toLowerCase()) && !softSet.has(s.toLowerCase()),
    ),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
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

  const { jobTitle } = (body ?? {}) as Record<string, unknown>;
  if (typeof jobTitle !== "string" || !jobTitle.trim()) {
    return NextResponse.json({ error: "Enter a job title first." }, { status: 400 });
  }

  const startedAt = Date.now();
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const result = await raceChatProviders({
    systemPrompt: SYSTEM_PROMPT,
    userContent: `Job title: ${jobTitle.trim()}`,
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

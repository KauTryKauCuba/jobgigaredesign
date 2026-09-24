import { after, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { getSession } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
const QUALIFICATION_TIERS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"] as const;
const WORK_AUTHORIZATIONS = [
  "citizen",
  "permanent_resident",
  "work_pass_holder",
  "needs_sponsorship",
] as const;
const DRIVING_LICENSES = ["b2", "b", "d", "da", "e"] as const;
const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;

// No live search here — unlike the company lookup, there are no facts to
// verify about a job title, just typical/generated content for the role.
// One LLM call, no grounding step, so this is a much smaller version of the
// same "race two providers, validate the JSON strictly" pattern used by
// /api/employer/lookup-company.
const SYSTEM_PROMPT = `You write realistic, typical job posting parameters for a Malaysian hiring platform, given only a job title (and optionally the employer's industry/company size/location for context). You have no way to verify real-world facts — everything you produce is a generated, typical example for that role, not a verified fact, and the employer will review and edit before publishing. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "description": string,
  "responsibilities": string,
  "industry": ${INDUSTRIES.map((i) => `"${i}"`).join(" | ")} | null,
  "employmentType": ${EMPLOYMENT_TYPES.map((t) => `"${t}"`).join(" | ")},
  "workArrangement": ${WORK_ARRANGEMENTS.map((w) => `"${w}"`).join(" | ")},
  "salaryMin": number,
  "salaryMax": number,
  "skills": string[],
  "softSkills": string[],
  "niceToHaveSkills": string[],
  "minYearsExperience": number,
  "minQualificationTier": ${QUALIFICATION_TIERS.map((t) => `"${t}"`).join(" | ")} | null,
  "languages": { "language": string, "level": ${LANGUAGE_LEVELS.map((l) => `"${l}"`).join(" | ")} }[],
  "workAuthorizations": (${WORK_AUTHORIZATIONS.map((w) => `"${w}"`).join(" | ")})[],
  "drivingLicense": ${DRIVING_LICENSES.map((d) => `"${d}"`).join(" | ")} | null
}
"description" is 3-5 sentences covering what the role involves and what a typical day looks like — written as an actual job posting, not a list. "responsibilities" is the full job-ad body: a "Responsibilities" section (4-7 bullet points, each starting with "- ") followed by a blank line and a "Requirements:" section (3-6 bullet points), formatted as plain text with literal "\\n" newlines and "- " bullet prefixes, not markdown headers — this is the detailed part of the posting, distinct from and longer than "description" above. "industry" is your best classification of which of the three listed industries this role most belongs to, or null if it genuinely could belong to any of them. "employmentType" and "workArrangement" are your best default guess for how this role is normally hired in Malaysia. "salaryMin"/"salaryMax" is a realistic monthly salary range in Malaysian Ringgit (RM) for this role at a typical Malaysian company — a real, sensible range, not a placeholder like 0 or round numbers with no basis. "skills" is 4-8 concrete technical/professional skills or tools genuinely required for this specific role. "softSkills" is 2-4 genuine interpersonal/behavioral traits this specific role actually needs (e.g. "Communication", "Time management", "Attention to detail") — distinct from "skills" above, and specific to the role rather than generic filler that could apply to any job. "niceToHaveSkills" is 2-5 additional technical/professional skills or tools that would be a bonus for this role but aren't strictly required — distinct from "skills" (which are the hard requirements), genuinely optional extras a strong candidate might have (e.g. an adjacent tool, a nice-to-have certification, a related but non-essential technology), empty array only if the role genuinely has no sensible bonus skills. "minYearsExperience" is the typical minimum years of experience for this role at a normal (not senior) level — 0 for genuinely entry-level roles. "minQualificationTier" is the typical minimum education level actually required for this role — null only if the role genuinely has no typical education requirement (e.g. many blue-collar/retail/driving roles), not as a lazy default. "languages" should almost always include at least English at "conversational" or higher for any Malaysian workplace role, plus Malay if the role is customer-facing or locally-oriented — empty array only if truly no language requirement makes sense. "workAuthorizations" should list every work-authorization category you'd realistically accept for this role — for a typical local hire this is usually ["citizen", "permanent_resident"], only add "work_pass_holder"/"needs_sponsorship" if the role plausibly justifies sponsoring foreign talent (e.g. a specialized tech role), never for roles regulated to citizens only. "drivingLicense" is null unless the role genuinely requires driving (e.g. delivery, sales rep, driver) — never default to requiring one for a desk-based role.`;

type SuggestionResult = {
  description: string | null;
  responsibilities: string | null;
  industry: (typeof INDUSTRIES)[number] | null;
  employmentType: (typeof EMPLOYMENT_TYPES)[number] | null;
  workArrangement: (typeof WORK_ARRANGEMENTS)[number] | null;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  softSkills: string[];
  niceToHaveSkills: string[];
  minYearsExperience: number | null;
  minQualificationTier: (typeof QUALIFICATION_TIERS)[number] | null;
  languages: { language: string; level: (typeof LANGUAGE_LEVELS)[number] }[];
  workAuthorizations: (typeof WORK_AUTHORIZATIONS)[number][];
  drivingLicense: (typeof DRIVING_LICENSES)[number] | null;
};

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function validateSuggestion(raw: unknown): SuggestionResult {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const salaryMinRaw = nonNegativeInt(obj.salaryMin);
  const salaryMaxRaw = nonNegativeInt(obj.salaryMax);
  // A model that returns min > max is more likely to have swapped them than
  // to mean a genuinely empty range — recover rather than discard both.
  const [salaryMin, salaryMax] =
    salaryMinRaw !== null && salaryMaxRaw !== null && salaryMinRaw > salaryMaxRaw
      ? [salaryMaxRaw, salaryMinRaw]
      : [salaryMinRaw, salaryMaxRaw];

  const languages = Array.isArray(obj.languages)
    ? obj.languages
        .map((entry) => {
          const e = (entry ?? {}) as Record<string, unknown>;
          if (typeof e.language !== "string" || !e.language.trim()) return null;
          if (!isOneOf(e.level, LANGUAGE_LEVELS)) return null;
          return { language: e.language.trim(), level: e.level };
        })
        .filter((entry): entry is { language: string; level: (typeof LANGUAGE_LEVELS)[number] } => entry !== null)
    : [];

  const workAuthorizations = Array.isArray(obj.workAuthorizations)
    ? obj.workAuthorizations.filter((v): v is (typeof WORK_AUTHORIZATIONS)[number] =>
        isOneOf(v, WORK_AUTHORIZATIONS),
      )
    : [];

  return {
    description: typeof obj.description === "string" && obj.description.trim() ? obj.description.trim() : null,
    responsibilities:
      typeof obj.responsibilities === "string" && obj.responsibilities.trim() ? obj.responsibilities.trim() : null,
    industry: isOneOf(obj.industry, INDUSTRIES) ? obj.industry : null,
    employmentType: isOneOf(obj.employmentType, EMPLOYMENT_TYPES) ? obj.employmentType : null,
    workArrangement: isOneOf(obj.workArrangement, WORK_ARRANGEMENTS) ? obj.workArrangement : null,
    salaryMin,
    salaryMax,
    skills: Array.isArray(obj.skills)
      ? obj.skills.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [],
    softSkills: Array.isArray(obj.softSkills)
      ? obj.softSkills.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [],
    niceToHaveSkills: Array.isArray(obj.niceToHaveSkills)
      ? obj.niceToHaveSkills
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
      : [],
    minYearsExperience: nonNegativeInt(obj.minYearsExperience),
    minQualificationTier: isOneOf(obj.minQualificationTier, QUALIFICATION_TIERS) ? obj.minQualificationTier : null,
    languages,
    workAuthorizations,
    drivingLicense: isOneOf(obj.drivingLicense, DRIVING_LICENSES) ? obj.drivingLicense : null,
  };
}

type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
type ProviderResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: ProviderUsage;
  error?: { message?: string };
};

class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function callProvider(
  endpoint: string,
  model: string,
  apiKey: string,
  userContent: string,
  providerLabel: string,
): Promise<{ content: string; usage: ProviderUsage | null }> {
  let failedStatus: number | null = null;
  let failedMessage: string | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 700,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });

      const data: ProviderResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        failedStatus = upstream.status;
        failedMessage = data.error?.message ?? "Suggestion failed.";
        console.error(`${providerLabel} suggestion failed (attempt ${attempt}/${RETRY_ATTEMPTS}): ${upstream.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new ProviderError("Suggestion failed.", 502);
      return { content, usage: data.usage ?? null };
    } catch (err) {
      console.error(`${providerLabel} suggestion failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, err);
    }
  }

  throw new ProviderError(failedMessage ?? "Couldn't reach the suggestion service. Try again.", failedStatus ?? 502);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) {
    return NextResponse.json({ error: "Job posting suggestions aren't configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { jobTitle, companyIndustry, companySize, companyLocation } = (body ?? {}) as Record<string, unknown>;
  if (typeof jobTitle !== "string" || !jobTitle.trim()) {
    return NextResponse.json({ error: "Enter a job title first." }, { status: 400 });
  }

  const contextLines = [
    typeof companyIndustry === "string" && companyIndustry.trim() ? `Employer industry: ${companyIndustry.trim()}` : null,
    typeof companySize === "string" && companySize.trim() ? `Employer size: ${companySize.trim()}` : null,
    typeof companyLocation === "string" && companyLocation.trim() ? `Employer location: ${companyLocation.trim()}` : null,
  ].filter((line): line is string => line !== null);

  const userContent = `Job title: ${jobTitle.trim()}${contextLines.length ? `\n${contextLines.join("\n")}` : ""}`;

  const startedAt = Date.now();
  const attempts: Promise<{ content: string; usage: ProviderUsage | null; provider: string; model: string }>[] = [];
  if (deepseekKey) {
    attempts.push(
      callProvider(DEEPSEEK_ENDPOINT, "deepseek-chat", deepseekKey, userContent, "DeepSeek").then((r) => ({
        ...r,
        provider: "deepseek",
        model: "deepseek-chat",
      })),
    );
  }
  if (mimoKey) {
    attempts.push(
      callProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, userContent, "MiMo").then((r) => ({
        ...r,
        provider: "mimo",
        model: "mimo-v2.5",
      })),
    );
  }

  let won: { content: string; usage: ProviderUsage | null; provider: string; model: string };
  try {
    won = await Promise.any(attempts);
  } catch (err) {
    const first = err instanceof AggregateError ? (err.errors[0] as ProviderError | undefined) : undefined;
    return NextResponse.json(
      { error: first?.message ?? "Couldn't reach the suggestion service. Try again." },
      { status: first?.status ?? 502 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(won.content);
  } catch {
    return NextResponse.json({ error: "Couldn't understand the suggestion. Try again." }, { status: 502 });
  }

  const result = validateSuggestion(parsed);
  const durationMs = Date.now() - startedAt;

  // Both providers were actually called (racing for speed) — logging only
  // the winner would silently undercount the loser's real usage/cost, so
  // every attempt that completed gets its own row, not just `won`. Fired
  // after the response is sent so the slower provider's log doesn't add to
  // the employer's wait.
  after(async () => {
    const settled = await Promise.allSettled(attempts);
    await Promise.all(
      settled
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<{ content: string; usage: ProviderUsage | null; provider: string; model: string }> =>
            r.status === "fulfilled",
        )
        .map((r) =>
          logAiUsage({
            userId: session.userId,
            feature: "job_posting_suggestion",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  return NextResponse.json({ result, usage: won.usage, provider: won.provider, durationMs });
}

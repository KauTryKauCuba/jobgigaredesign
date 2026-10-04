import "server-only";
import { after } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { type ProviderRaceAttempt, raceChatProviders } from "./ai-provider-race";
import { logAiUsage } from "./ai-usage";
import { db } from "./db";
import { aiUsageLogs } from "./db/schema";
import type { getJobseekerProfile } from "./jobseeker-profile";
import { htmlToLines } from "./poster-content";
import { plainTextToHtml } from "./richText";
import { sanitizeDescriptionHtml } from "./sanitizeHtml";
import {
  COVER_LETTER_LANGUAGES,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_TONES,
  type CoverLetterOptions,
} from "./cover-letter-options";

type Profile = NonNullable<Awaited<ReturnType<typeof getJobseekerProfile>>>;

export const MAX_JOB_POSTING_TEXT_LENGTH = 6_000;

// Each generation calls both providers (raced), so one generation logs one
// or two usage rows — 40 rows/day is roughly 20–40 letters, plenty for a
// real job hunt while capping runaway AI spend from a single account.
const DAILY_USAGE_ROW_LIMIT = 40;

const TONE_INSTRUCTION: Record<CoverLetterOptions["tone"], string> = {
  professional: "a polished, professional tone",
  friendly: "a warm, friendly and approachable tone, still appropriate for a job application",
  confident: "a confident, assertive tone that leads with achievements",
};
const LENGTH_INSTRUCTION: Record<CoverLetterOptions["length"], string> = {
  short: "2-3 short paragraphs (under 200 words)",
  standard: "3-5 paragraphs",
};
const LANGUAGE_INSTRUCTION: Record<CoverLetterOptions["language"], string> = {
  en: "Write it in English.",
  ms: "Write it entirely in formal Bahasa Malaysia (Bahasa Melayu), as used in Malaysian job applications.",
};

function systemPrompt(options: CoverLetterOptions) {
  return `You write cover letters for jobseekers on a Malaysian job platform. You are given the jobseeker's profile and a job title, job posting description, and company name they supply. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "coverLetter": string
}
"coverLetter" is a complete, ready-to-send cover letter addressed to the hiring team at the given company, written in the first person as the jobseeker, tailored to the job posting using only the skills/experience actually present in their profile — never invent experience, employers, or qualifications not present in the profile. Use ${TONE_INSTRUCTION[options.tone]}, ${LENGTH_INSTRUCTION[options.length]}. ${LANGUAGE_INSTRUCTION[options.language]} No placeholder brackets like "[Company Name]" — use the actual company name given. Do not include a subject line, letterhead, or the jobseeker's contact details block; start directly with the salutation.`;
}

// Only non-empty parts, so a missing field never reaches the AI as "null".
function joinParts(parts: (string | number | null | undefined)[], separator: string) {
  return parts.filter((p) => p !== null && p !== undefined && String(p).trim() !== "").join(separator);
}

function buildUserContent(profile: Profile, companyName: string, jobTitle: string, jobPostingText: string) {
  const experience = profile.workExperiences
    .map((e) => {
      const header = `- ${e.title} at ${e.company}${e.isCurrent ? " (current)" : ""}`;
      const achievements = e.achievements ? htmlToLines(e.achievements, 4) : [];
      return achievements.length > 0 ? `${header}\n${achievements.map((a) => `  • ${a}`).join("\n")}` : header;
    })
    .join("\n");
  const education = profile.education
    .map((e) => `- ${joinParts([e.fieldOfStudy, e.institution], " at ")}${e.graduationYear ? ` (${e.graduationYear})` : ""}`)
    .join("\n");
  const certifications = profile.certifications
    .map((c) => `- ${joinParts([c.name, c.issuer, c.year], ", ")}`)
    .join("\n");
  const languages = profile.languages
    .map((l) => `${l.language} (spoken: ${l.spokenLevel}, written: ${l.writtenLevel})`)
    .join(", ");
  const bio = profile.bio ? htmlToLines(profile.bio, 8).join(" ") : "";

  return `Jobseeker profile:
Name: ${profile.fullName}
Target role: ${profile.targetRole}
Years of experience: ${profile.yearsExperience ?? "Not specified"}
Bio: ${bio || "Not provided"}
Professional skills: ${profile.professionalSkills.join(", ") || "Not provided"}
Soft skills: ${profile.softSkills.join(", ") || "Not provided"}
Other skills: ${profile.otherSkills.join(", ") || "Not provided"}
Languages: ${languages || "Not provided"}
Work experience:
${experience || "None listed"}
Education:
${education || "None listed"}
Certifications:
${certifications || "None listed"}

Target job:
Company: ${companyName}
Job title: ${jobTitle}
Job posting:
${jobPostingText}`;
}

/** Validates loose request input into options, falling back to defaults. */
export function parseCoverLetterOptions(value: unknown): CoverLetterOptions {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    tone: (COVER_LETTER_TONES as readonly string[]).includes(v.tone as string)
      ? (v.tone as CoverLetterOptions["tone"])
      : "professional",
    length: (COVER_LETTER_LENGTHS as readonly string[]).includes(v.length as string)
      ? (v.length as CoverLetterOptions["length"])
      : "standard",
    language: (COVER_LETTER_LANGUAGES as readonly string[]).includes(v.language as string)
      ? (v.language as CoverLetterOptions["language"])
      : "en",
  };
}

/** True once this user has hit today's generation cap. */
async function overDailyLimit(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.userId, userId),
        eq(aiUsageLogs.feature, "cover_letter"),
        gt(aiUsageLogs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    );
  return n >= DAILY_USAGE_ROW_LIMIT;
}

/**
 * Writes one cover letter with the AI and returns it as sanitized HTML (ready
 * for the rich-text editor). Shared by "Generate" and "Regenerate". Logs
 * every provider attempt's usage after the response is sent.
 */
export async function generateCoverLetterContent(params: {
  userId: string;
  profile: Profile;
  companyName: string;
  jobTitle: string;
  jobPostingText: string;
  options: CoverLetterOptions;
}): Promise<{ ok: true; content: string } | { ok: false; error: string; status: number }> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) {
    return { ok: false, error: "Cover letter generation is not configured.", status: 500 };
  }
  if (await overDailyLimit(params.userId)) {
    return {
      ok: false,
      error: "You've reached today's cover letter limit. Try again tomorrow — your saved letters are still here.",
      status: 429,
    };
  }

  const startedAt = Date.now();
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const result = await raceChatProviders({
    systemPrompt: systemPrompt(params.options),
    userContent: buildUserContent(params.profile, params.companyName, params.jobTitle, params.jobPostingText),
    deepseekKey,
    mimoKey,
    temperature: 0.5,
    maxTokens: 1200,
    taskLabel: "cover letter generation",
    notConfiguredError: "Cover letter generation is not configured.",
    collectedAttempts: attempts,
  });

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
            userId: params.userId,
            feature: "cover_letter",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  if (!result.ok) return { ok: false, error: result.error, status: result.status };

  try {
    const parsed = JSON.parse(result.content) as { coverLetter?: unknown };
    if (typeof parsed.coverLetter !== "string" || !parsed.coverLetter.trim()) throw new Error("empty");
    // The LLM returns plain text (real "\n" line breaks) — converted to safe
    // HTML once here so it can be edited with RichTextEditor like every
    // other long-form field in the app.
    return { ok: true, content: sanitizeDescriptionHtml(plainTextToHtml(parsed.coverLetter.trim())) };
  } catch {
    return { ok: false, error: "Couldn't generate a cover letter. Try again.", status: 502 };
  }
}

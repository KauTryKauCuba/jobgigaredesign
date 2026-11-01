import "server-only";
import { after } from "next/server";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { type ProviderRaceAttempt, raceChatProviders } from "./ai-provider-race";
import { logAiUsage } from "./ai-usage";
import { db } from "./db";
import { jobPostings, jobseekerProfiles, resumeReviews } from "./db/schema";
import { scoreJobseekerForPosting } from "./jobseeker-match";
import { countPdfPages, extractResumeText } from "./resume-parser";
import {
  REVIEW_SCORE_KEYS,
  RESUME_REVIEW_DAILY_LIMIT,
  type ResumeReviewResult,
  type ReviewCheck,
  type ReviewImprovement,
} from "./resume-review-shared";
import { canonicalizeSkill } from "./skills-taxonomy";
import { readUploadBuffer } from "./uploads";

// Resume Review: friendly AI feedback on a jobseeker's uploaded resume, plus
// checks the AI isn't needed for (page count, contact details, privacy) and
// JobGiga-specific ones (skills suitable live jobs ask for, profile vs
// resume). Same DeepSeek/MiMo race and usage logging as cover letters.

const DAY_MS = 24 * 60 * 60 * 1000;
// Plenty for a resume; keeps a pasted-in thesis from blowing up the prompt.
const MAX_RESUME_CHARS = 14000;
// Less readable text than this and it's almost certainly a scanned image.
const MIN_READABLE_CHARS = 250;
// How many of the best-matching live jobs feed "skills employers are asking for".
const SKILL_GAP_JOBS = 10;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const profileColumns = {
  id: jobseekerProfiles.id,
  resumeUrl: jobseekerProfiles.resumeUrl,
  resumeFileName: jobseekerProfiles.resumeFileName,
  targetRole: jobseekerProfiles.targetRole,
  yearsExperience: jobseekerProfiles.yearsExperience,
  professionalSkills: jobseekerProfiles.professionalSkills,
  softSkills: jobseekerProfiles.softSkills,
  otherSkills: jobseekerProfiles.otherSkills,
  preferredIndustry: jobseekerProfiles.preferredIndustry,
  workArrangement: jobseekerProfiles.workArrangement,
  employmentType: jobseekerProfiles.employmentType,
  workAuthorization: jobseekerProfiles.workAuthorization,
  drivingLicense: jobseekerProfiles.drivingLicense,
};
type ReviewProfile = Awaited<ReturnType<typeof loadProfile>>;

async function loadProfile(profileId: string) {
  const [profile] = await db.select(profileColumns).from(jobseekerProfiles).where(eq(jobseekerProfiles.id, profileId)).limit(1);
  return profile ?? null;
}

/** The stored resume's bytes — a "/uploads/…" file, or an older inline data URL. */
export async function loadResumeFile(resumeUrl: string | null): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!resumeUrl) return null;
  if (resumeUrl.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(resumeUrl);
    return match ? { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] } : null;
  }
  const buffer = await readUploadBuffer(resumeUrl);
  if (!buffer) return null;
  return { buffer, mimeType: resumeUrl.toLowerCase().endsWith(".pdf") ? "application/pdf" : DOCX_MIME };
}

/** Which kind of file it is, for reading text and for the viewer. */
export function resumeKind(resumeUrl: string | null, fileName: string | null): "pdf" | "docx" | null {
  const hint = `${fileName ?? ""} ${resumeUrl?.slice(0, 120) ?? ""}`.toLowerCase();
  if (hint.includes(".pdf") || hint.includes("application/pdf")) return "pdf";
  if (hint.includes(".docx") || hint.includes("wordprocessingml")) return "docx";
  return null;
}

export async function reviewsUsedToday(profileId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(resumeReviews)
    .where(and(eq(resumeReviews.jobseekerProfileId, profileId), gt(resumeReviews.createdAt, new Date(Date.now() - DAY_MS))));
  return n;
}

export async function getLatestResumeReview(profileId: string) {
  const [row] = await db
    .select({ resumeUrl: resumeReviews.resumeUrl, result: resumeReviews.result, createdAt: resumeReviews.createdAt })
    .from(resumeReviews)
    .where(eq(resumeReviews.jobseekerProfileId, profileId))
    .orderBy(desc(resumeReviews.createdAt))
    .limit(1);
  return row ?? null;
}

// ---- Checks the AI isn't needed for ---------------------------------------

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?6?0[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{3,4})|(\+?\d[\d\s-]{8,}\d)/;
// Malaysian IC number: YYMMDD-PB-####.
const IC_RE = /\b\d{6}[\s-]?\d{2}[\s-]?\d{4}\b/;

function quickChecks(text: string, pages: number | null): ReviewCheck[] {
  const words = text.split(/\s+/).filter(Boolean).length;
  const checks: ReviewCheck[] = [];
  if (pages !== null) {
    checks.push(
      pages <= 2
        ? { key: "length", label: "Length", ok: true, detail: `${pages} page${pages === 1 ? "" : "s"} — a comfortable length to read.` }
        : { key: "length", label: "Length", ok: false, detail: `${pages} pages — most recruiters skim, so aim for 1–2 pages.` },
    );
  } else if (words > 1100) {
    checks.push({ key: "length", label: "Length", ok: false, detail: `About ${words} words — aim for 1–2 pages so recruiters can skim it.` });
  }
  checks.push(
    EMAIL_RE.test(text)
      ? { key: "email", label: "Email address", ok: true, detail: "Easy for employers to reach you." }
      : { key: "email", label: "Email address", ok: false, detail: "We couldn't find one — add it near the top." },
    PHONE_RE.test(text)
      ? { key: "phone", label: "Phone number", ok: true, detail: "Included — good." }
      : { key: "phone", label: "Phone number", ok: false, detail: "We couldn't find one — add a number employers can call." },
    IC_RE.test(text)
      ? {
          key: "privacy",
          label: "Personal details",
          ok: false,
          detail: "It looks like your IC number is on your resume. Leave it off to keep it safe — employers only need it once you're hired.",
        }
      : { key: "privacy", label: "Personal details", ok: true, detail: "No IC number spotted — nicely kept private." },
  );
  return checks;
}

// ---- "Skills employers on JobGiga are asking for" ---------------------------

const normalizeText = (value: string) => ` ${value.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim()} `;

async function skillGaps(profile: NonNullable<ReviewProfile>, resumeText: string) {
  const postings = await db
    .select({
      skills: jobPostings.skills,
      softSkills: jobPostings.softSkills,
      niceToHaveSkills: jobPostings.niceToHaveSkills,
      minYearsExperience: jobPostings.minYearsExperience,
      industry: jobPostings.industry,
      workArrangement: jobPostings.workArrangement,
      employmentType: jobPostings.employmentType,
      workAuthorizations: jobPostings.workAuthorizations,
      drivingLicense: jobPostings.drivingLicense,
    })
    .from(jobPostings)
    .where(eq(jobPostings.status, "active"));

  // The live jobs that suit them best, by the same score job pages show.
  const suitable = postings
    .map((p) => ({ p, match: scoreJobseekerForPosting(p, profile) }))
    .filter(({ match }) => match.eligible && match.score >= 40)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, SKILL_GAP_JOBS);

  const text = normalizeText(resumeText);
  const profileSkills = new Set(
    [...profile.professionalSkills, ...profile.softSkills, ...profile.otherSkills].map(canonicalizeSkill),
  );
  const onResume = (skill: string) => text.includes(normalizeText(skill));
  const counts = new Map<string, { skill: string; jobs: number }>();
  for (const { p } of suitable) {
    for (const skill of new Set(p.skills)) {
      const key = canonicalizeSkill(skill);
      if (onResume(skill)) continue;
      const entry = counts.get(key) ?? { skill, jobs: 0 };
      entry.jobs += 1;
      counts.set(key, entry);
    }
  }
  return {
    jobsLookedAt: suitable.length,
    // Most-asked first; ones already on their profile (just not the resume) first among equals.
    skills: [...counts.entries()]
      .sort(([ka, a], [kb, b]) => b.jobs - a.jobs || Number(profileSkills.has(kb)) - Number(profileSkills.has(ka)))
      .slice(0, 8)
      .map(([, v]) => v),
  };
}

// ---- The AI review ---------------------------------------------------------

const SYSTEM_PROMPT = `You are a warm, practical career coach reviewing a jobseeker's resume for JobGiga, a Malaysian job platform. Be encouraging and specific — talk to them as "you", in plain friendly language, never harsh or robotic. Write in the same language as the resume (English, or Bahasa Malaysia if the resume is in BM).

Respond with ONLY a json object, exactly this shape:
{
  "summary": "2 short sentences: an honest, encouraging overall impression",
  "scores": {
    "clarity": {"score": 0-100, "note": "one short sentence"},
    "impact": {"score": 0-100, "note": "one short sentence"},
    "skills": {"score": 0-100, "note": "one short sentence"},
    "ats": {"score": 0-100, "note": "one short sentence"},
    "completeness": {"score": 0-100, "note": "one short sentence"}
  },
  "strengths": [{"title": "short", "detail": "one sentence"}],
  "improvements": [{"priority": "high|medium|low", "section": "e.g. Work experience", "quote": "exact text copied from the resume, or null", "issue": "what to improve and why, one or two sentences", "suggestion": "a concrete fix — ideally a rewritten line they can use"}],
  "estimatedYearsExperience": number or null
}

Scores: clarity = structure, order and readability; impact = achievements and results rather than duties; skills = relevant skills and keywords recruiters search for; ats = how easily hiring software can read it (plain headings, no text in images or complex columns, standard section names); completeness = contact details, dates, education and the essentials. Use the full range honestly — a typical decent resume lands around 60-75.

Rules:
- 2 to 3 strengths, 3 to 6 improvements, most important first.
- "quote" must be copied EXACTLY from the resume text (under 160 characters), or null when the point is about something missing.
- Never invent facts, numbers, employers or achievements. In rewrites, use placeholders like [number], [%] or [result] for anything you don't know.
- Don't comment on age, gender, race, religion or marital status — except to suggest leaving such personal details off.
- Keep every string short and easy to read on a phone.`;

const clampScore = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const normalizeForQuote = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Turns the AI's JSON into a safe review — dropping any "quote" that isn't really in their resume. */
function parseAiReview(content: string, resumeText: string) {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const rawScores = (raw.scores ?? {}) as Record<string, { score?: unknown; note?: unknown }>;
  const scores = REVIEW_SCORE_KEYS.map((key) => ({
    key,
    score: clampScore(rawScores[key]?.score),
    note: str(rawScores[key]?.note, 200),
  }));
  const haystack = normalizeForQuote(resumeText);
  const improvements: ReviewImprovement[] = (Array.isArray(raw.improvements) ? raw.improvements : [])
    .map((i: Record<string, unknown>) => {
      const quote = str(i.quote, 200);
      return {
        priority: (["high", "medium", "low"].includes(i.priority as string) ? i.priority : "medium") as ReviewImprovement["priority"],
        section: str(i.section, 60) || "General",
        quote: quote || null,
        issue: str(i.issue, 400),
        suggestion: str(i.suggestion, 500),
      };
    })
    // A point about a specific line has to be about a line that's really there.
    .filter((i) => i.issue && i.suggestion && (!i.quote || haystack.includes(normalizeForQuote(i.quote))))
    .slice(0, 6);
  const strengths = (Array.isArray(raw.strengths) ? raw.strengths : [])
    .map((s: Record<string, unknown>) => ({ title: str(s.title, 80), detail: str(s.detail, 300) }))
    .filter((s) => s.title)
    .slice(0, 3);
  const years = Number(raw.estimatedYearsExperience);
  return {
    summary: str(raw.summary, 400),
    scores,
    strengths,
    improvements,
    estimatedYears: Number.isFinite(years) && years >= 0 && years < 60 ? Math.round(years) : null,
  };
}

function profileNotes(profile: NonNullable<ReviewProfile>, resumeText: string, estimatedYears: number | null): string[] {
  const notes: string[] = [];
  if (estimatedYears !== null && Math.abs(estimatedYears - profile.yearsExperience) >= 2) {
    notes.push(
      `Your profile says ${profile.yearsExperience} year${profile.yearsExperience === 1 ? "" : "s"} of experience, but your resume reads more like about ${estimatedYears}. Making them match helps employers trust both.`,
    );
  }
  const text = normalizeText(resumeText);
  const missing = profile.professionalSkills.filter((s) => !text.includes(normalizeText(s))).slice(0, 5);
  if (missing.length > 0) {
    notes.push(
      `Your profile lists ${missing.join(", ")}, but your resume doesn't mention ${missing.length === 1 ? "it" : "them"}. If ${missing.length === 1 ? "it's" : "they're"} true, add ${missing.length === 1 ? "it" : "them"} to your resume too.`,
    );
  }
  return notes;
}

export type ReviewOutcome = { ok: true; result: ResumeReviewResult } | { ok: false; error: string; status: number };

/** Runs one review of the jobseeker's current resume and saves it. */
export async function runResumeReview(params: { userId: string; profileId: string }): Promise<ReviewOutcome> {
  const profile = await loadProfile(params.profileId);
  if (!profile?.resumeUrl) {
    return { ok: false, error: "Upload your resume first, then we can review it.", status: 400 };
  }
  if ((await reviewsUsedToday(profile.id)) >= RESUME_REVIEW_DAILY_LIMIT) {
    return {
      ok: false,
      error: `You've used today's ${RESUME_REVIEW_DAILY_LIMIT} reviews. Come back tomorrow — your latest review is still here.`,
      status: 429,
    };
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) return { ok: false, error: "Resume Review isn't available right now.", status: 500 };

  const kind = resumeKind(profile.resumeUrl, profile.resumeFileName);
  const file = await loadResumeFile(profile.resumeUrl);
  if (!file || !kind) {
    return { ok: false, error: "We couldn't open your resume. Try uploading it again as a PDF.", status: 400 };
  }

  let text: string;
  let pages: number | null = null;
  try {
    text = (await extractResumeText(file.buffer, kind === "pdf" ? "resume.pdf" : "resume.docx")).trim();
    if (kind === "pdf") pages = await countPdfPages(file.buffer);
  } catch {
    return { ok: false, error: "We couldn't read your resume. Try uploading it again as a PDF.", status: 400 };
  }
  if (text.length < MIN_READABLE_CHARS) {
    return {
      ok: false,
      error:
        "We could hardly find any text in your resume — it may be a scanned image or photo. Hiring software can't read those either, so try exporting it as a PDF from Word or Google Docs, then upload it again.",
      status: 400,
    };
  }

  const startedAt = Date.now();
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const [ai, gaps] = await Promise.all([
    raceChatProviders({
      systemPrompt: SYSTEM_PROMPT,
      userContent: `The jobseeker is aiming for: ${profile.targetRole || "not stated"}.\n\nResume text:\n${text.slice(0, MAX_RESUME_CHARS)}`,
      deepseekKey,
      mimoKey,
      temperature: 0.3,
      maxTokens: 1800,
      taskLabel: "resume review",
      notConfiguredError: "Resume Review isn't available right now.",
      collectedAttempts: attempts,
    }),
    skillGaps(profile, text),
  ]);

  // Both providers were really called — log each one's real usage, not just the winner's.
  after(async () => {
    const settled = await Promise.allSettled(attempts);
    await Promise.all(
      settled
        .filter((r): r is PromiseFulfilledResult<ProviderRaceAttempt> => r.status === "fulfilled")
        .map((r) =>
          logAiUsage({
            userId: params.userId,
            feature: "resume_review",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  if (!ai.ok) return { ok: false, error: "Our reviewer is busy right now. Please try again in a minute.", status: 502 };

  let parsed: ReturnType<typeof parseAiReview>;
  try {
    parsed = parseAiReview(ai.content, text);
    if (!parsed.summary || parsed.improvements.length === 0) throw new Error("incomplete");
  } catch {
    return { ok: false, error: "Something went wrong while reviewing. Please try again.", status: 502 };
  }

  const result: ResumeReviewResult = {
    version: 1,
    overall: Math.round(parsed.scores.reduce((sum, s) => sum + s.score, 0) / parsed.scores.length),
    summary: parsed.summary,
    scores: parsed.scores,
    strengths: parsed.strengths,
    improvements: parsed.improvements,
    checks: quickChecks(text, pages),
    skillGaps: gaps,
    profileNotes: profileNotes(profile, text, parsed.estimatedYears),
  };
  await db.insert(resumeReviews).values({ jobseekerProfileId: profile.id, resumeUrl: profile.resumeUrl, result });
  return { ok: true, result };
}

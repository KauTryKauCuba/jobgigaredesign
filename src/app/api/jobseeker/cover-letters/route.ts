import { after, NextResponse } from "next/server";
import { type ProviderRaceAttempt, raceChatProviders } from "@/lib/ai-provider-race";
import { logAiUsage } from "@/lib/ai-usage";
import { createCoverLetter, getCoverLettersForProfile } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { plainTextToHtml } from "@/lib/richText";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";

const MAX_JOB_POSTING_TEXT_LENGTH = 6_000;

// Same provider-racing shape as /api/employer/suggest-skills and
// /api/jobseeker/parse-resume — DeepSeek and MiMo raced via Promise.any,
// whichever answers first wins.
const SYSTEM_PROMPT = `You write cover letters for jobseekers on a Malaysian job platform. You are given the jobseeker's profile and a job title, job posting description, and company name they supply. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "coverLetter": string
}
"coverLetter" is a complete, ready-to-send cover letter addressed to the hiring team at the given company, written in the first person as the jobseeker, tailored to the job posting using only the skills/experience actually present in their profile — never invent experience, employers, or qualifications not present in the profile. 3-5 paragraphs, professional tone, no placeholder brackets like "[Company Name]" — use the actual company name given. Do not include a subject line, letterhead, or the jobseeker's contact details block; start directly with the salutation.`;

function buildUserContent(
  profile: NonNullable<Awaited<ReturnType<typeof getJobseekerProfile>>>,
  companyName: string,
  jobTitle: string,
  jobPostingText: string,
) {
  const experience = profile.workExperiences
    .map((e) => `- ${e.title} at ${e.company}${e.isCurrent ? " (current)" : ""}`)
    .join("\n");
  const education = profile.education.map((e) => `- ${e.fieldOfStudy} at ${e.institution}`).join("\n");

  return `Jobseeker profile:
Name: ${profile.fullName}
Target role: ${profile.targetRole}
Years of experience: ${profile.yearsExperience ?? "Not specified"}
Bio: ${profile.bio ?? "Not provided"}
Professional skills: ${profile.professionalSkills.join(", ") || "Not provided"}
Soft skills: ${profile.softSkills.join(", ") || "Not provided"}
Work experience:
${experience || "None listed"}
Education:
${education || "None listed"}

Target job:
Company: ${companyName}
Job title: ${jobTitle}
Job posting:
${jobPostingText}`;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const profile = await getJobseekerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 404 });
  }

  const letters = await getCoverLettersForProfile(profile.id);
  return NextResponse.json({ coverLetters: letters });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) {
    return NextResponse.json({ error: "Cover letter generation is not configured." }, { status: 500 });
  }

  const profile = await getJobseekerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { companyName, jobTitle, jobPostingText } = (body ?? {}) as Record<string, unknown>;
  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "Enter the company name." }, { status: 400 });
  }
  if (typeof jobTitle !== "string" || !jobTitle.trim()) {
    return NextResponse.json({ error: "Enter the job title." }, { status: 400 });
  }
  if (typeof jobPostingText !== "string" || !jobPostingText.trim()) {
    return NextResponse.json({ error: "Paste the job posting description." }, { status: 400 });
  }
  const trimmedJobPostingText = jobPostingText.trim().slice(0, MAX_JOB_POSTING_TEXT_LENGTH);

  const startedAt = Date.now();
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const result = await raceChatProviders({
    systemPrompt: SYSTEM_PROMPT,
    userContent: buildUserContent(profile, companyName.trim(), jobTitle.trim(), trimmedJobPostingText),
    deepseekKey,
    mimoKey,
    temperature: 0.5,
    maxTokens: 1200,
    taskLabel: "cover letter generation",
    notConfiguredError: "Cover letter generation is not configured.",
    collectedAttempts: attempts,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let parsedContent: string;
  try {
    const parsed = JSON.parse(result.content) as { coverLetter?: unknown };
    if (typeof parsed.coverLetter !== "string" || !parsed.coverLetter.trim()) {
      throw new Error("empty");
    }
    // The LLM returns plain text (real "\n" line breaks) — converted to safe
    // HTML once here so the field can be edited with RichTextEditor like
    // every other long-form field in the app (bio, job descriptions, etc).
    parsedContent = sanitizeDescriptionHtml(plainTextToHtml(parsed.coverLetter.trim()));
  } catch {
    return NextResponse.json({ error: "Couldn't generate a cover letter. Try again." }, { status: 502 });
  }

  const row = await createCoverLetter({
    jobseekerProfileId: profile.id,
    companyName: companyName.trim(),
    jobTitle: jobTitle.trim(),
    jobPostingText: trimmedJobPostingText,
    content: parsedContent,
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
            userId: session.userId,
            feature: "cover_letter",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  return NextResponse.json({ coverLetter: row });
}

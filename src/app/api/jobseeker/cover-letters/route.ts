import { NextResponse } from "next/server";
import {
  MAX_JOB_POSTING_TEXT_LENGTH,
  generateCoverLetterContent,
  parseCoverLetterOptions,
} from "@/lib/cover-letter-ai";
import { createCoverLetter, getCoverLettersForProfile } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getSession } from "@/lib/session";

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

// Generate a new letter from the jobseeker's profile + a pasted job posting,
// in the chosen tone, length and language.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
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

  const { companyName, jobTitle, jobPostingText, options } = (body ?? {}) as Record<string, unknown>;
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

  const result = await generateCoverLetterContent({
    userId: session.userId,
    profile,
    companyName: companyName.trim(),
    jobTitle: jobTitle.trim(),
    jobPostingText: trimmedJobPostingText,
    options: parseCoverLetterOptions(options),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const row = await createCoverLetter({
    jobseekerProfileId: profile.id,
    companyName: companyName.trim(),
    jobTitle: jobTitle.trim(),
    jobPostingText: trimmedJobPostingText,
    content: result.content,
  });

  return NextResponse.json({ coverLetter: row });
}

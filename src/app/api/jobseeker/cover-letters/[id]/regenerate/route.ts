import { NextResponse } from "next/server";
import { generateCoverLetterContent, parseCoverLetterOptions } from "@/lib/cover-letter-ai";
import { getCoverLetterForProfile, updateCoverLetter } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getSession } from "@/lib/session";

// Rewrite an existing letter from its saved job posting, in a (possibly
// different) tone, length or language — replaces the letter's content.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const profile = await getJobseekerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — defaults apply.
  }

  const { id } = await params;
  const letter = await getCoverLetterForProfile(profile.id, id);
  if (!letter) return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });

  const result = await generateCoverLetterContent({
    userId: session.userId,
    profile,
    companyName: letter.companyName,
    jobTitle: letter.jobTitle,
    jobPostingText: letter.jobPostingText,
    options: parseCoverLetterOptions((body as Record<string, unknown>)?.options),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const row = await updateCoverLetter(profile.id, id, { content: result.content });
  return NextResponse.json({ coverLetter: row });
}

import { NextResponse } from "next/server";
import { isBlankHtml } from "@/lib/cover-letter-options";
import { deleteCoverLetter, updateCoverLetter } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";

// Save edits: any of `content`, `companyName`, `jobTitle`.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { content, companyName, jobTitle } = (body ?? {}) as Record<string, unknown>;
  const changes: { content?: string; companyName?: string; jobTitle?: string } = {};

  if (content !== undefined) {
    // An emptied rich-text editor still holds tags like "<p></p>", so check
    // for actual words, not just a non-empty string.
    if (typeof content !== "string" || isBlankHtml(content)) {
      return NextResponse.json({ error: "Cover letter can't be empty." }, { status: 400 });
    }
    changes.content = sanitizeDescriptionHtml(content.trim());
  }
  if (companyName !== undefined) {
    if (typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json({ error: "Enter the company name." }, { status: 400 });
    }
    changes.companyName = companyName.trim();
  }
  if (jobTitle !== undefined) {
    if (typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json({ error: "Enter the job title." }, { status: 400 });
    }
    changes.jobTitle = jobTitle.trim();
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { id } = await params;
  const row = await updateCoverLetter(profile.id, id, changes);
  if (!row) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  return NextResponse.json({ coverLetter: row });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const profile = await getJobseekerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 404 });
  }

  const { id } = await params;
  const row = await deleteCoverLetter(profile.id, id);
  if (!row) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

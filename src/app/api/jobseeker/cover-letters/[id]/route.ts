import { NextResponse } from "next/server";
import { deleteCoverLetter, updateCoverLetterContent } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";

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

  const { content } = (body ?? {}) as Record<string, unknown>;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Cover letter can't be empty." }, { status: 400 });
  }

  const { id } = await params;
  const row = await updateCoverLetterContent(profile.id, id, sanitizeDescriptionHtml(content.trim()));
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

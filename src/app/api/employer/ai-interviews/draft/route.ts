import { after, NextResponse } from "next/server";
import { draftInterviewQuestions, logDraftUsage } from "@/lib/ai-interview-ai";
import { loadEmployerApplication } from "@/lib/ai-interview-access";
import { getSession } from "@/lib/session";

// Drafts the five questions (and what a good answer covers) for the employer
// to review. Nothing is saved or sent here.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const found = await loadEmployerApplication(session.userId, (body as Record<string, unknown> | null)?.applicationId);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!found.canManage) {
    return NextResponse.json({ error: "You can't send an AI interview for this candidate." }, { status: 403 });
  }
  if (found.application.status !== "shortlisted") {
    return NextResponse.json({ error: "An AI interview can be sent to shortlisted applicants." }, { status: 409 });
  }

  const result = await draftInterviewQuestions({
    title: found.application.postingTitle,
    description: found.application.postingDescription,
    responsibilities: found.application.postingResponsibilities,
    skills: found.application.postingSkills,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Every provider that was called gets its own usage row, not just the winner.
  after(() => logDraftUsage(session.userId, result.attempts, result.startedAt));
  return NextResponse.json({ questions: result.questions });
}

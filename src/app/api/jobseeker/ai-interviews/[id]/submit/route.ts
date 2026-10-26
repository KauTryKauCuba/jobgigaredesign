import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewQuestions, aiInterviews } from "@/lib/db/schema";
import { loadJobseekerInterview } from "@/lib/ai-interview-access";
import { getJobseekerAiInterview, processInterview } from "@/lib/ai-interview";
import { getSession } from "@/lib/session";

// Finishes the interview: every question must be answered. The answers are
// then transcribed and scored in the background.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker." }, { status: 401 });
  }
  const { id } = await params;
  const ctx = await loadJobseekerInterview(session.userId, id);
  if (!ctx) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { interview } = ctx;
  if (interview.status === "expired") {
    return NextResponse.json({ error: "The deadline has passed. Ask the employer for more time." }, { status: 409 });
  }
  if (interview.status !== "in_progress") {
    return NextResponse.json({ error: "This AI interview isn't open." }, { status: 409 });
  }

  const questions = await db
    .select({ answeredAt: aiInterviewQuestions.answeredAt })
    .from(aiInterviewQuestions)
    .where(eq(aiInterviewQuestions.aiInterviewId, id));
  if (questions.some((q) => q.answeredAt === null)) {
    return NextResponse.json({ error: "Answer every question before you finish." }, { status: 400 });
  }

  const now = new Date();
  const [moved] = await db
    .update(aiInterviews)
    .set({ status: "processing", submittedAt: now, updatedAt: now })
    .where(and(eq(aiInterviews.id, id), eq(aiInterviews.status, "in_progress")))
    .returning({ id: aiInterviews.id });
  if (moved) after(() => processInterview(id));

  return NextResponse.json({ interview: await getJobseekerAiInterview(id, ctx.jobseekerProfileId) });
}

import { after, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewQuestions, aiInterviews, jobseekerProfiles, users } from "@/lib/db/schema";
import { loadEmployerApplication } from "@/lib/ai-interview-access";
import { deleteAiInterviewMedia } from "@/lib/ai-interview-media";
import {
  AI_INTERVIEW_ANSWER_SECONDS,
  AI_INTERVIEW_DEADLINE_DAYS,
  AI_INTERVIEW_MAX_KEY_POINTS,
  AI_INTERVIEW_MAX_KEY_POINT_LENGTH,
  AI_INTERVIEW_MAX_QUESTION_LENGTH,
  AI_INTERVIEW_QUESTION_COUNT,
  type AiInterviewDraftQuestion,
} from "@/lib/ai-interview-shared";
import { getEmployerAiInterview, getInterviewRowByApplication, isStuckProcessing, processInterview } from "@/lib/ai-interview";
import { sendAiInterviewInviteEmail } from "@/lib/email";
import { getApplicationNotificationContext, notify } from "@/lib/notifications";
import { getSession } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseQuestions(value: unknown): AiInterviewDraftQuestion[] | null {
  if (!Array.isArray(value) || value.length !== AI_INTERVIEW_QUESTION_COUNT) return null;
  const out: AiInterviewDraftQuestion[] = [];
  for (const item of value) {
    const q = item as { question?: unknown; keyPoints?: unknown };
    if (typeof q?.question !== "string") return null;
    const question = q.question.replace(/\s+/g, " ").trim();
    if (!question || question.length > AI_INTERVIEW_MAX_QUESTION_LENGTH) return null;
    if (!Array.isArray(q.keyPoints)) return null;
    const keyPoints = q.keyPoints
      .map((p) => (typeof p === "string" ? p.replace(/\s+/g, " ").trim() : ""))
      .filter((p) => p.length > 0);
    if (keyPoints.length === 0 || keyPoints.length > AI_INTERVIEW_MAX_KEY_POINTS) return null;
    if (keyPoints.some((p) => p.length > AI_INTERVIEW_MAX_KEY_POINT_LENGTH)) return null;
    out.push({ question, keyPoints });
  }
  return out;
}

// The AI interview for one application (null if none was sent).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const found = await loadEmployerApplication(session.userId, new URL(request.url).searchParams.get("applicationId"));
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const interview = await getEmployerAiInterview(found.application.id);
  // A run the server lost (restarted mid-analysis) is picked up again.
  if (interview && found.canManage) {
    const row = await getInterviewRowByApplication(found.application.id);
    if (row && isStuckProcessing({ id: row.id, status: row.status, updatedAtMs: row.updatedAt.getTime() })) {
      after(() => processInterview(row.id));
    }
  }
  return NextResponse.json({ interview, canManage: found.canManage, applicationStatus: found.application.status });
}

// Sends the AI interview: saves the approved questions and tells the applicant.
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
  const { applicationId, questions: rawQuestions, answerSeconds, deadlineDays } = (body ?? {}) as Record<string, unknown>;

  const found = await loadEmployerApplication(session.userId, applicationId);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!found.canManage) {
    return NextResponse.json({ error: "You can't send an AI interview for this candidate." }, { status: 403 });
  }
  if (found.application.status !== "shortlisted") {
    return NextResponse.json({ error: "An AI interview can be sent to shortlisted applicants." }, { status: 409 });
  }
  const questions = parseQuestions(rawQuestions);
  if (!questions) {
    return NextResponse.json(
      { error: `Send exactly ${AI_INTERVIEW_QUESTION_COUNT} questions, each with at least one key point.` },
      { status: 400 },
    );
  }
  if (!(AI_INTERVIEW_ANSWER_SECONDS as readonly unknown[]).includes(answerSeconds)) {
    return NextResponse.json({ error: "Invalid answer length." }, { status: 400 });
  }
  if (!(AI_INTERVIEW_DEADLINE_DAYS as readonly unknown[]).includes(deadlineDays)) {
    return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
  }

  // One per application. A cancelled, expired or failed one is replaced;
  // anything still open or finished is not.
  const existing = await getInterviewRowByApplication(found.application.id);
  if (existing) {
    if (existing.status === "cancelled" || existing.status === "expired" || existing.status === "failed") {
      await deleteAiInterviewMedia(existing.id);
      await db.delete(aiInterviews).where(eq(aiInterviews.id, existing.id));
    } else {
      return NextResponse.json({ error: "This applicant already has an AI interview." }, { status: 409 });
    }
  }

  const deadlineAt = new Date(Date.now() + (deadlineDays as number) * DAY_MS);
  let interviewId: string;
  try {
    interviewId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(aiInterviews)
        .values({
          jobApplicationId: found.application.id,
          createdByUserId: session.userId,
          answerSeconds: answerSeconds as number,
          deadlineAt,
        })
        .returning({ id: aiInterviews.id });
      await tx.insert(aiInterviewQuestions).values(
        questions.map((q, i) => ({
          aiInterviewId: created.id,
          position: i + 1,
          question: q.question,
          keyPoints: q.keyPoints,
        })),
      );
      return created.id;
    });
  } catch {
    // The unique(application) constraint: two clicks, or two teammates, at once.
    return NextResponse.json({ error: "This applicant already has an AI interview." }, { status: 409 });
  }

  // Tell the applicant — in the app and by email. Neither may fail the send.
  const ctx = await getApplicationNotificationContext(found.application.id);
  if (ctx) {
    await notify([ctx.jobseekerUserId], "jobseeker", {
      type: "ai_interview_invite",
      title: `${ctx.companyName} sent you an AI interview`,
      body: `Answer 5 short questions for ${ctx.postingTitle} before ${deadlineAt.toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" })}.`,
      link: `/jobseeker/ai-interview/${interviewId}`,
    });
    const [account] = await db
      .select({ email: users.email, name: jobseekerProfiles.fullName })
      .from(jobseekerProfiles)
      .innerJoin(users, eq(jobseekerProfiles.userId, users.id))
      .where(eq(jobseekerProfiles.userId, ctx.jobseekerUserId))
      .limit(1);
    if (account?.email) {
      after(async () => {
        try {
          await sendAiInterviewInviteEmail({
            email: account.email,
            applicantName: account.name,
            companyName: ctx.companyName,
            jobTitle: ctx.postingTitle,
            deadline: deadlineAt,
            interviewId,
            answerSeconds: answerSeconds as number,
          });
        } catch (err) {
          console.error("Failed to send AI interview invite email:", err);
        }
      });
    }
  }

  return NextResponse.json({ interview: await getEmployerAiInterview(found.application.id) });
}

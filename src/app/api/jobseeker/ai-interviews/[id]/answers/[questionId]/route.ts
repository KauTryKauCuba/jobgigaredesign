import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewQuestions, aiInterviews } from "@/lib/db/schema";
import { loadJobseekerInterview } from "@/lib/ai-interview-access";
import { deleteAiInterviewFile, saveAnswerMedia } from "@/lib/ai-interview-media";
import { AI_INTERVIEW_MAX_ATTEMPTS, AI_INTERVIEW_MAX_UPLOAD_BYTES } from "@/lib/ai-interview-shared";
import { getJobseekerAiInterview } from "@/lib/ai-interview";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

// Saves one recorded answer (multipart: "media" = the recording, "video" = "1"
// when it is a video). Recording again replaces the previous take, up to the
// limit.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker." }, { status: 401 });
  }
  const { id, questionId } = await params;
  const ctx = await loadJobseekerInterview(session.userId, id);
  if (!ctx || !isUuid(questionId)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { interview } = ctx;
  if (interview.status === "expired") {
    return NextResponse.json({ error: "The deadline has passed. Ask the employer for more time." }, { status: 409 });
  }
  if (interview.status !== "in_progress" || !interview.consentAt) {
    return NextResponse.json({ error: "Start the interview first." }, { status: 409 });
  }

  const [question] = await db
    .select({
      id: aiInterviewQuestions.id,
      attempts: aiInterviewQuestions.attempts,
      mediaFileName: aiInterviewQuestions.mediaFileName,
    })
    .from(aiInterviewQuestions)
    .where(and(eq(aiInterviewQuestions.id, questionId), eq(aiInterviewQuestions.aiInterviewId, id)))
    .limit(1);
  if (!question) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (question.attempts >= AI_INTERVIEW_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "You've used all your takes for this question." }, { status: 409 });
  }

  let file: File | null = null;
  let wantsVideo = false;
  try {
    const form = await request.formData();
    const value = form.get("media");
    file = value instanceof File ? value : null;
    wantsVideo = form.get("video") === "1";
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "No recording received." }, { status: 400 });
  if (file.size > AI_INTERVIEW_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That recording is too large. Try again." }, { status: 413 });
  }

  const saved = await saveAnswerMedia({
    interviewId: id,
    buffer: Buffer.from(await file.arrayBuffer()),
    wantsVideo,
    maxSeconds: interview.answerSeconds,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });

  // Re-checked under a lock after the (slow) transcode: the interview must
  // still be open, and the take count only goes up while below the limit — so
  // a submit or cancel in the meantime, or two quick uploads, can't slip past.
  // The earlier take's file is read under the same lock, so each upload
  // replaces exactly the one before it.
  const outcome = await db.transaction(async (tx) => {
    const [live] = await tx.select({ status: aiInterviews.status }).from(aiInterviews).where(eq(aiInterviews.id, id)).for("share");
    if (live?.status !== "in_progress") return { error: "This interview has already been submitted or closed." } as const;
    const [current] = await tx
      .select({ attempts: aiInterviewQuestions.attempts, mediaFileName: aiInterviewQuestions.mediaFileName })
      .from(aiInterviewQuestions)
      .where(eq(aiInterviewQuestions.id, questionId))
      .for("update");
    if (!current || current.attempts >= AI_INTERVIEW_MAX_ATTEMPTS) return { error: "You've used all your takes for this question." } as const;
    await tx
      .update(aiInterviewQuestions)
      .set({
        mediaFileName: saved.media.fileName,
        mediaKind: saved.media.kind,
        durationSeconds: saved.media.durationSeconds,
        attempts: current.attempts + 1,
        answeredAt: new Date(),
        transcript: null,
        score: null,
        evaluation: null,
      })
      .where(eq(aiInterviewQuestions.id, questionId));
    return { previous: current.mediaFileName } as const;
  });
  if ("error" in outcome) {
    await deleteAiInterviewFile(id, saved.media.fileName);
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  // The earlier take is replaced.
  await deleteAiInterviewFile(id, outcome.previous);

  return NextResponse.json({ interview: await getJobseekerAiInterview(id, ctx.jobseekerProfileId) });
}

import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import {
  aiInterviewQuestions,
  aiInterviews,
  employerProfiles,
  jobApplications,
  jobPostings,
} from "./db/schema";
import { hasSpeech, scoreInterview, transcribeAnswer } from "./ai-interview-ai";
import { readdir } from "fs/promises";
import { AI_INTERVIEW_DIR, deleteAiInterviewMedia, extractWavForSpeechToText } from "./ai-interview-media";
import { isUuid } from "./uuid";
import {
  AI_INTERVIEW_MAX_ATTEMPTS,
  AI_INTERVIEW_RETENTION_DAYS,
  type AiInterviewStatus,
  type EmployerAiInterview,
  type JobseekerAiInterview,
} from "./ai-interview-shared";
import { getApplicationNotificationContext, getJobNotificationRecipients, notify } from "./notifications";

type InterviewRow = typeof aiInterviews.$inferSelect;
type QuestionRow = typeof aiInterviewQuestions.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
const TRANSCRIPTION_ROUNDS = 3;
const TRANSCRIPTION_ROUND_PAUSE_MS = 8000;

/** Turns an overdue invite into "expired" (checked whenever it is read — no background job). */
async function applyExpiry(interview: InterviewRow): Promise<InterviewRow> {
  if (
    (interview.status === "invited" || interview.status === "in_progress") &&
    interview.deadlineAt.getTime() < Date.now()
  ) {
    const [updated] = await db
      .update(aiInterviews)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(eq(aiInterviews.id, interview.id), inArray(aiInterviews.status, ["invited", "in_progress"])),
      )
      .returning();
    return updated ?? { ...interview, status: "expired" };
  }
  return interview;
}

let lastPurge = 0;
/**
 * Deletes recordings past their retention period (transcripts, scores and
 * the report stay). Runs opportunistically, at most every 10 minutes per
 * server process, whenever interviews are read.
 */
export async function purgeExpiredRecordings() {
  if (Date.now() - lastPurge < 10 * 60 * 1000) return;
  lastPurge = Date.now();
  try {
    const due = await db
      .select({ id: aiInterviews.id })
      .from(aiInterviews)
      .where(and(isNotNull(aiInterviews.recordingsExpireAt), lt(aiInterviews.recordingsExpireAt, new Date()), isNull(aiInterviews.recordingsDeletedAt)));
    for (const { id } of due) {
      await deleteAiInterviewMedia(id);
      await db
        .update(aiInterviewQuestions)
        .set({ mediaFileName: null })
        .where(eq(aiInterviewQuestions.aiInterviewId, id));
      await db.update(aiInterviews).set({ recordingsDeletedAt: new Date() }).where(eq(aiInterviews.id, id));
    }
    await purgeOrphanedRecordings();
  } catch (err) {
    console.error("Failed to purge AI interview recordings", err);
  }
}

/**
 * Deletes recording folders whose interview no longer exists. An interview
 * row goes with its application, job or account (database cascades), but
 * its files don't — this catches every one of those, however it was deleted.
 */
async function purgeOrphanedRecordings() {
  const folders = (await readdir(AI_INTERVIEW_DIR).catch(() => [] as string[])).filter(isUuid);
  if (folders.length === 0) return;
  const existing = new Set(
    (await db.select({ id: aiInterviews.id }).from(aiInterviews).where(inArray(aiInterviews.id, folders))).map((r) => r.id),
  );
  for (const id of folders) {
    if (!existing.has(id)) await deleteAiInterviewMedia(id);
  }
}

/**
 * The recordings on these job postings, to delete once the postings are gone
 * (rows cascade, files don't). Same two steps as jobAdFileCleanupForPostings:
 * call before the delete, run what it returns after it succeeded.
 */
export async function aiInterviewMediaCleanupForPostings(jobPostingIds: string[]): Promise<() => Promise<void>> {
  if (jobPostingIds.length === 0) return async () => {};
  const interviews = await db
    .select({ id: aiInterviews.id })
    .from(aiInterviews)
    .innerJoin(jobApplications, eq(jobApplications.id, aiInterviews.jobApplicationId))
    .where(inArray(jobApplications.jobPostingId, jobPostingIds));
  return async () => {
    await Promise.all(interviews.map((interview) => deleteAiInterviewMedia(interview.id)));
  };
}

function toEmployerShape(interview: InterviewRow, questions: QuestionRow[]): EmployerAiInterview {
  const recordingsDeleted = interview.recordingsDeletedAt !== null;
  return {
    id: interview.id,
    applicationId: interview.jobApplicationId,
    status: interview.status,
    answerSeconds: interview.answerSeconds,
    deadlineAt: interview.deadlineAt.toISOString(),
    inviteSentAt: interview.inviteSentAt.toISOString(),
    submittedAt: interview.submittedAt?.toISOString() ?? null,
    completedAt: interview.completedAt?.toISOString() ?? null,
    recordingsExpireAt: interview.recordingsExpireAt?.toISOString() ?? null,
    recordingsDeleted,
    failureReason: interview.failureReason,
    report: interview.report ?? null,
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      question: q.question,
      keyPoints: q.keyPoints,
      answered: q.answeredAt !== null,
      mediaKind: q.mediaKind === "video" || q.mediaKind === "audio" ? q.mediaKind : null,
      durationSeconds: q.durationSeconds,
      hasRecording: !!q.mediaFileName && !recordingsDeleted,
      transcript: q.transcript,
      score: q.score,
      evaluation: q.evaluation ?? null,
    })),
  };
}

async function loadQuestions(interviewId: string): Promise<QuestionRow[]> {
  return db
    .select()
    .from(aiInterviewQuestions)
    .where(eq(aiInterviewQuestions.aiInterviewId, interviewId))
    .orderBy(asc(aiInterviewQuestions.position));
}

/** The AI interview for one application, as the employer sees it (or null). Access is checked by the caller. */
export async function getEmployerAiInterview(applicationId: string): Promise<EmployerAiInterview | null> {
  void purgeExpiredRecordings();
  const [row] = await db.select().from(aiInterviews).where(eq(aiInterviews.jobApplicationId, applicationId)).limit(1);
  if (!row) return null;
  const interview = await applyExpiry(row);
  return toEmployerShape(interview, await loadQuestions(interview.id));
}

/** The raw row plus its application/posting, for the owning-company check in routes. */
export async function getAiInterviewContext(interviewId: string) {
  const [row] = await db
    .select({
      interview: aiInterviews,
      applicationId: jobApplications.id,
      jobPostingId: jobApplications.jobPostingId,
      interviewDetails: jobApplications.interviewDetails,
      applicationStatus: jobApplications.status,
      employerProfileId: jobPostings.employerProfileId,
      jobseekerProfileId: jobApplications.jobseekerProfileId,
    })
    .from(aiInterviews)
    .innerJoin(jobApplications, eq(aiInterviews.jobApplicationId, jobApplications.id))
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(eq(aiInterviews.id, interviewId))
    .limit(1);
  if (!row) return null;
  return { ...row, interview: await applyExpiry(row.interview) };
}

/** The AI interview as its applicant sees it. Null unless it belongs to this jobseeker. */
export async function getJobseekerAiInterview(
  interviewId: string,
  jobseekerProfileId: string,
): Promise<JobseekerAiInterview | null> {
  const ctx = await getAiInterviewContext(interviewId);
  if (!ctx || ctx.jobseekerProfileId !== jobseekerProfileId) return null;
  const [posting] = await db
    .select({ title: jobPostings.title, companyName: employerProfiles.companyName })
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobPostings.id, ctx.jobPostingId))
    .limit(1);
  const questions = await loadQuestions(ctx.interview.id);
  return {
    id: ctx.interview.id,
    status: ctx.interview.status,
    answerSeconds: ctx.interview.answerSeconds,
    deadlineAt: ctx.interview.deadlineAt.toISOString(),
    consented: ctx.interview.consentAt !== null,
    jobTitle: posting?.title ?? "this role",
    companyName: posting?.companyName ?? "the company",
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      question: q.question,
      answered: q.answeredAt !== null,
      attemptsLeft: Math.max(0, AI_INTERVIEW_MAX_ATTEMPTS - q.attempts),
    })),
  };
}

export type JobseekerAiInterviewSummary = { id: string; status: AiInterviewStatus; deadlineAt: string };

/** One short line per application, for the jobseeker's Applications page. */
export async function getJobseekerAiInterviewSummaries(
  applicationIds: string[],
): Promise<Map<string, JobseekerAiInterviewSummary>> {
  const out = new Map<string, JobseekerAiInterviewSummary>();
  if (applicationIds.length === 0) return out;
  const rows = await db.select().from(aiInterviews).where(inArray(aiInterviews.jobApplicationId, applicationIds));
  for (const row of rows) {
    const interview = await applyExpiry(row);
    out.set(interview.jobApplicationId, {
      id: interview.id,
      status: interview.status,
      deadlineAt: interview.deadlineAt.toISOString(),
    });
  }
  return out;
}

// ───────────────────────── Processing ─────────────────────────

const running = new Set<string>();

export function isProcessing(interviewId: string) {
  return running.has(interviewId);
}

async function failInterview(interviewId: string, reason: string) {
  await db
    .update(aiInterviews)
    .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
    .where(and(eq(aiInterviews.id, interviewId), eq(aiInterviews.status, "processing")));
}

/**
 * Transcribes every answer that has no transcript yet, scores all five in
 * one call, saves the report and tells the employer. Safe to run again
 * (a retry, or a stuck run): finished transcripts are kept, and only one
 * run per interview happens at a time in this process.
 */
export async function processInterview(interviewId: string) {
  if (running.has(interviewId)) return;
  running.add(interviewId);
  try {
    const [row] = await db
      .select({
        interview: aiInterviews,
        applicationId: jobApplications.id,
        title: jobPostings.title,
        description: jobPostings.description,
        skills: jobPostings.skills,
      })
      .from(aiInterviews)
      .innerJoin(jobApplications, eq(aiInterviews.jobApplicationId, jobApplications.id))
      .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
      .where(eq(aiInterviews.id, interviewId))
      .limit(1);
    if (!row || row.interview.status !== "processing") return;
    const userId = row.interview.createdByUserId;

    // Answers missing a transcript are transcribed together. The connection to
    // the speech service drops now and then, so a few rounds are tried (only
    // the answers still missing) before the employer is shown a failure.
    let failed: { position: number; error: string } | null = null;
    for (let round = 0; round < TRANSCRIPTION_ROUNDS; round++) {
      if (round > 0) await new Promise((resolve) => setTimeout(resolve, TRANSCRIPTION_ROUND_PAUSE_MS));
      const pending = (await loadQuestions(interviewId)).filter((q) => q.mediaFileName && q.transcript === null);
      if (pending.length === 0) {
        failed = null;
        break;
      }
      const results = await Promise.all(
        pending.map(async (q) => {
          const wav = await extractWavForSpeechToText(interviewId, q.mediaFileName as string);
          if (!wav) return { q, error: "Couldn't read the recording." };
          const result = await transcribeAnswer(wav, { userId });
          if (!result.ok) return { q, error: result.error };
          // Silence or noise comes back as a stray syllable — stored as no speech.
          await db
            .update(aiInterviewQuestions)
            .set({ transcript: hasSpeech(result.transcript) ? result.transcript : "" })
            .where(eq(aiInterviewQuestions.id, q.id));
          return { q, error: null };
        }),
      );
      const firstFailure = results.find((r) => r.error);
      failed = firstFailure ? { position: firstFailure.q.position, error: firstFailure.error as string } : null;
      if (!failed) break;
    }
    if (failed) {
      await failInterview(interviewId, `Couldn't transcribe the answer to question ${failed.position}: ${failed.error}`);
      return;
    }

    const ready = await loadQuestions(interviewId);
    const scored = await scoreInterview(
      {
        job: { title: row.title, description: row.description, skills: row.skills },
        answers: ready.map((q) => ({
          position: q.position,
          question: q.question,
          keyPoints: q.keyPoints,
          transcript: q.transcript ?? "",
        })),
      },
      userId,
    );
    if (!scored.ok) {
      await failInterview(interviewId, scored.error);
      return;
    }

    for (const q of ready) {
      const evaluation = scored.evaluations.get(q.position);
      if (!evaluation) continue;
      await db
        .update(aiInterviewQuestions)
        .set({ score: evaluation.score, evaluation })
        .where(eq(aiInterviewQuestions.id, q.id));
    }
    const now = new Date();
    const [done] = await db
      .update(aiInterviews)
      .set({
        status: "completed",
        report: scored.report,
        failureReason: null,
        completedAt: now,
        recordingsExpireAt: new Date(now.getTime() + AI_INTERVIEW_RETENTION_DAYS * DAY_MS),
        updatedAt: now,
      })
      .where(and(eq(aiInterviews.id, interviewId), eq(aiInterviews.status, "processing")))
      .returning({ id: aiInterviews.id });
    if (!done) return;

    const ctx = await getApplicationNotificationContext(row.applicationId);
    if (ctx) {
      await notify(await getJobNotificationRecipients(ctx.employerProfileId, ctx.ownerUserId, ctx.postingId), "employer", {
        type: "ai_interview_ready",
        title: `AI interview report ready: ${ctx.applicantName}`,
        body: `${ctx.applicantName} finished the AI interview for ${ctx.postingTitle}. See how well they know the job.`,
        link: `/employer/applicants?applicantId=${row.applicationId}`,
      });
    }
  } catch (err) {
    console.error("AI interview processing failed", err);
    await failInterview(interviewId, "Something went wrong while analysing the answers.").catch(() => {});
  } finally {
    running.delete(interviewId);
  }
}

/**
 * An interview stuck in "processing" with nothing running (the server was
 * restarted mid-run) is picked up again whenever the employer looks at it.
 */
export function isStuckProcessing(interview: { status: AiInterviewStatus; updatedAtMs: number; id: string }) {
  return interview.status === "processing" && !running.has(interview.id) && Date.now() - interview.updatedAtMs > 3 * 60 * 1000;
}

// Used by routes that need "is there already an open one for this application".
export async function getInterviewRowByApplication(applicationId: string): Promise<InterviewRow | null> {
  const [row] = await db.select().from(aiInterviews).where(eq(aiInterviews.jobApplicationId, applicationId)).limit(1);
  return row ? applyExpiry(row) : null;
}

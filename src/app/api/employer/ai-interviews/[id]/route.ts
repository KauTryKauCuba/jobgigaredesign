import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewQuestions, aiInterviews, jobseekerProfiles, users } from "@/lib/db/schema";
import { loadEmployerApplication } from "@/lib/ai-interview-access";
import { deleteAiInterviewMedia } from "@/lib/ai-interview-media";
import { AI_INTERVIEW_DEADLINE_DAYS } from "@/lib/ai-interview-shared";
import { getAiInterviewContext, getEmployerAiInterview, processInterview } from "@/lib/ai-interview";
import { sendAiInterviewInviteEmail } from "@/lib/email";
import { getApplicationNotificationContext, notify } from "@/lib/notifications";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

const DAY_MS = 24 * 60 * 60 * 1000;

// Cancel an open AI interview, give an open or expired one a new deadline,
// or run the analysis again after it failed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { action, deadlineDays } = (body ?? {}) as Record<string, unknown>;

  const ctx = await getAiInterviewContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const found = await loadEmployerApplication(session.userId, ctx.applicationId);
  if (!found || found.access.profile.id !== ctx.employerProfileId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!found.canManage) {
    return NextResponse.json({ error: "You can't change this AI interview." }, { status: 403 });
  }
  const { interview } = ctx;

  if (action === "cancel") {
    if (interview.status !== "invited" && interview.status !== "in_progress") {
      return NextResponse.json({ error: "Only an open AI interview can be cancelled." }, { status: 409 });
    }
    const cancelled = await db
      .update(aiInterviews)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(aiInterviews.id, id), eq(aiInterviews.status, interview.status)))
      .returning({ id: aiInterviews.id });
    // The applicant finished (or it changed some other way) in the meantime —
    // leave their recordings alone.
    if (cancelled.length === 0) {
      return NextResponse.json({ error: "This AI interview just changed — refresh to see where it stands." }, { status: 409 });
    }
    // Whatever they had recorded is no longer needed.
    await deleteAiInterviewMedia(id);
    await db
      .update(aiInterviewQuestions)
      .set({ mediaFileName: null })
      .where(eq(aiInterviewQuestions.aiInterviewId, id));
    const notification = await getApplicationNotificationContext(ctx.applicationId);
    if (notification) {
      await notify([notification.jobseekerUserId], "jobseeker", {
        type: "ai_interview_cancelled",
        title: `${notification.companyName} cancelled your AI interview`,
        body: `You no longer need to answer the AI interview for ${notification.postingTitle}.`,
        link: "/jobseeker/applications",
      });
    }
  } else if (action === "extend") {
    if (interview.status !== "invited" && interview.status !== "in_progress" && interview.status !== "expired") {
      return NextResponse.json({ error: "This AI interview can't be extended." }, { status: 409 });
    }
    if (!(AI_INTERVIEW_DEADLINE_DAYS as readonly unknown[]).includes(deadlineDays)) {
      return NextResponse.json({ error: "Invalid deadline." }, { status: 400 });
    }
    const deadlineAt = new Date(Date.now() + (deadlineDays as number) * DAY_MS);
    await db
      .update(aiInterviews)
      .set({
        deadlineAt,
        // An expired one picks up where it stopped.
        status: interview.consentAt ? "in_progress" : "invited",
        updatedAt: new Date(),
      })
      .where(eq(aiInterviews.id, id));
    const notification = await getApplicationNotificationContext(ctx.applicationId);
    if (notification) {
      await notify([notification.jobseekerUserId], "jobseeker", {
        type: "ai_interview_invite",
        title: `New deadline for your ${notification.companyName} AI interview`,
        body: `You can now answer the AI interview for ${notification.postingTitle} until ${deadlineAt.toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" })}.`,
        link: `/jobseeker/ai-interview/${id}`,
      });
      const [account] = await db
        .select({ email: users.email, name: jobseekerProfiles.fullName })
        .from(jobseekerProfiles)
        .innerJoin(users, eq(jobseekerProfiles.userId, users.id))
        .where(eq(jobseekerProfiles.userId, notification.jobseekerUserId))
        .limit(1);
      if (account?.email) {
        after(async () => {
          try {
            await sendAiInterviewInviteEmail({
              email: account.email,
              applicantName: account.name,
              companyName: notification.companyName,
              jobTitle: notification.postingTitle,
              deadline: deadlineAt,
              interviewId: id,
              answerSeconds: interview.answerSeconds,
              extended: true,
            });
          } catch (err) {
            console.error("Failed to send AI interview extension email:", err);
          }
        });
      }
    }
  } else if (action === "retry") {
    if (interview.status !== "failed") {
      return NextResponse.json({ error: "Only a failed analysis can be run again." }, { status: 409 });
    }
    await db
      .update(aiInterviews)
      .set({ status: "processing", failureReason: null, updatedAt: new Date() })
      .where(and(eq(aiInterviews.id, id), eq(aiInterviews.status, "failed")));
    after(() => processInterview(id));
  } else {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  return NextResponse.json({ interview: await getEmployerAiInterview(ctx.applicationId) });
}

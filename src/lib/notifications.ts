import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, jobApplications, jobPostings, jobseekerProfiles, notifications } from "./db/schema";
import { getEmployerTeamMembers } from "./employer-profile";

type Audience = "employer" | "jobseeker";

type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/**
 * Sends one in-app notification to each user (duplicates and the person who
 * caused it are skipped — nobody needs to be told about their own action).
 * Never throws: a notification failing must not fail the action itself.
 */
export async function notify(
  userIds: (string | null | undefined)[],
  audience: Audience,
  input: NotificationInput,
  opts: { exceptUserId?: string | null } = {},
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== opts.exceptUserId))];
  if (recipients.length === 0) return;
  try {
    await db.insert(notifications).values(
      recipients.map((userId) => ({
        userId,
        audience,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      })),
    );
  } catch (err) {
    console.error("Failed to create notifications", err);
  }
}

/** Everything a notification about one application needs to name names. */
export async function getApplicationNotificationContext(jobApplicationId: string) {
  const [row] = await db
    .select({
      jobseekerUserId: jobseekerProfiles.userId,
      applicantName: jobseekerProfiles.fullName,
      postingId: jobPostings.id,
      postingTitle: jobPostings.title,
      employerProfileId: employerProfiles.id,
      ownerUserId: employerProfiles.userId,
      companyName: employerProfiles.companyName,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(and(eq(jobApplications.id, jobApplicationId)))
    .limit(1);
  return row ?? null;
}

/** Every active teammate (incl. the owner) at a company, as user ids. */
export async function getEmployerTeamUserIds(employerProfileId: string, ownerUserId: string): Promise<string[]> {
  const members = await getEmployerTeamMembers(employerProfileId, ownerUserId);
  return members.filter((m) => m.status === "active" && m.userId).map((m) => m.userId as string);
}

// What a jobseeker is told when their application moves — only the moves
// worth interrupting someone for (internal steps like "evaluation" aren't).
const JOBSEEKER_STATUS_MESSAGES: Record<string, (ctx: { postingTitle: string; companyName: string }) => NotificationInput> = {
  shortlisted: (c) => ({
    type: "application_shortlisted",
    title: `You've been shortlisted for ${c.postingTitle}`,
    body: `${c.companyName} is interested in your application.`,
  }),
  interview: (c) => ({
    type: "interview_scheduled",
    title: `Interview invite: ${c.postingTitle}`,
    body: `${c.companyName} scheduled an interview — accept, decline or ask to reschedule.`,
  }),
  offer: (c) => ({
    type: "application_offer",
    title: `You received an offer for ${c.postingTitle}`,
    body: `Congratulations — ${c.companyName} would like to make you an offer.`,
  }),
  hired: (c) => ({
    type: "application_hired",
    title: `You're hired: ${c.postingTitle}`,
    body: `Welcome aboard at ${c.companyName}!`,
  }),
  rejected: (c) => ({
    type: "application_rejected",
    title: `Update on ${c.postingTitle}`,
    body: `${c.companyName} has decided not to move forward this time. Keep going — new jobs are posted every day.`,
  }),
};

/** Tells the jobseeker about a status move, if it's one worth telling them about. */
export async function notifyJobseekerOfStatus(
  ctx: NonNullable<Awaited<ReturnType<typeof getApplicationNotificationContext>>>,
  newStatus: string,
  opts: { rescheduled?: boolean } = {},
) {
  const message = JOBSEEKER_STATUS_MESSAGES[newStatus];
  if (!message) return;
  const input = message(ctx);
  if (newStatus === "interview" && opts.rescheduled) {
    input.type = "interview_rescheduled";
    input.title = `Interview updated: ${ctx.postingTitle}`;
    input.body = `${ctx.companyName} changed your interview details — please check and respond.`;
  }
  await notify([ctx.jobseekerUserId], "jobseeker", { ...input, link: "/jobseeker/applications" });
}

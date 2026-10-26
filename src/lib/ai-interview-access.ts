import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { jobApplications, jobPostings, jobseekerProfiles } from "./db/schema";
import { getAiInterviewContext } from "./ai-interview";
import { canManageApplication, canViewApplication, getScopedEmployerAccess } from "./hiring-scope";
import { isUuid } from "./uuid";

/**
 * One AI interview, only if it is addressed to this jobseeker. Returns the
 * interview context (status already adjusted for an overdue deadline).
 */
export async function loadJobseekerInterview(userId: string, interviewId: unknown) {
  if (!isUuid(interviewId)) return null;
  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  if (!profile) return null;
  const ctx = await getAiInterviewContext(interviewId);
  if (!ctx || ctx.jobseekerProfileId !== profile.id) return null;
  return ctx;
}

/**
 * The signed-in employer's access to one application, for the AI interview
 * routes: the application must belong to their company and be visible in
 * their hiring scope. `canManage` (owner, admin, or the job's hiring
 * manager) is what lets them send or change an AI interview; anyone who can
 * see the application — including a panel member — can read its report.
 */
export async function loadEmployerApplication(userId: string, applicationId: unknown) {
  if (!isUuid(applicationId)) return null;
  const access = await getScopedEmployerAccess(userId);
  if (!access) return null;
  const [application] = await db
    .select({
      id: jobApplications.id,
      status: jobApplications.status,
      jobPostingId: jobApplications.jobPostingId,
      interviewDetails: jobApplications.interviewDetails,
      jobseekerProfileId: jobApplications.jobseekerProfileId,
      postingTitle: jobPostings.title,
      postingDescription: jobPostings.description,
      postingResponsibilities: jobPostings.responsibilities,
      postingSkills: jobPostings.skills,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(and(eq(jobApplications.id, applicationId), eq(jobPostings.employerProfileId, access.profile.id)))
    .limit(1);
  if (!application || !canViewApplication(access.scope, application)) return null;
  return { access, application, canManage: canManageApplication(access.scope, application) };
}

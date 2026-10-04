import "server-only";
import { and, desc, eq, getTableColumns, inArray, notInArray } from "drizzle-orm";
import { db } from "./db";
import {
  employerProfiles,
  interviewEvaluations,
  jobApplications,
  jobPostings,
  jobseekerProfiles,
  users,
} from "./db/schema";
import { summarizeEvaluations, type InterviewEvaluation, type PanelEvaluation } from "./interviewEvaluation";
import { getPitchSummariesForEmployer } from "./video-pitch";
import { stripCustomQuestionAnswers } from "./job-postings";

/**
 * Every panelist's scorecard for each application's *current* interview
 * round (a scorecard from an earlier round is stale once a new round is
 * scheduled), keyed by application id. Names follow the same rule as the
 * Team page: the company's owner goes by their profile's contactName,
 * everyone else by their account name.
 */
export async function getPanelEvaluations(
  employerProfileId: string,
  applications: { id: string; interviewDetails: { round: number } | null }[],
): Promise<Map<string, PanelEvaluation[]>> {
  const result = new Map<string, PanelEvaluation[]>();
  const ids = applications.map((a) => a.id);
  if (ids.length === 0) return result;

  const [rows, [owner]] = await Promise.all([
    db
      .select({
        jobApplicationId: interviewEvaluations.jobApplicationId,
        evaluatorUserId: interviewEvaluations.evaluatorUserId,
        evaluatorAccountName: users.name,
        round: interviewEvaluations.round,
        scores: interviewEvaluations.scores,
        recommendation: interviewEvaluations.recommendation,
        notes: interviewEvaluations.notes,
      })
      .from(interviewEvaluations)
      .leftJoin(users, eq(users.id, interviewEvaluations.evaluatorUserId))
      .where(inArray(interviewEvaluations.jobApplicationId, ids))
      .orderBy(interviewEvaluations.createdAt),
    db
      .select({ userId: employerProfiles.userId, contactName: employerProfiles.contactName })
      .from(employerProfiles)
      .where(eq(employerProfiles.id, employerProfileId))
      .limit(1),
  ]);

  const currentRound = new Map(applications.map((a) => [a.id, a.interviewDetails?.round ?? null]));
  for (const row of rows) {
    if (row.round !== currentRound.get(row.jobApplicationId)) continue;
    const evaluatorName =
      row.evaluatorUserId && owner && row.evaluatorUserId === owner.userId
        ? owner.contactName
        : row.evaluatorAccountName;
    const list = result.get(row.jobApplicationId) ?? [];
    list.push({
      evaluatorUserId: row.evaluatorUserId,
      evaluatorName,
      round: row.round,
      scores: row.scores,
      recommendation: row.recommendation as InterviewEvaluation["recommendation"],
      notes: row.notes,
    });
    result.set(row.jobApplicationId, list);
  }
  return result;
}

// Adds `evaluations` (each panelist's own scorecard), `evaluation` (the
// combined summary every list/badge already renders), and `videoPitch` (the
// applicant's visible pitch, as this company sees it — null if none) to
// loader rows.
async function withEvaluations<
  T extends { application: { id: string; jobseekerProfileId: string; interviewDetails: { round: number } | null } },
>(employerProfileId: string, rows: T[]) {
  const [byApplication, pitches] = await Promise.all([
    getPanelEvaluations(
      employerProfileId,
      rows.map((r) => r.application),
    ),
    getPitchSummariesForEmployer(
      employerProfileId,
      rows.map((r) => r.application.jobseekerProfileId),
    ),
  ]);
  return rows.map((row) => {
    const evaluations = byApplication.get(row.application.id) ?? [];
    return {
      ...row,
      evaluations,
      evaluation: summarizeEvaluations(evaluations),
      videoPitch: pitches.get(row.application.jobseekerProfileId) ?? null,
    };
  });
}

export async function getApplicationsForEmployer(employerProfileId: string) {
  const rows = await db
    .select({
      application: jobApplications,
      jobPostingId: jobPostings.id,
      jobPostingTitle: jobPostings.title,
      applicantName: jobseekerProfiles.fullName,
      applicantAvatarUrl: jobseekerProfiles.avatarUrl,
      applicantLocation: jobseekerProfiles.location,
      applicantTargetRole: jobseekerProfiles.targetRole,
      applicantYearsExperience: jobseekerProfiles.yearsExperience,
      applicantSkills: jobseekerProfiles.professionalSkills,
      applicantExpectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
      applicantExpectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
      applicantEmploymentType: jobseekerProfiles.employmentType,
      applicantWorkArrangement: jobseekerProfiles.workArrangement,
      applicantNoticePeriod: jobseekerProfiles.noticePeriod,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(eq(jobPostings.employerProfileId, employerProfileId))
    .orderBy(desc(jobApplications.appliedAt));

  return withEvaluations(employerProfileId, rows);
}

// Same shape as getApplicationsForEmployer, scoped to one posting — for the
// Manage Job "view posting" page, which shows a job's own applicants/
// interviews instead of every posting's.
export async function getApplicationsForJobPosting(employerProfileId: string, jobPostingId: string) {
  const rows = await db
    .select({
      application: jobApplications,
      jobPostingId: jobPostings.id,
      jobPostingTitle: jobPostings.title,
      applicantName: jobseekerProfiles.fullName,
      applicantAvatarUrl: jobseekerProfiles.avatarUrl,
      applicantLocation: jobseekerProfiles.location,
      applicantDateOfBirth: jobseekerProfiles.dateOfBirth,
      applicantTargetRole: jobseekerProfiles.targetRole,
      applicantYearsExperience: jobseekerProfiles.yearsExperience,
      applicantSkills: jobseekerProfiles.professionalSkills,
      applicantExpectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
      applicantExpectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
      applicantEmploymentType: jobseekerProfiles.employmentType,
      applicantWorkArrangement: jobseekerProfiles.workArrangement,
      applicantNoticePeriod: jobseekerProfiles.noticePeriod,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.id, jobPostingId)))
    .orderBy(desc(jobApplications.appliedAt));

  return withEvaluations(employerProfileId, rows);
}

// For the "Top Matches" AI matching endpoint — every non-terminal
// application (hired/rejected/withdrawn are already decided, so they're
// excluded from a "who should we interview next" ranking) with every field
// the match score is computed from: the posting's requirements and the
// jobseeker's profile. Scoring itself happens server-side in
// src/lib/matching.ts.
export async function getMatchCandidatesRaw(employerProfileId: string) {
  return db
    .select({
      applicationId: jobApplications.id,
      status: jobApplications.status,
      appliedAt: jobApplications.appliedAt,
      screeningEligible: jobApplications.screeningEligible,
      jobPostingId: jobPostings.id,
      jobPostingTitle: jobPostings.title,
      jobPostingLocation: jobPostings.location,
      requiredSkills: jobPostings.skills,
      postingSoftSkills: jobPostings.softSkills,
      niceToHaveSkills: jobPostings.niceToHaveSkills,
      minYearsExperience: jobPostings.minYearsExperience,
      requiredWorkAuthorizations: jobPostings.workAuthorizations,
      requiredDrivingLicense: jobPostings.drivingLicense,
      postingIndustry: jobPostings.industry,
      postingWorkArrangement: jobPostings.workArrangement,
      postingEmploymentType: jobPostings.employmentType,
      applicantName: jobseekerProfiles.fullName,
      applicantAvatarUrl: jobseekerProfiles.avatarUrl,
      applicantSkills: jobseekerProfiles.professionalSkills,
      applicantSoftSkills: jobseekerProfiles.softSkills,
      applicantOtherSkills: jobseekerProfiles.otherSkills,
      applicantYearsExperience: jobseekerProfiles.yearsExperience,
      applicantWorkAuthorization: jobseekerProfiles.workAuthorization,
      applicantDrivingLicense: jobseekerProfiles.drivingLicense,
      applicantPreferredIndustry: jobseekerProfiles.preferredIndustry,
      applicantWorkArrangement: jobseekerProfiles.workArrangement,
      applicantEmploymentType: jobseekerProfiles.employmentType,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(
      and(
        eq(jobPostings.employerProfileId, employerProfileId),
        notInArray(jobApplications.status, ["hired", "rejected", "withdrawn"]),
      ),
    )
    .orderBy(desc(jobApplications.appliedAt));
}

// For the Interviews page — every application currently at the "interview"
// stage, same shape as getApplicationsForEmployer so the two views can share
// row/card markup.
export async function getInterviewApplicationsForEmployer(employerProfileId: string) {
  const rows = await db
    .select({
      application: jobApplications,
      jobPostingId: jobPostings.id,
      jobPostingTitle: jobPostings.title,
      applicantName: jobseekerProfiles.fullName,
      applicantAvatarUrl: jobseekerProfiles.avatarUrl,
      applicantLocation: jobseekerProfiles.location,
      applicantTargetRole: jobseekerProfiles.targetRole,
      applicantYearsExperience: jobseekerProfiles.yearsExperience,
      applicantSkills: jobseekerProfiles.professionalSkills,
      applicantExpectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
      applicantExpectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
      applicantEmploymentType: jobseekerProfiles.employmentType,
      applicantWorkArrangement: jobseekerProfiles.workArrangement,
      applicantNoticePeriod: jobseekerProfiles.noticePeriod,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(
      and(
        eq(jobPostings.employerProfileId, employerProfileId),
        inArray(jobApplications.status, ["interview", "interviewed", "evaluation", "evaluated"]),
      ),
    )
    .orderBy(desc(jobApplications.appliedAt));

  return withEvaluations(employerProfileId, rows);
}

// For the Interviews page's "Schedule interview" picker — shortlisted
// applicants haven't been given interview details yet, so they don't show
// up in getInterviewApplicationsForEmployer above, but they're exactly who
// an employer would want to schedule next. Same shape so the two lists can
// share row/card markup and merge into one client-side rows array.
export async function getShortlistedApplicationsForEmployer(employerProfileId: string) {
  const rows = await db
    .select({
      application: jobApplications,
      jobPostingId: jobPostings.id,
      jobPostingTitle: jobPostings.title,
      applicantName: jobseekerProfiles.fullName,
      applicantAvatarUrl: jobseekerProfiles.avatarUrl,
      applicantLocation: jobseekerProfiles.location,
      applicantTargetRole: jobseekerProfiles.targetRole,
      applicantYearsExperience: jobseekerProfiles.yearsExperience,
      applicantSkills: jobseekerProfiles.professionalSkills,
      applicantExpectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
      applicantExpectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
      applicantEmploymentType: jobseekerProfiles.employmentType,
      applicantWorkArrangement: jobseekerProfiles.workArrangement,
      applicantNoticePeriod: jobseekerProfiles.noticePeriod,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobApplications.status, "shortlisted")))
    .orderBy(desc(jobApplications.appliedAt));

  return withEvaluations(employerProfileId, rows);
}

export async function getJobseekerProfileId(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  return profile?.id ?? null;
}

export async function getAppliedJobPostingIds(jobseekerProfileId: string): Promise<string[]> {
  const rows = await db
    .select({ jobPostingId: jobApplications.jobPostingId })
    .from(jobApplications)
    .where(eq(jobApplications.jobseekerProfileId, jobseekerProfileId));
  return rows.map((r) => r.jobPostingId);
}

// For the jobseeker's "My Applications" list — every application they've
// made, with just enough of the posting/employer to show what it is and who
// it's with.
export async function getApplicationsForJobseeker(jobseekerProfileId: string) {
  // `posting` intentionally omits `posterUrl` (base64, can run MB-scale) —
  // this list never renders a poster image, same bug/fix as
  // jobPostingListColumns in job-postings.ts.
  const { posterUrl: _posterUrl, ...postingColumns } = getTableColumns(jobPostings);
  const rows = await db
    .select({
      application: jobApplications,
      posting: postingColumns,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobApplications.jobseekerProfileId, jobseekerProfileId))
    .orderBy(desc(jobApplications.appliedAt));
  // Goes to the jobseeker's browser — screening answers stay server-side.
  return rows.map((row) => ({ ...row, posting: stripCustomQuestionAnswers(row.posting) }));
}

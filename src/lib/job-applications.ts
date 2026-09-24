import "server-only";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, interviewEvaluations, jobApplications, jobPostings, jobseekerProfiles } from "./db/schema";
import type { InterviewEvaluation } from "./interviewEvaluation";

function toEvaluation(row: {
  evaluationRound: number | null;
  evaluationScores: Record<string, number> | null;
  evaluationRecommendation: string | null;
  evaluationNotes: string | null;
}): InterviewEvaluation | null {
  if (!row.evaluationRecommendation || row.evaluationRound === null || !row.evaluationScores) return null;
  return {
    round: row.evaluationRound,
    scores: row.evaluationScores,
    recommendation: row.evaluationRecommendation as InterviewEvaluation["recommendation"],
    notes: row.evaluationNotes,
  };
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
      applicantResumeUrl: jobseekerProfiles.resumeUrl,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
      evaluationRound: interviewEvaluations.round,
      evaluationScores: interviewEvaluations.scores,
      evaluationRecommendation: interviewEvaluations.recommendation,
      evaluationNotes: interviewEvaluations.notes,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .leftJoin(interviewEvaluations, eq(interviewEvaluations.jobApplicationId, jobApplications.id))
    .where(eq(jobPostings.employerProfileId, employerProfileId))
    .orderBy(desc(jobApplications.appliedAt));

  return rows.map(({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes, ...row }) => ({
    ...row,
    evaluation: toEvaluation({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes }),
  }));
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
      applicantResumeUrl: jobseekerProfiles.resumeUrl,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
      evaluationRound: interviewEvaluations.round,
      evaluationScores: interviewEvaluations.scores,
      evaluationRecommendation: interviewEvaluations.recommendation,
      evaluationNotes: interviewEvaluations.notes,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .leftJoin(interviewEvaluations, eq(interviewEvaluations.jobApplicationId, jobApplications.id))
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.id, jobPostingId)))
    .orderBy(desc(jobApplications.appliedAt));

  return rows.map(({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes, ...row }) => ({
    ...row,
    evaluation: toEvaluation({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes }),
  }));
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
      applicantResumeUrl: jobseekerProfiles.resumeUrl,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
      evaluationRound: interviewEvaluations.round,
      evaluationScores: interviewEvaluations.scores,
      evaluationRecommendation: interviewEvaluations.recommendation,
      evaluationNotes: interviewEvaluations.notes,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .leftJoin(interviewEvaluations, eq(interviewEvaluations.jobApplicationId, jobApplications.id))
    .where(
      and(
        eq(jobPostings.employerProfileId, employerProfileId),
        inArray(jobApplications.status, ["interview", "interviewed", "evaluation", "evaluated"]),
      ),
    )
    .orderBy(desc(jobApplications.appliedAt));

  return rows.map(({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes, ...row }) => ({
    ...row,
    evaluation: toEvaluation({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes }),
  }));
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
      applicantResumeUrl: jobseekerProfiles.resumeUrl,
      applicantResumeFileName: jobseekerProfiles.resumeFileName,
      evaluationRound: interviewEvaluations.round,
      evaluationScores: interviewEvaluations.scores,
      evaluationRecommendation: interviewEvaluations.recommendation,
      evaluationNotes: interviewEvaluations.notes,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(jobseekerProfiles, eq(jobApplications.jobseekerProfileId, jobseekerProfiles.id))
    .leftJoin(interviewEvaluations, eq(interviewEvaluations.jobApplicationId, jobApplications.id))
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobApplications.status, "shortlisted")))
    .orderBy(desc(jobApplications.appliedAt));

  return rows.map(({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes, ...row }) => ({
    ...row,
    evaluation: toEvaluation({ evaluationRound, evaluationScores, evaluationRecommendation, evaluationNotes }),
  }));
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
  return db
    .select({
      application: jobApplications,
      posting: jobPostings,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobApplications.jobseekerProfileId, jobseekerProfileId))
    .orderBy(desc(jobApplications.appliedAt));
}

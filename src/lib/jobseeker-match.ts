import "server-only";
import type { jobPostings, jobseekerProfiles } from "./db/schema";
import {
  employmentTypeMatchScore,
  experienceFitScore,
  hardFilterCheck,
  industryMatchScore,
  skillsOverlapScore,
  weightedScore,
  workArrangementMatchScore,
  type MatchBreakdown,
} from "./matching";

type Posting = Pick<
  typeof jobPostings.$inferSelect,
  | "workAuthorizations"
  | "drivingLicense"
  | "skills"
  | "softSkills"
  | "niceToHaveSkills"
  | "minYearsExperience"
  | "industry"
  | "workArrangement"
  | "employmentType"
>;

type Profile = Pick<
  typeof jobseekerProfiles.$inferSelect,
  | "workAuthorization"
  | "drivingLicense"
  | "professionalSkills"
  | "softSkills"
  | "otherSkills"
  | "yearsExperience"
  | "preferredIndustry"
  | "workArrangement"
  | "employmentType"
>;

export type JobseekerMatch = {
  score: number;
  eligible: boolean;
  ineligibleReasons: string[];
  breakdown: MatchBreakdown;
};

/**
 * How well one jobseeker fits one posting — the same scoring as the
 * employer's "Top Matches" (src/lib/matching.ts), run from the jobseeker's
 * side. Shared by the job detail page and new-job alerts so a "92% match"
 * alert always agrees with the page it links to.
 */
export function scoreJobseekerForPosting(posting: Posting, profile: Profile): JobseekerMatch {
  const { eligible, reasons } = hardFilterCheck({
    requiredWorkAuthorizations: posting.workAuthorizations,
    candidateWorkAuthorization: profile.workAuthorization,
    requiredDrivingLicense: posting.drivingLicense,
    candidateDrivingLicense: profile.drivingLicense,
  });
  // Employers and jobseekers file traits like "Communication" or
  // "Leadership" inconsistently — one side's required skill is the other's
  // soft skill tag, or vice versa — so all three skill components check the
  // candidate's combined pool rather than only their same-named counterpart
  // bucket. Mirrors the employer-side fix in
  // src/app/api/employer/applicants/matches/route.ts.
  const profileAllSkills = [...profile.professionalSkills, ...profile.softSkills, ...profile.otherSkills];
  const breakdown: MatchBreakdown = {
    skills: skillsOverlapScore(posting.skills, profileAllSkills),
    softSkills: skillsOverlapScore(posting.softSkills, profileAllSkills),
    niceToHaveSkills: skillsOverlapScore(posting.niceToHaveSkills, profileAllSkills),
    experience: experienceFitScore(posting.minYearsExperience, profile.yearsExperience),
    industry: industryMatchScore(posting.industry, profile.preferredIndustry),
    workArrangement: workArrangementMatchScore(posting.workArrangement, profile.workArrangement),
    employmentType: employmentTypeMatchScore(posting.employmentType, profile.employmentType),
  };
  return {
    score: eligible ? weightedScore(breakdown) : 0,
    eligible,
    ineligibleReasons: reasons,
    breakdown,
  };
}

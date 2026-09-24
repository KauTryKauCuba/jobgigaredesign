import { NextResponse } from "next/server";
import { getEmployerProfile } from "@/lib/employer-profile";
import { getMatchCandidatesRaw } from "@/lib/job-applications";
import {
  employmentTypeMatchScore,
  experienceFitScore,
  hardFilterCheck,
  industryMatchScore,
  skillsOverlapScore,
  weightedScore,
  withCriteriaDefaults,
  workArrangementMatchScore,
  type MatchBreakdown,
} from "@/lib/matching";
import { getSession } from "@/lib/session";

export type MatchResult = {
  applicationId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  jobPostingLocation: string;
  jobPostingEmploymentType: string;
  applicantName: string;
  applicantAvatarUrl: string | null;
  score: number;
  eligible: boolean;
  ineligibleReasons: string[];
  breakdown: MatchBreakdown;
};

// The real "Top Matches" ranking (POST_JOB_GAPS.md §3.1) — hard filters
// (work authorization, driving license) gate eligibility, then a weighted
// blend of skills overlap, experience fit, and nice-to-have skills (see
// src/lib/matching.ts) produces the 0-100 score.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const profile = await getEmployerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ results: [] });
  }

  const candidates = await getMatchCandidatesRaw(profile.id);
  if (candidates.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const criteria = withCriteriaDefaults(profile.smartMatchCriteria);

  const results: MatchResult[] = candidates.map((c) => {
    const { eligible, reasons } = hardFilterCheck({
      requiredWorkAuthorizations: c.requiredWorkAuthorizations,
      candidateWorkAuthorization: c.applicantWorkAuthorization,
      requiredDrivingLicense: c.requiredDrivingLicense,
      candidateDrivingLicense: c.applicantDrivingLicense,
      enabledWorkAuthorization: criteria.workAuthorization,
      enabledDrivingLicense: criteria.drivingLicense,
    });

    const breakdown: MatchBreakdown = {
      skills: skillsOverlapScore(c.requiredSkills, c.applicantSkills),
      softSkills: skillsOverlapScore(c.postingSoftSkills, c.applicantSoftSkills),
      niceToHaveSkills: skillsOverlapScore(c.niceToHaveSkills, [...c.applicantSkills, ...c.applicantSoftSkills]),
      experience: experienceFitScore(c.minYearsExperience, c.applicantYearsExperience),
      industry: industryMatchScore(c.postingIndustry, c.applicantPreferredIndustry),
      workArrangement: workArrangementMatchScore(c.postingWorkArrangement, c.applicantWorkArrangement),
      employmentType: employmentTypeMatchScore(c.postingEmploymentType, c.applicantEmploymentType),
    };

    // Ineligible candidates still get a score (so the employer can see how
    // close they'd otherwise be) but it's zeroed and sorted last, since a
    // hard-filter failure means they can't actually be hired for this role.
    const score = eligible ? weightedScore(breakdown, criteria) : 0;

    return {
      applicationId: c.applicationId,
      jobPostingId: c.jobPostingId,
      jobPostingTitle: c.jobPostingTitle,
      jobPostingLocation: c.jobPostingLocation,
      jobPostingEmploymentType: c.postingEmploymentType,
      applicantName: c.applicantName,
      applicantAvatarUrl: c.applicantAvatarUrl,
      score,
      eligible,
      ineligibleReasons: reasons,
      breakdown,
    };
  });

  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({ results });
}

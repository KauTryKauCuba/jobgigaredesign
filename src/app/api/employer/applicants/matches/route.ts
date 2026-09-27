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
    // A posting with screening on has an explicit, applicant-given answer
    // to check against — trust it outright in both directions rather than
    // re-deriving eligibility from whatever the profile happens to say
    // today (which can drift after the applicant answered screening, e.g.
    // editing their profile's work authorization later). `screeningEligible`
    // is null when screening wasn't required for this application, which
    // falls through to the profile-derived hard filter below unchanged.
    const { eligible, reasons } =
      c.screeningEligible === false
        ? { eligible: false, reasons: ["Doesn't meet this posting's screening requirements"] }
        : c.screeningEligible === true
          ? { eligible: true, reasons: [] }
          : hardFilterCheck({
              requiredWorkAuthorizations: c.requiredWorkAuthorizations,
              candidateWorkAuthorization: c.applicantWorkAuthorization,
              requiredDrivingLicense: c.requiredDrivingLicense,
              candidateDrivingLicense: c.applicantDrivingLicense,
              enabledWorkAuthorization: criteria.workAuthorization,
              enabledDrivingLicense: criteria.drivingLicense,
            });

    // Employers and jobseekers file traits like "Communication" or
    // "Leadership" inconsistently — one side's required *skill* is the
    // other's *soft skill* tag, or vice versa. Matching each bucket only
    // against its same-named counterpart produces false negatives for
    // exactly this case, so all three skill components check the
    // candidate's combined skills + soft skills pool, same as
    // niceToHaveSkills already did.
    const applicantAllSkills = [...c.applicantSkills, ...c.applicantSoftSkills, ...c.applicantOtherSkills];
    const breakdown: MatchBreakdown = {
      skills: skillsOverlapScore(c.requiredSkills, applicantAllSkills),
      softSkills: skillsOverlapScore(c.postingSoftSkills, applicantAllSkills),
      niceToHaveSkills: skillsOverlapScore(c.niceToHaveSkills, applicantAllSkills),
      experience: experienceFitScore(c.minYearsExperience, c.applicantYearsExperience),
      industry: industryMatchScore(c.postingIndustry, c.applicantPreferredIndustry),
      workArrangement: workArrangementMatchScore(c.postingWorkArrangement, c.applicantWorkArrangement),
      employmentType: employmentTypeMatchScore(c.postingEmploymentType, c.applicantEmploymentType),
    };

    // Job-fit score (skills/experience/etc.) and screening eligibility are
    // two separate questions — a candidate can be a strong skills fit but
    // still fail a hard screening requirement (e.g. minimum education), or
    // vice versa. Keeping the real weightedScore here even when ineligible
    // lets the UI show both independently instead of a misleading 0%;
    // callers that need "who can actually be hired" already filter on
    // `eligible` directly rather than relying on the score being zeroed.
    const score = weightedScore(breakdown, criteria);

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

  // Eligible candidates first (score alone no longer implies eligibility
  // now that ineligible candidates keep their real job-fit score), then by
  // score within each group.
  results.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);

  return NextResponse.json({ results });
}

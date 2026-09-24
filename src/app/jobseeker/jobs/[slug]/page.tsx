import { notFound, redirect } from "next/navigation";
import JobPostingDetailView from "@/components/JobPostingDetailView";
import { getAuthUser } from "@/lib/auth-user";
import { getActiveJobPostingBySlug } from "@/lib/job-postings";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import {
  employmentTypeMatchScore,
  experienceFitScore,
  hardFilterCheck,
  industryMatchScore,
  skillsOverlapScore,
  weightedScore,
  workArrangementMatchScore,
  type MatchBreakdown,
} from "@/lib/matching";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function JobPostingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const { slug } = await params;
  const [authUser, profile, row] = await Promise.all([
    getAuthUser(),
    getJobseekerProfile(session.userId),
    getActiveJobPostingBySlug(slug),
  ]);
  if (!authUser) redirect("/jobseeker");
  // Only active postings get a page — closed/draft/pending/rejected/flagged
  // postings aren't meant to be reachable by a jobseeker at all.
  if (!row) notFound();

  const resume = profile?.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;

  // How well this jobseeker fits this specific posting — same scoring used
  // for the employer's "Top Matches" (src/lib/matching.ts), just run in the
  // other direction. All criteria weighted equally (full DEFAULT_CRITERIA);
  // there's no jobseeker-side equivalent of the employer's on/off toggles.
  const posting = row.posting;
  const match = profile
    ? (() => {
        const { eligible, reasons } = hardFilterCheck({
          requiredWorkAuthorizations: posting.workAuthorizations,
          candidateWorkAuthorization: profile.workAuthorization,
          requiredDrivingLicense: posting.drivingLicense,
          candidateDrivingLicense: profile.drivingLicense,
        });
        const breakdown: MatchBreakdown = {
          skills: skillsOverlapScore(posting.skills, profile.professionalSkills),
          softSkills: skillsOverlapScore(posting.softSkills, profile.softSkills),
          niceToHaveSkills: skillsOverlapScore(posting.niceToHaveSkills, [
            ...profile.professionalSkills,
            ...profile.softSkills,
          ]),
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
      })()
    : null;

  return (
    <JobPostingDetailView
      authUser={authUser}
      resume={resume}
      posting={JSON.parse(JSON.stringify(posting))}
      companyName={row.companyName}
      companyLogoUrl={row.companyLogoUrl}
      match={match}
    />
  );
}

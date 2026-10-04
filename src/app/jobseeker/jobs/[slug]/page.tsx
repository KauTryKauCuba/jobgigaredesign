import { notFound, redirect } from "next/navigation";
import JobPostingDetailView from "@/components/JobPostingDetailView";
import { getEmployerResponsiveness } from "@/lib/application-events";
import { getAuthUser } from "@/lib/auth-user";
import { getActiveJobPostingBySlug, stripCustomQuestionAnswers } from "@/lib/job-postings";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { scoreJobseekerForPosting } from "@/lib/jobseeker-match";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSavedJobPostingIds } from "@/lib/saved-jobs";
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
  // for the employer's "Top Matches", just run in the other direction (and
  // the same one new-job alerts use, so an alert's % agrees with this page).
  const posting = row.posting;
  const match = profile ? scoreJobseekerForPosting(posting, profile) : null;

  const [responsivenessMap, savedIds] = await Promise.all([
    getEmployerResponsiveness([posting.employerProfileId]),
    profile ? getSavedJobPostingIds(profile.id) : ([] as string[]),
  ]);
  const responsiveness = responsivenessMap.get(posting.employerProfileId) ?? null;

  return (
    <JobPostingDetailView
      authUser={authUser}
      resume={resume}
      posting={JSON.parse(JSON.stringify(stripCustomQuestionAnswers(posting)))}
      companyName={row.companyName}
      companyLogoUrl={row.companyLogoUrl}
      match={match}
      responsiveness={responsiveness}
      initialSaved={savedIds.includes(posting.id)}
    />
  );
}

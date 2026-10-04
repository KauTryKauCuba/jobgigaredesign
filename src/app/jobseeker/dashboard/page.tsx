import { redirect } from "next/navigation";
import JobseekerDashboard from "@/components/JobseekerDashboard";
import { getEmployerResponsiveness } from "@/lib/application-events";
import { getAuthUser } from "@/lib/auth-user";
import { getApplicationsForJobseeker } from "@/lib/job-applications";
import { getJobPostingsByStatus, stripCustomQuestionAnswers } from "@/lib/job-postings";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSavedJobPostingIds } from "@/lib/saved-jobs";
import { getSession } from "@/lib/session";

export default async function JobseekerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile, activePostings] = await Promise.all([
    getAuthUser(),
    getJobseekerProfile(session.userId),
    getJobPostingsByStatus("active"),
  ]);
  if (!authUser) redirect("/jobseeker");

  const resume = profile?.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;
  const [applications, responsiveness, savedJobPostingIds] = await Promise.all([
    profile ? getApplicationsForJobseeker(profile.id) : [],
    getEmployerResponsiveness(activePostings.map((row) => row.posting.employerProfileId)),
    profile ? getSavedJobPostingIds(profile.id) : [],
  ]);
  // Sent to the jobseeker's browser — screening answers stay server-side.
  const postingsWithResponsiveness = activePostings.map((row) => ({
    ...row,
    posting: stripCustomQuestionAnswers(row.posting),
    responsiveness: responsiveness.get(row.posting.employerProfileId) ?? null,
  }));

  return (
    <JobseekerDashboard
      authUser={authUser}
      resume={resume}
      activePostings={JSON.parse(JSON.stringify(postingsWithResponsiveness))}
      applications={JSON.parse(JSON.stringify(applications))}
      savedJobPostingIds={savedJobPostingIds}
    />
  );
}

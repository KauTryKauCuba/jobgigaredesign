import { redirect } from "next/navigation";
import JobseekerDashboard from "@/components/JobseekerDashboard";
import { getAuthUser } from "@/lib/auth-user";
import { getApplicationsForJobseeker } from "@/lib/job-applications";
import { getJobPostingsByStatus } from "@/lib/job-postings";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
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
  const applications = profile ? await getApplicationsForJobseeker(profile.id) : [];

  return (
    <JobseekerDashboard
      authUser={authUser}
      resume={resume}
      activePostings={JSON.parse(JSON.stringify(activePostings))}
      applications={JSON.parse(JSON.stringify(applications))}
    />
  );
}

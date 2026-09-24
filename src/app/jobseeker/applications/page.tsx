import { redirect } from "next/navigation";
import JobseekerApplicationsView from "@/components/JobseekerApplicationsView";
import { getAuthUser } from "@/lib/auth-user";
import { getApplicationsForJobseeker } from "@/lib/job-applications";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function JobseekerApplicationsPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser) redirect("/jobseeker");

  const resume = profile?.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;
  const applications = profile ? await getApplicationsForJobseeker(profile.id) : [];

  return (
    <JobseekerApplicationsView
      authUser={authUser}
      resume={resume}
      applications={JSON.parse(JSON.stringify(applications))}
    />
  );
}

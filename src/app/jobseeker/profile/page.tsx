import { redirect } from "next/navigation";
import JobseekerDashboardShell from "@/components/JobseekerDashboardShell";
import OnboardingForm from "@/components/OnboardingForm";
import { getAuthUser } from "@/lib/auth-user";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function JobseekerProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([
    getAuthUser(),
    getJobseekerProfile(session.userId),
  ]);
  if (!authUser || !profile) redirect("/jobseeker/onboarding");

  const resume = profile.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="profile"
      heading="My Profile"
      subheading="Everything employers see about you, straight from onboarding."
      resume={resume}
    >
      <OnboardingForm mode="edit" initialProfile={profile} accountEmail={authUser.email} />
    </JobseekerDashboardShell>
  );
}

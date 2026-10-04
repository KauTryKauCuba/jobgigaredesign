import { redirect } from "next/navigation";
import JobseekerDashboardShell from "@/components/JobseekerDashboardShell";
import OnboardingForm from "@/components/OnboardingForm";
import VideoPitchCard from "@/components/VideoPitchCard";
import { getAuthUser } from "@/lib/auth-user";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";
import { getVideoPitchForProfile } from "@/lib/video-pitch";

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

  const pitch = await getVideoPitchForProfile(profile.id);
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
      <OnboardingForm
        mode="edit"
        initialProfile={profile}
        accountEmail={authUser.email}
        topSlot={
          <VideoPitchCard
            key="video-pitch"
            initialPitch={pitch ? JSON.parse(JSON.stringify(pitch)) : null}
            skills={[...new Set([...profile.professionalSkills, ...profile.softSkills, ...profile.otherSkills])]}
          />
        }
      />
    </JobseekerDashboardShell>
  );
}

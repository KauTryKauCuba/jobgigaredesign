import { redirect } from "next/navigation";
import ResumeDesignerView from "@/components/ResumeDesignerView";
import { getAuthUser } from "@/lib/auth-user";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function ResumeDesignerPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker");

  const resume = profile.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;

  return <ResumeDesignerView authUser={authUser} resume={resume} profile={JSON.parse(JSON.stringify(profile))} />;
}

import { redirect } from "next/navigation";
import CoverLetterGeneratorView from "@/components/CoverLetterGeneratorView";
import { getAuthUser } from "@/lib/auth-user";
import { getCoverLettersForProfile } from "@/lib/cover-letters";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function CoverLettersPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker");

  const resume = profile.resumeFileName
    ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize }
    : null;
  const letters = await getCoverLettersForProfile(profile.id);

  return (
    <CoverLetterGeneratorView
      authUser={authUser}
      resume={resume}
      initialCoverLetters={JSON.parse(JSON.stringify(letters))}
    />
  );
}

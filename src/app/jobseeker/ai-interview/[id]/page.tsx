import { notFound, redirect } from "next/navigation";
import AiInterviewRoom from "@/components/AiInterviewRoom";
import { getJobseekerAiInterview } from "@/lib/ai-interview";
import { getAuthUser } from "@/lib/auth-user";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

// The applicant's AI interview: consent, a practice question, then five
// recorded answers. Only the person it was sent to can open it.
export default async function JobseekerAiInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker");
  if (!isUuid(id)) notFound();

  const interview = await getJobseekerAiInterview(id, profile.id);
  if (!interview) notFound();

  const resume = profile.resumeFileName ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize } : null;
  return <AiInterviewRoom authUser={authUser} resume={resume} initialInterview={JSON.parse(JSON.stringify(interview))} />;
}

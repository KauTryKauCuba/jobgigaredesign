import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobseekerProfiles } from "@/lib/db/schema";
import SavedJobsView from "@/components/SavedJobsView";
import { getAuthUser } from "@/lib/auth-user";
import { getAppliedJobPostingIds } from "@/lib/job-applications";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSavedJobs } from "@/lib/saved-jobs";
import { getSession } from "@/lib/session";

export default async function JobseekerSavedJobsPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker/onboarding");

  const [saved, appliedIds, [alerts]] = await Promise.all([
    getSavedJobs(profile.id),
    getAppliedJobPostingIds(profile.id),
    db
      .select({ enabled: jobseekerProfiles.jobAlertsEnabled })
      .from(jobseekerProfiles)
      .where(eq(jobseekerProfiles.id, profile.id))
      .limit(1),
  ]);
  const resume = profile.resumeFileName ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize } : null;

  return (
    <SavedJobsView
      authUser={authUser}
      resume={resume}
      savedJobs={JSON.parse(JSON.stringify(saved))}
      appliedJobPostingIds={appliedIds}
      initialAlertsEnabled={alerts?.enabled ?? true}
    />
  );
}

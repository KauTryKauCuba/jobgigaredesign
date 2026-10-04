import { redirect } from "next/navigation";
import JobseekerApplicationsView from "@/components/JobseekerApplicationsView";
import { getApplicationEvents, getEmployerResponsiveness } from "@/lib/application-events";
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
  // Each application's step-by-step history, plus how quickly its employer
  // usually replies — together they power the "where things stand" tracker.
  const [events, responsiveness] = await Promise.all([
    getApplicationEvents(applications.map((row) => row.application.id)),
    getEmployerResponsiveness(applications.map((row) => row.posting.employerProfileId)),
  ]);
  const rows = applications.map((row) => ({
    ...row,
    events: events.get(row.application.id) ?? [],
    responsiveness: responsiveness.get(row.posting.employerProfileId) ?? null,
  }));

  return (
    <JobseekerApplicationsView
      authUser={authUser}
      resume={resume}
      applications={JSON.parse(JSON.stringify(rows))}
    />
  );
}

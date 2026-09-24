import { redirect } from "next/navigation";
import EmployerInterviewsView from "@/components/EmployerInterviewsView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
import { getInterviewApplicationsForEmployer, getShortlistedApplicationsForEmployer } from "@/lib/job-applications";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerInterviewsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  const [applications, shortlisted, addresses] = profile
    ? await Promise.all([
        getInterviewApplicationsForEmployer(profile.id),
        getShortlistedApplicationsForEmployer(profile.id),
        getEmployerAddresses(profile.id),
      ])
    : [[], [], []];

  return (
    <EmployerInterviewsView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile?.id ?? "none"}
      authUser={authUser}
      applications={JSON.parse(JSON.stringify(applications))}
      shortlisted={JSON.parse(JSON.stringify(shortlisted))}
      addresses={JSON.parse(JSON.stringify(addresses))}
    />
  );
}

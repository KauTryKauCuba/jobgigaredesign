import { redirect } from "next/navigation";
import EmployerApplicantsView from "@/components/EmployerApplicantsView";
import { countApplicantsWaitingLong, getEmployerResponsiveness } from "@/lib/application-events";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser, getEmployerTeamMembers } from "@/lib/employer-profile";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { withCriteriaDefaults } from "@/lib/matching";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerApplicantsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  const [applications, addresses, teamMembers, responsiveness, waitingLong] = profile
    ? await Promise.all([
        getApplicationsForEmployer(profile.id),
        getEmployerAddresses(profile.id),
        getEmployerTeamMembers(profile.id, profile.userId),
        getEmployerResponsiveness([profile.id]).then((map) => map.get(profile.id) ?? null),
        countApplicantsWaitingLong(profile.id),
      ])
    : [[], [], [], null, 0];

  return (
    <EmployerApplicantsView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile?.id ?? "none"}
      authUser={authUser}
      applications={JSON.parse(JSON.stringify(applications))}
      initialSmartMatchEnabled={profile?.smartMatchEnabled ?? true}
      initialCriteria={withCriteriaDefaults(profile?.smartMatchCriteria)}
      addresses={JSON.parse(JSON.stringify(addresses))}
      currentUserRole={profile?.contactPosition ?? profile?.contactRole ?? null}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      responsiveness={responsiveness}
      waitingLong={waitingLong}
    />
  );
}

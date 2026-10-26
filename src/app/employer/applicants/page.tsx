import { redirect } from "next/navigation";
import EmployerApplicantsView from "@/components/EmployerApplicantsView";
import { countApplicantsWaitingLong, getEmployerResponsiveness } from "@/lib/application-events";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerTeamMembers } from "@/lib/employer-profile";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { withCriteriaDefaults } from "@/lib/matching";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";
import { employerHomePath, hasFullAccess } from "@/lib/team-roles";

export default async function EmployerApplicantsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const access = await getScopedEmployerAccess(session.userId);
  // A Panel member sees their candidates from Interviews.
  if (access?.role === "panel") redirect(employerHomePath("panel"));
  const profile = access?.profile ?? null;
  const fullAccess = !access || hasFullAccess(access.role);
  const [applications, addresses, teamMembers, responsiveness, waitingLong] = access
    ? await Promise.all([
        // A Hiring manager sees only their assigned postings' applicants.
        getApplicationsForEmployer(access.profile.id, access.scope),
        getEmployerAddresses(access.profile.id),
        getEmployerTeamMembers(access.profile.id, access.profile.userId),
        // Company-wide reply-time stats — Owners/Admins only.
        fullAccess ? getEmployerResponsiveness([access.profile.id]).then((map) => map.get(access.profile.id) ?? null) : null,
        fullAccess ? countApplicantsWaitingLong(access.profile.id) : 0,
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
      currentUserRole={authUser.position ?? null}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      responsiveness={responsiveness}
      waitingLong={waitingLong}
    />
  );
}

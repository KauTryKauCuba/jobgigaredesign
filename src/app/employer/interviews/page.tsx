import { redirect } from "next/navigation";
import EmployerInterviewsView from "@/components/EmployerInterviewsView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerTeamMembers } from "@/lib/employer-profile";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
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

  const access = await getScopedEmployerAccess(session.userId);
  const profile = access?.profile ?? null;
  // A Hiring manager: their postings' interviews plus any panel they're on.
  // A Panel member: only the interviews they're on — and they don't schedule.
  const canSchedule = access?.role !== "panel";
  const [applications, shortlisted, addresses, teamMembers] = access
    ? await Promise.all([
        getInterviewApplicationsForEmployer(access.profile.id, access.scope),
        canSchedule ? getShortlistedApplicationsForEmployer(access.profile.id, access.scope) : [],
        getEmployerAddresses(access.profile.id),
        getEmployerTeamMembers(access.profile.id, access.profile.userId),
      ])
    : [[], [], [], []];

  return (
    <EmployerInterviewsView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile?.id ?? "none"}
      authUser={authUser}
      applications={JSON.parse(JSON.stringify(applications))}
      shortlisted={JSON.parse(JSON.stringify(shortlisted))}
      addresses={JSON.parse(JSON.stringify(addresses))}
      currentUserRole={authUser.position ?? null}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      canSchedule={canSchedule}
    />
  );
}

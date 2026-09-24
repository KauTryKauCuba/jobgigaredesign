import { redirect } from "next/navigation";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerTeamView from "@/components/EmployerTeamView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerProfileForUser, getEmployerTeamActivity, getEmployerTeamMembers } from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerTeamPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getEmployerProfileForUser(session.userId)]);
  if (!authUser || !profile) redirect("/employer/onboarding");

  // profile.userId (the company's actual creator), not session.userId — an
  // invited Admin viewing Team first, for a pre-Team-table company that's
  // never self-healed yet, must not become that self-heal's "owner" row.
  const members = await getEmployerTeamMembers(profile.id, profile.userId);
  const activity = await getEmployerTeamActivity(profile.id);

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="team"
      heading="Team"
      subheading="Everyone with access to this company account."
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerTeamView
        key={profile.id}
        initialMembers={members}
        initialActivity={activity}
        currentUserId={session.userId}
      />
    </EmployerDashboardShell>
  );
}

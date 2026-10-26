import { redirect } from "next/navigation";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerTeamView from "@/components/EmployerTeamView";
import { getAuthUser } from "@/lib/auth-user";
import {
  getEmployerProfileForUser,
  getEmployerTeamActivity,
  getEmployerTeamMembers,
  redirectScopedTeammate,
} from "@/lib/employer-profile";
import { getMemberJobAssignments } from "@/lib/hiring-scope";
import { getJobPostingsForEmployer } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerTeamPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);
  // Managing the team is for Owners and Admins.
  await redirectScopedTeammate(session.userId);

  const [authUser, profile] = await Promise.all([getAuthUser(), getEmployerProfileForUser(session.userId)]);
  if (!authUser || !profile) redirect("/employer/onboarding");

  // profile.userId (the company's actual creator), not session.userId — an
  // invited Admin viewing Team first, for a pre-Team-table company that's
  // never self-healed yet, must not become that self-heal's "owner" row.
  const members = await getEmployerTeamMembers(profile.id, profile.userId);
  const [activity, assignments, postings] = await Promise.all([
    getEmployerTeamActivity(profile.id),
    getMemberJobAssignments(profile.id),
    getJobPostingsForEmployer(profile.id),
  ]);

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="team"
      heading="Team"
      subheading="Everyone with access to this company account, and what each of them can do."
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerTeamView
        key={profile.id}
        initialMembers={members}
        initialActivity={activity}
        initialJobAssignments={Object.fromEntries(assignments)}
        jobPostings={postings.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
        currentUserId={session.userId}
        currentUserRole={authUser.teamRole ?? "owner"}
        ownerPosition={profile.contactPosition}
      />
    </EmployerDashboardShell>
  );
}

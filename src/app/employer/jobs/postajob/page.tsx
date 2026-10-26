import { redirect } from "next/navigation";
import EmployerJobsView from "@/components/EmployerJobsView";
import { getAuthUser } from "@/lib/auth-user";
import {
  getEmployerAddresses,
  getEmployerProfileForUser,
  getEmployerTeamMembers,
  redirectScopedTeammate,
} from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerPostAJobPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");
  await redirectScopedTeammate(session.userId);

  const profile = await getEmployerProfileForUser(session.userId);
  const [addresses, team] = profile
    ? await Promise.all([getEmployerAddresses(profile.id), getEmployerTeamMembers(profile.id, profile.userId)])
    : [[], []];
  // Who can be shown as the posting's contact — active teammates only,
  // public details only (no email/phone reaches the page).
  const contactOptions = team
    .filter((m) => m.status === "active" && m.userId)
    .map((m) => ({
      userId: m.userId as string,
      name: m.name || m.email.split("@")[0],
      position: m.userId === profile?.userId ? (profile?.contactPosition ?? m.position) : m.position,
      avatarUrl: m.avatarUrl,
    }));
  // Who can be assigned as this posting's Hiring managers — anyone on the
  // team with that role, including invites not accepted yet.
  const hiringManagerOptions = team
    .filter((m) => m.role === "hiring_manager")
    .map((m) => ({
      teamMemberId: m.id,
      name: m.name || m.email,
      email: m.email,
      position: m.position,
      avatarUrl: m.avatarUrl,
      pending: m.status === "pending",
    }));

  // key forces a remount on company switch — see dashboard/page.tsx's comment.
  return (
    <EmployerJobsView
      key={profile?.id ?? "none"}
      authUser={authUser}
      mode="post"
      addresses={JSON.parse(JSON.stringify(addresses))}
      companyBenefits={profile?.benefits ?? []}
      contactOptions={contactOptions}
      hiringManagerOptions={hiringManagerOptions}
      company={profile ? { name: profile.companyName, logoUrl: profile.logoUrl } : null}
    />
  );
}

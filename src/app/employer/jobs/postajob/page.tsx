import { redirect } from "next/navigation";
import EmployerJobsView from "@/components/EmployerJobsView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerPostAJobPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  const addresses = profile ? await getEmployerAddresses(profile.id) : [];

  // key forces a remount on company switch — see dashboard/page.tsx's comment.
  return (
    <EmployerJobsView
      key={profile?.id ?? "none"}
      authUser={authUser}
      mode="post"
      addresses={JSON.parse(JSON.stringify(addresses))}
    />
  );
}

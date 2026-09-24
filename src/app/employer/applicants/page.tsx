import { redirect } from "next/navigation";
import EmployerApplicantsView from "@/components/EmployerApplicantsView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
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
  const [applications, addresses] = profile
    ? await Promise.all([getApplicationsForEmployer(profile.id), getEmployerAddresses(profile.id)])
    : [[], []];

  return (
    <EmployerApplicantsView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile?.id ?? "none"}
      authUser={authUser}
      applications={JSON.parse(JSON.stringify(applications))}
      initialSmartMatchEnabled={profile?.smartMatchEnabled ?? true}
      initialCriteria={withCriteriaDefaults(profile?.smartMatchCriteria)}
      addresses={JSON.parse(JSON.stringify(addresses))}
    />
  );
}

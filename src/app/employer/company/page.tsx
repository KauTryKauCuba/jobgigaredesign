import { redirect } from "next/navigation";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerCompanyPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getEmployerProfileForUser(session.userId)]);
  if (!authUser || !profile) redirect("/employer/onboarding");

  const addresses = await getEmployerAddresses(profile.id);

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="company"
      heading="Company Profile"
      subheading="Everything jobseekers see about your company."
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerOnboardingForm key={profile.id} mode="edit" initialProfile={profile} initialAddresses={addresses} only="company" />
    </EmployerDashboardShell>
  );
}

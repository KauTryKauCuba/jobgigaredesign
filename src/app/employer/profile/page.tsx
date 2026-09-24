import { redirect } from "next/navigation";
import AiUsageCard from "@/components/AiUsageCard";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import { getAiUsageByProviderForUser } from "@/lib/ai-usage";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerProfileForUser } from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile, aiUsage] = await Promise.all([
    getAuthUser(),
    getEmployerProfileForUser(session.userId),
    getAiUsageByProviderForUser(session.userId),
  ]);
  if (!authUser || !profile) redirect("/employer/onboarding");

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="profile"
      heading="My Profile"
      subheading="Your contact details on this account."
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerOnboardingForm
        key={profile.id}
        mode="edit"
        initialProfile={profile}
        only="contact"
        sidebarSlot={<AiUsageCard aiUsage={aiUsage} />}
      />
    </EmployerDashboardShell>
  );
}

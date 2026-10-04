import { redirect } from "next/navigation";
import AiUsageCard from "@/components/AiUsageCard";
import DeleteAccountCard from "@/components/DeleteAccountCard";
import DummyDataCard from "@/components/DummyDataCard";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import { getAiUsageByProviderForUser } from "@/lib/ai-usage";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { companyHasSampleData } from "@/lib/sample-data";
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

  const [addresses, hasDummyData] = await Promise.all([
    getEmployerAddresses(profile.id),
    companyHasSampleData(profile.id),
  ]);

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
        initialAddresses={addresses}
        only="contact"
        sidebarSlot={
          <div className="flex flex-col gap-[20px]">
            <AiUsageCard aiUsage={aiUsage} />
            <DeleteAccountCard email={authUser.email} />
            <DummyDataCard key={profile.id} initialHasDummyData={hasDummyData} />
          </div>
        }
      />
    </EmployerDashboardShell>
  );
}

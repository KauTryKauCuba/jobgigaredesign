import { redirect } from "next/navigation";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import MyRewardsList from "@/components/MyRewardsList";
import { getAuthUser } from "@/lib/auth-user";
import { listUserRewards } from "@/lib/campaigns";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

// Rewards belong to the person, not the company — so every team role can open it.
export default async function EmployerRewardsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const rewards = await listUserRewards(session.userId, "employer");

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="rewards"
      heading="My Rewards"
      subheading="Vouchers and lucky draw entries you've earned on JobGiga."
    >
      <MyRewardsList rewards={rewards} accent="teal" />
    </EmployerDashboardShell>
  );
}

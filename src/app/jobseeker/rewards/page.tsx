import { redirect } from "next/navigation";
import JobseekerDashboardShell from "@/components/JobseekerDashboardShell";
import MyRewardsList from "@/components/MyRewardsList";
import { getAuthUser } from "@/lib/auth-user";
import { listUserRewards } from "@/lib/campaigns";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function JobseekerRewardsPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker/onboarding");

  const rewards = await listUserRewards(session.userId, "jobseeker");
  const resume = profile.resumeFileName ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize } : null;

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="rewards"
      heading="My Rewards"
      subheading="Vouchers and lucky draw entries you've earned on JobGiga."
      resume={resume}
    >
      <MyRewardsList rewards={rewards} accent="gold" />
    </JobseekerDashboardShell>
  );
}

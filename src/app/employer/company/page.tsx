import Link from "next/link";
import { redirect } from "next/navigation";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import { getAuthUser } from "@/lib/auth-user";
import { getEarnedBadges, type BadgeKey } from "@/lib/badges";
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

  const [addresses, earnedBadges] = await Promise.all([
    getEmployerAddresses(profile.id),
    getEarnedBadges(profile.id),
  ]);
  const earnedBadgeMap = Object.fromEntries(earnedBadges.map((b) => [b.key, b.earnedAt])) as Record<
    BadgeKey,
    Date | undefined
  >;

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="company"
      heading="Company Profile"
      subheading="Everything jobseekers see about your company."
      headerAction={
        // A new tab, so unsaved edits on this form aren't lost.
        <Link
          href={`/companies/${profile.id}`}
          target="_blank"
          rel="noopener"
          className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark px-[22px] text-sm text-white transition-opacity hover:opacity-90"
        >
          View profile ↗
        </Link>
      }
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerOnboardingForm
        key={profile.id}
        mode="edit"
        initialProfile={profile}
        initialAddresses={addresses}
        only="company"
        earnedBadges={earnedBadgeMap}
      />
    </EmployerDashboardShell>
  );
}

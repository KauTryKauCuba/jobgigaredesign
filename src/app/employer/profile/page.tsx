import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import EmployerMemberProfileForm from "@/components/EmployerMemberProfileForm";
import { db } from "@/lib/db";
import { employerTeamMembers, users } from "@/lib/db/schema";
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
import { getInitialPhoneStatus } from "@/lib/phone-verification";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/team-roles";

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

  const [addresses, hasDummyData, initialPhoneStatus] = await Promise.all([
    getEmployerAddresses(profile.id),
    companyHasSampleData(profile.id),
    // So the phone field shows "verified" on its first frame, not after loading.
    getInitialPhoneStatus(session, profile.contactPhone),
  ]);

  const sidebar = (
    <div className="flex flex-col gap-[20px]">
      <AiUsageCard aiUsage={aiUsage} />
      <DeleteAccountCard email={authUser.email} />
      {/* Sample data fills the company's own jobs/team — Owners and Admins only. */}
      {hasFullAccess(authUser.teamRole ?? "owner") && (
        <DummyDataCard key={profile.id} initialHasDummyData={hasDummyData} />
      )}
    </div>
  );

  // The company's contact details (name, photo, phone…) belong to whoever
  // registered it. An invited teammate gets their own details instead —
  // never a form that would show, or overwrite, the registrant's.
  if (profile.userId !== session.userId) {
    const [[account], [membership]] = await Promise.all([
      db.select({ name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, session.userId)).limit(1),
      db
        .select({
          position: employerTeamMembers.position,
          hiringRole: employerTeamMembers.hiringRole,
          phone: employerTeamMembers.phone,
        })
        .from(employerTeamMembers)
        .where(and(eq(employerTeamMembers.employerProfileId, profile.id), eq(employerTeamMembers.userId, session.userId)))
        .limit(1),
    ]);
    return (
      <EmployerDashboardShell
        authUser={authUser}
        active="profile"
        heading="My Profile"
        subheading="Your contact details on this account."
      >
        <EmployerMemberProfileForm
          key={profile.id}
          initialName={account?.name ?? ""}
          initialAvatarUrl={account?.avatarUrl ?? null}
          initialPosition={membership?.position ?? null}
          initialHiringRole={membership?.hiringRole ?? null}
          initialPhone={membership?.phone ?? null}
          email={authUser.email}
          companyName={profile.companyName}
          teamRole={authUser.teamRole ?? "admin"}
          sidebarSlot={sidebar}
        />
      </EmployerDashboardShell>
    );
  }

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
        sidebarSlot={sidebar}
        initialPhoneStatus={initialPhoneStatus}
      />
    </EmployerDashboardShell>
  );
}

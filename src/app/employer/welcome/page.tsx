import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import EmployerMemberProfileForm from "@/components/EmployerMemberProfileForm";
import EmployerOnboardingBadges from "@/components/EmployerOnboardingBadges";
import { gradientFrameClass } from "@/components/formStyles";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { employerTeamMembers, users } from "@/lib/db/schema";
import { getActorLabel, getEmployerAccess, getEmployerAddresses } from "@/lib/employer-profile";
import { defaultJobAddress } from "@/lib/job-address";
import { getSession } from "@/lib/session";
import { TEAM_ROLE_LABEL, TEAM_ROLE_PILL, type TeamRole } from "@/lib/team-roles";

const WELCOME_ROLE_NOTE: Record<TeamRole, string> = {
  owner: "As an Owner you can post jobs, manage applicants and interviews, and manage the team — including other owners.",
  admin: "As an Admin you can post jobs, manage applicants and interviews, and invite teammates.",
  hiring_manager:
    "As a Hiring manager you'll see the jobs you're assigned to — review and move their applicants, join their interviews, and get notified when someone applies.",
  panel:
    "As a Panel member you'll see the interviews you're added to — the candidate, the time and place — and submit your evaluation afterwards.",
};

// The one-step onboarding for an invited teammate, right after they join a
// company: just "About you" (photo, name, position). getOnboardingRedirect
// sends them here until it's done; the company's registrant never sees it.
export default async function EmployerWelcomePage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const access = await getEmployerAccess(session.userId);
  if (!access) redirect("/employer/onboarding");
  if (access.profile.userId === session.userId) redirect("/employer/dashboard");

  const [authUser, [account], [membership]] = await Promise.all([
    getAuthUser(),
    db.select({ name: users.name, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, session.userId)).limit(1),
    db
      .select({
        position: employerTeamMembers.position,
        hiringRole: employerTeamMembers.hiringRole,
        phone: employerTeamMembers.phone,
        profileCompletedAt: employerTeamMembers.profileCompletedAt,
        invitedByUserId: employerTeamMembers.invitedByUserId,
      })
      .from(employerTeamMembers)
      .where(and(eq(employerTeamMembers.employerProfileId, access.profile.id), eq(employerTeamMembers.userId, session.userId)))
      .limit(1),
  ]);
  if (!authUser) redirect("/employer");
  if (!membership || membership.profileCompletedAt) redirect("/employer/dashboard");

  // For the "Your invite" card: who sent it and where the company is based.
  const [inviterName, addresses] = await Promise.all([
    membership.invitedByUserId ? getActorLabel(membership.invitedByUserId) : Promise.resolve(null),
    getEmployerAddresses(access.profile.id),
  ]);
  const mainAddress = defaultJobAddress(addresses) ?? addresses[0];
  const location = mainAddress ? `${mainAddress.city}, ${mainAddress.state}` : null;

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
      <Navbar initialUser={authUser} onboarding />
      <div className="relative">
        <EmployerOnboardingBadges />
        <Hero
          showRoleToggle={false}
          heading={
            <>
              Welcome to
              <br />
              {access.profile.companyName}.
            </>
          }
          subheadingClassName="mb-[40px]"
          subheading="One quick step, then you're in."
          belowNav={
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] text-left xl:flex-row xl:items-start">
              {/* Which team they've just joined, and who invited them. */}
              <div className={`animate-fade-in-up ${gradientFrameClass("teal")} min-w-0 xl:sticky xl:top-[22px] xl:flex-[1]`}>
                <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
                  <p className="text-xs text-[#9AA3B2]">Your invite</p>
                  <div className="mt-[12px] flex items-center gap-[12px]">
                    {access.profile.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={access.profile.logoUrl}
                        alt=""
                        className="h-[52px] w-[52px] shrink-0 rounded-[12px] border border-black/[0.06] bg-white object-contain"
                      />
                    ) : (
                      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] bg-brand-teal-soft text-xl text-brand-teal-dark">
                        {access.profile.companyName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#141B2E]">{access.profile.companyName}</p>
                      <p className="text-xs leading-[16px] text-[#4B5468]">
                        {[access.profile.industry, `${access.profile.companySize} employees`].join(" · ")}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-[16px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px] text-sm">
                    {inviterName && (
                      <div className="flex items-start justify-between gap-[12px]">
                        <dt className="text-[#9AA3B2]">Invited by</dt>
                        <dd className="text-right text-[#141B2E]">{inviterName}</dd>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-[12px]">
                      <dt className="text-[#9AA3B2]">Your role</dt>
                      <dd>
                        <span
                          className={`rounded-full px-[9px] py-[2px] text-xs ${TEAM_ROLE_PILL[access.role].bg} ${TEAM_ROLE_PILL[access.role].text}`}
                        >
                          {TEAM_ROLE_LABEL[access.role]}
                        </span>
                      </dd>
                    </div>
                    {location && (
                      <div className="flex items-start justify-between gap-[12px]">
                        <dt className="text-[#9AA3B2]">Based in</dt>
                        <dd className="text-right text-[#141B2E]">{location}</dd>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-[12px]">
                      <dt className="text-[#9AA3B2]">Main contact</dt>
                      <dd className="text-right text-[#141B2E]">{access.profile.contactName}</dd>
                    </div>
                  </dl>

                  <p className="mt-[14px] rounded-[12px] bg-[#F8FAFB] p-[10px] text-xs leading-[18px] text-[#4B5468]">
                    {WELCOME_ROLE_NOTE[access.role]}
                  </p>
                </div>
              </div>

              {/* Same 1 : 2 : 1 widths as company onboarding: invite, About you, checklist. */}
              <EmployerMemberProfileForm
                mode="welcome"
                key={access.profile.id}
                initialName={account?.name ?? ""}
                initialAvatarUrl={account?.avatarUrl ?? null}
                initialPosition={membership.position}
                initialHiringRole={membership.hiringRole}
                initialPhone={membership.phone}
                email={authUser.email}
                companyName={access.profile.companyName}
                teamRole={access.role}
              />
            </div>
          }
        />
      </div>
    </main>
  );
}

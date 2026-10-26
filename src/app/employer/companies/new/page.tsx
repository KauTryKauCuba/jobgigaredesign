import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import EmployerOnboardingBadges from "@/components/EmployerOnboardingBadges";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import { gradientFrameClass } from "@/components/formStyles";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import { getAuthUser } from "@/lib/auth-user";
import { getCompanyLimitInfo } from "@/lib/company-limit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getEmployerAccess, getOwnedEmployerProfiles } from "@/lib/employer-profile";
import type { CONTACT_ROLES } from "@/lib/positions";
import { getInitialPhoneStatus } from "@/lib/phone-verification";
import { getSession } from "@/lib/session";

/**
 * "Add a company" — an existing employer registering another company, up to
 * their company limit (src/lib/company-limit.ts). Same form as company
 * onboarding, with "About you" prefilled from the company they registered
 * (the current one if they registered it, else their first), and the new
 * company becomes the selected one once saved.
 */
export default async function AddCompanyPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const [authUser, access, owned, limitInfo, [account]] = await Promise.all([
    getAuthUser(),
    getEmployerAccess(session.userId),
    getOwnedEmployerProfiles(session.userId),
    getCompanyLimitInfo(session.userId),
    db.select({ name: users.name, email: users.email, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, session.userId)).limit(1),
  ]);
  // Someone with no company at all belongs in first-time onboarding.
  if (!access) redirect("/employer/onboarding");

  const source = access.profile.userId === session.userId ? access.profile : owned[0];
  const aboutYou = source
    ? {
        avatarUrl: source.avatarUrl,
        contactName: source.contactName,
        contactRole: source.contactRole as (typeof CONTACT_ROLES)[number],
        contactPosition: source.contactPosition,
        contactPhone: source.contactPhone,
        contactEmail: source.contactEmail,
      }
    : { avatarUrl: account?.avatarUrl ?? null, contactName: account?.name ?? "", contactEmail: account?.email ?? "" };
  // So the phone field shows "verified" on its first frame, not after loading.
  const initialPhoneStatus = await getInitialPhoneStatus(session, "contactPhone" in aboutYou ? aboutYou.contactPhone : null);

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
      <Navbar initialUser={authUser} />
      <div className="relative">
        <EmployerOnboardingBadges />
        <Hero
          showRoleToggle={false}
          // Same headline gradient as the employer landing page.
          headingGradient="var(--brand-gradient-employer)"
          heading={
            <>
              Add another company,
              <br />
              in seconds.
            </>
          }
          subheadingClassName="mb-[64px]"
          subheading={
            limitInfo.canAdd ? (
              <>
                Same as before — type the company name and let AI fill in the details. You&rsquo;ll be its owner,
                and can switch between companies anytime ({limitInfo.used} of {limitInfo.limit} used).
              </>
            ) : (
              <>You&rsquo;ve registered {limitInfo.used} companies, your limit.</>
            )
          }
          belowNav={
            limitInfo.canAdd ? (
              <EmployerOnboardingForm createNew initialDraft={aboutYou} initialPhoneStatus={initialPhoneStatus} />
            ) : (
              <div className={`mx-auto w-full max-w-[460px] text-left ${gradientFrameClass("teal")}`}>
                <div className="rounded-[19px] bg-white p-[22px] text-center sm:p-[28px]">
                  <p className="text-sm leading-[20px] text-[#4B5468]">
                    You&rsquo;ve reached your limit of {limitInfo.limit} companies. Contact JobGiga if you need to add
                    more.
                  </p>
                  <Link
                    href="/employer/dashboard"
                    className="mt-[20px] flex h-[44px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                  >
                    Back to dashboard
                  </Link>
                </div>
              </div>
            )
          }
        />
      </div>
    </main>
  );
}

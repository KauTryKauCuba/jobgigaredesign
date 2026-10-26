import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { employerOnboardingDrafts, users } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getInitialPhoneStatus } from "@/lib/phone-verification";
import { getSession } from "@/lib/session";
import { DraftNameProvider } from "@/components/DraftNameContext";
import EmployerOnboardingBadges from "@/components/EmployerOnboardingBadges";
import EmployerOnboardingForm from "@/components/EmployerOnboardingForm";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";

export default async function EmployerOnboardingPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  // Redirects away for an owner (already has a company) and, same as an
  // owner, for an invited team member — they already belong to a company
  // too, just not one they created themselves, and should never see the
  // "set up your company" onboarding flow.
  const [access, authUser, draftRow, account] = await Promise.all([
    getEmployerAccess(session.userId),
    getAuthUser(),
    db
      .select({ data: employerOnboardingDrafts.data })
      .from(employerOnboardingDrafts)
      .where(eq(employerOnboardingDrafts.userId, session.userId))
      .limit(1)
      .then(([row]) => row),
    // The Google account's own photo — what the form starts with. Not
    // authUser.avatarUrl: mid-onboarding that's the draft's photo (see resolveAvatarUrl).
    db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)
      .then(([row]) => row),
  ]);
  if (access) redirect("/employer");
  // So the phone field shows "verified" on its first frame, not after loading.
  const initialPhoneStatus = await getInitialPhoneStatus(
    session,
    (draftRow?.data as { contactPhone?: string } | undefined)?.contactPhone,
  );

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
      <DraftNameProvider>
        <Navbar initialUser={authUser} onboarding />
        <div className="relative">
          <EmployerOnboardingBadges />
          <Hero
            belowNav={
              <EmployerOnboardingForm
                initialAvatarUrl={account?.avatarUrl ?? null}
                initialContactEmail={authUser?.email}
                initialDraft={draftRow?.data ?? null}
                initialPhoneStatus={initialPhoneStatus}
              />
            }
            showRoleToggle={false}
            // Same headline gradient as the employer landing page.
            headingGradient="var(--brand-gradient-employer)"
            heading={
              <>
                Set up your company,
                <br />
                in seconds.
              </>
            }
            subheadingClassName="mb-[64px]"
            subheading={
              <>
                Type your company name and let AI fill in the details from public
                sources. Don&rsquo;t love what it finds? Hit reset and regenerate
                anytime — you&rsquo;re always in control.
              </>
            }
          />
        </div>
      </DraftNameProvider>
    </main>
  );
}

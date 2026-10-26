import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { jobseekerOnboardingDrafts, jobseekerProfiles, users } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth-user";
import { getInitialPhoneStatus } from "@/lib/phone-verification";
import { getSession } from "@/lib/session";
import { DraftNameProvider } from "@/components/DraftNameContext";
import Hero from "@/components/Hero";
import JobseekerOnboardingBadges from "@/components/JobseekerOnboardingBadges";
import Navbar from "@/components/Navbar";
import OnboardingForm from "@/components/OnboardingForm";

export default async function JobseekerOnboardingPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const [profile, authUser, draftRow, account] = await Promise.all([
    db
      .select({ id: jobseekerProfiles.id })
      .from(jobseekerProfiles)
      .where(eq(jobseekerProfiles.userId, session.userId))
      .limit(1)
      .then(([row]) => row),
    getAuthUser(),
    db
      .select({ data: jobseekerOnboardingDrafts.data })
      .from(jobseekerOnboardingDrafts)
      .where(eq(jobseekerOnboardingDrafts.userId, session.userId))
      .limit(1)
      .then(([row]) => row),
    // The Google account's own photo — what the form starts with and what
    // Reset goes back to. Not authUser.avatarUrl: mid-onboarding that's the
    // draft's photo (see resolveAvatarUrl).
    db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)
      .then(([row]) => row),
  ]);
  if (profile) redirect("/jobseeker");
  // So the phone field shows "verified" on its first frame, not after loading.
  const initialPhoneStatus = await getInitialPhoneStatus(session, (draftRow?.data as { phone?: string } | undefined)?.phone);

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-gold-page pb-[92px]">
      <DraftNameProvider>
        <Navbar initialUser={authUser} onboarding />
        <div className="relative">
          <JobseekerOnboardingBadges />
          <Hero
            belowNav={
              <OnboardingForm
                accountEmail={authUser?.email}
                initialAvatarUrl={account?.avatarUrl ?? null}
                initialDraft={draftRow?.data ?? null}
                initialPhoneStatus={initialPhoneStatus}
              />
            }
            showRoleToggle={false}
            // Same headline gradient as the jobseeker landing page.
            headingGradient="var(--brand-gradient-jobseeker)"
            heading={
              <>
                Build your profile,
                <br />
                in seconds.
              </>
            }
            subheadingClassName="mb-[64px]"
            subheading={
              <>
                Upload your resume and let AI fill in the details — skills,
                experience, and more. Don&rsquo;t love what it finds? Reset and
                try again, or fill it in yourself.
              </>
            }
          />
        </div>
      </DraftNameProvider>
    </main>
  );
}

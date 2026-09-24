import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { jobseekerProfiles } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth-user";
import { getSession } from "@/lib/session";
import { DraftNameProvider } from "@/components/DraftNameContext";
import Hero from "@/components/Hero";
import JobseekerOnboardingBadges from "@/components/JobseekerOnboardingBadges";
import Navbar from "@/components/Navbar";
import OnboardingForm from "@/components/OnboardingForm";

export default async function JobseekerOnboardingPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const [profile, authUser] = await Promise.all([
    db
      .select({ id: jobseekerProfiles.id })
      .from(jobseekerProfiles)
      .where(eq(jobseekerProfiles.userId, session.userId))
      .limit(1)
      .then(([row]) => row),
    getAuthUser(),
  ]);
  if (profile) redirect("/jobseeker");

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#FDFAF0] pb-[92px]">
      <DraftNameProvider>
        <Navbar initialUser={authUser} onboarding />
        <div className="relative">
          <JobseekerOnboardingBadges />
          <Hero
            belowNav={<OnboardingForm />}
            showRoleToggle={false}
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

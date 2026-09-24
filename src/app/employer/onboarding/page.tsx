import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAccess } from "@/lib/employer-profile";
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
  const [access, authUser] = await Promise.all([getEmployerAccess(session.userId), getAuthUser()]);
  if (access) redirect("/employer");

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#F2FAF5] pb-[92px]">
      <DraftNameProvider>
        <Navbar initialUser={authUser} onboarding />
        <div className="relative">
          <EmployerOnboardingBadges />
          <Hero
            belowNav={<EmployerOnboardingForm />}
            showRoleToggle={false}
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

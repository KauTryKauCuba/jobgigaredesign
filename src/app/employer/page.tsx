import { redirect } from "next/navigation";
import AnimatedRibbon from "@/components/AnimatedRibbon";
import CompanyHighlights from "@/components/CompanyHighlights";
import EmployerAssistantCard from "@/components/EmployerAssistantCard";
import EmployerFloatingBadges from "@/components/EmployerFloatingBadges";
import EmployerInterviewCard from "@/components/EmployerInterviewCard";
import EmployerJobPostCard from "@/components/EmployerJobPostCard";
import EmployerManageJobCard from "@/components/EmployerManageJobCard";
import FloatingDemoWidget from "@/components/FloatingDemoWidget";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HiringStats from "@/components/HiringStats";
import Navbar from "@/components/Navbar";
import { getAuthUser } from "@/lib/auth-user";
import {
  getEmployersWithPostings,
  getLatestActivePostings,
  getLatestShortlistAndInterviewActivity,
} from "@/lib/employer-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";

export default async function EmployerPage() {
  const [onboardingRedirect, authUser, hiringCompanies, highlightCompanies, latestPostings, latestActivity] =
    await Promise.all([
      getOnboardingRedirect(),
      getAuthUser(),
      getEmployersWithPostings(5),
      getEmployersWithPostings(6),
      getLatestActivePostings(5),
      getLatestShortlistAndInterviewActivity(5),
    ]);
  if (onboardingRedirect) redirect(onboardingRedirect);

  // This is the public marketing page — like "/jobseeker", it never
  // auto-redirects a signed-in visitor away. The "Employer" toggle above is
  // a "preview this view" control, not a "take me to my area" shortcut; the
  // navbar's own "Dashboard" button (and the post-sign-in redirect) are what
  // actually take an employer to "/employer/dashboard".

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-[#F2FAF5] pb-[92px]">
      <Navbar initialUser={authUser} hideProfileLinks />
      <Hero
        heading={
          <>
            Go beyond the summit
            <br />
            of traditional job platforms.
          </>
        }
        subheading="Let AI do the work. Let your human touch make the difference."
        overlay={<EmployerFloatingBadges />}
        belowNav={
          <HiringStats
            hiringCompanies={JSON.parse(JSON.stringify(hiringCompanies))}
            latestPostings={JSON.parse(JSON.stringify(latestPostings))}
            latestActivity={JSON.parse(JSON.stringify(latestActivity))}
            isSignedInEmployer={authUser?.role === "employer"}
          />
        }
      />
      <AnimatedRibbon />
      <CompanyHighlights realCompanies={JSON.parse(JSON.stringify(highlightCompanies))} />
      <EmployerAssistantCard />
      <EmployerJobPostCard />
      <EmployerManageJobCard />
      <EmployerInterviewCard />
      <Footer accent="teal" />
      {/* Clipped to its top half and pulled down past the floating-chat
          clearance (-mb cancels the <main> padding reserved for it) so the
          ribbon reads as bleeding off the bottom edge, same treatment as the
          employer dashboard shell. */}
      <div className="-mb-[92px] h-[80px] overflow-hidden bg-white sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon />
      </div>
      {/* FloatingDemoWidget is fixed to the viewport bottom, like the navbar
          pinned to the top — it renders here for source order, not layout. */}
      <FloatingDemoWidget />
    </main>
  );
}

import AnimatedRibbon from "@/components/AnimatedRibbon";
import CompanyAdsSection from "@/components/CompanyAdsSection";
import CompanyHighlights from "@/components/CompanyHighlights";
import EmployerAssistantCard from "@/components/EmployerAssistantCard";
import EmployerFloatingBadges from "@/components/EmployerFloatingBadges";
import EmployerInterviewCard from "@/components/EmployerInterviewCard";
import EmployerJobPostCard from "@/components/EmployerJobPostCard";
import EmployerManageJobCard from "@/components/EmployerManageJobCard";
import EmployerPosterCard from "@/components/EmployerPosterCard";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HiringStats from "@/components/HiringStats";
import Navbar from "@/components/Navbar";
import ScrollWidthBackground from "@/components/ScrollWidthBackground";
import WelcomeModal from "@/components/WelcomeModal";
import { getAuthUser } from "@/lib/auth-user";
import {
  getPublicEmployersWithPostings,
  getPublicLatestActivePostings,
  getPublicLatestActivity,
  getPublicLiveCompanyAds,
  getPublicWelcomeImageUrl,
} from "@/lib/public-data";

export default async function EmployerPage() {
  const [
    authUser,
    hiringCompanies,
    highlightCompanies,
    latestPostings,
    latestActivity,
    companyAds,
    welcomeImage,
  ] = await Promise.all([
    getAuthUser(),
    getPublicEmployersWithPostings(5),
    getPublicEmployersWithPostings(6),
    getPublicLatestActivePostings(5),
    getPublicLatestActivity(5),
    getPublicLiveCompanyAds(),
    getPublicWelcomeImageUrl("employer"),
  ]);
  // This is the public marketing page — it never auto-redirects a signed-in
  // visitor away, not even one still in onboarding (the navbar logo brings
  // them here, and onboarding is one click back). The "Employer" toggle above is
  // a "preview this view" control, not a "take me to my area" shortcut; the
  // navbar's own "Dashboard" button (and the post-sign-in redirect) are what
  // actually take an employer to "/employer/dashboard".

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-brand-teal-page">
      <Navbar initialUser={authUser} hideProfileLinks />
      {!authUser && <WelcomeModal role="employer" image={welcomeImage} />}
      <Hero
        heading={
          <>
            Go beyond the summit
            <br />
            of traditional job platforms.
          </>
        }
        subheading="Let AI do the work. Let your human touch make the difference."
        // The employer AI gradient (teal into gold), ending on a deeper gold
        // than the buttons' pale #FFE9A6 so the text stays readable.
        // (Defined in globals.css; a site theme can replace it.)
        headingGradient="var(--brand-gradient-employer)"
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
      {/* Same band as the "Write jobs with AI" and "Interview your way" sections. */}
      <ScrollWidthBackground
        color="var(--band-employer)"
        fadeEdges
        startWidth={45}
        durationMs={1400}
        gradient="var(--band-gradient-employer)"
        // Stock placeholder (Pexels) — trying out a video background here.
        video={{ src: "/videos/spotlight-bg.mp4", poster: "/videos/spotlight-bg-poster.jpg" }}
      >
        <CompanyAdsSection
          ads={JSON.parse(JSON.stringify(companyAds))}
          className="shell relative z-[1] py-[clamp(56px,9vh,96px)]"
        />
      </ScrollWidthBackground>
      <EmployerAssistantCard />
      <EmployerJobPostCard />
      <EmployerManageJobCard />
      <EmployerInterviewCard />
      <EmployerPosterCard />
      <Footer accent="teal" />
      {/* Clipped to its top half so the ribbon reads as bleeding off the
          bottom edge, same treatment as the employer dashboard shell. */}
      <div className="h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon />
      </div>
    </main>
  );
}

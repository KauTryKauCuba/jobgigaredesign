import type { Metadata } from "next";
import AnimatedRibbon from "@/components/AnimatedRibbon";
import CompanyDirectoryView from "@/components/CompanyDirectoryView";
import CompanyHighlights from "@/components/CompanyHighlights";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { getAuthUser } from "@/lib/auth-user";
import { getCompanyDirectory } from "@/lib/company-directory";
import { getEmployersWithPostings } from "@/lib/employer-profile";

export const metadata: Metadata = {
  title: "Find companies · JobGiga",
  description: "Browse companies hiring on JobGiga — see what they do and their open roles.",
};

// Public — anyone (signed in or not, employer or jobseeker) can browse.
export default async function CompaniesPage() {
  const [authUser, companies, highlightCompanies] = await Promise.all([
    getAuthUser(),
    getCompanyDirectory(),
    getEmployersWithPostings(6),
  ]);
  const accent = authUser?.role === "jobseeker" ? "jobseeker" : "employer";

  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip pb-[92px] ${accent === "jobseeker" ? "bg-[#FDFAF0]" : "bg-[#F2FAF5]"}`}>
      <Navbar initialUser={authUser} pageRole={accent} />
      <div className="shell pt-[24px]">
        {/* The employer landing page's "Who's hiring" row, as a showcase above the full directory. */}
        <CompanyHighlights variant="page" realCompanies={JSON.parse(JSON.stringify(highlightCompanies))} />
        {/* Above the showcase row, on the page's own background, so its cards
            tuck in behind this whole section as the page scrolls. */}
        <div className={`relative z-[2] pt-[32px] ${accent === "jobseeker" ? "bg-[#FDFAF0]" : "bg-[#F2FAF5]"}`}>
          {/* Soft top edge, so the cards fade out as they slide under rather than being cut off by a hard line. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 -top-[48px] h-[48px] bg-gradient-to-b from-transparent ${
              accent === "jobseeker" ? "to-[#FDFAF0]" : "to-[#F2FAF5]"
            }`}
          />
          <h1 className="text-xl font-sans font-semibold text-[#141B2E]" style={{ lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Find companies
          </h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Every company on JobGiga — see what they do, where they are, and who&rsquo;s hiring right now.
          </p>
          <div className="mt-[24px]">
            <CompanyDirectoryView companies={JSON.parse(JSON.stringify(companies))} />
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="mt-[48px]">
        <Footer accent={accent === "jobseeker" ? "gold" : "teal"} />
      </div>
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon accent={accent === "jobseeker" ? "gold" : "teal"} />
      </div>
    </main>
  );
}

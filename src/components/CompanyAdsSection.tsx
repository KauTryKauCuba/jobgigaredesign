import type { CompanyAdCardData } from "./CompanyAdCard";
import CompanyAdsCarousel from "./CompanyAdsCarousel";
import { sampleCompanyAdFill } from "@/lib/sample-company-ads";

/**
 * The employer landing page's company advertisements — each company's one
 * superadmin-approved ad (image or short video), uploaded from the
 * dashboard's Advertisement page. Real ads come first; sample ads for the
 * same curated showcase companies as "Who's hiring" fill the rest of the 10
 * slots, and drop out one by one as real ads are approved (see sampleCompanyAdFill).
 * Shown as a one-row carousel with the middle ad enlarged.
 */
export default function CompanyAdsSection({
  ads,
  className = "shell relative z-[1] -mt-[48px] pb-[112px]",
  startIndex,
  autoAdvance,
}: {
  ads: (CompanyAdCardData & { id: string })[];
  // The employer's "Preview on the employer page" renders this same section
  // in a dialog — different spacing, starting on their ad, not moving.
  className?: string;
  startIndex?: number;
  autoAdvance?: boolean;
}) {
  const samples = sampleCompanyAdFill(
    ads.length,
    ads.map((a) => a.companyName),
  );
  const cards = [...ads, ...samples];
  if (cards.length === 0) return null;

  return (
    <section className={className}>
      <div className="mx-auto text-center">
        {/* A block wrapper, not just the inline-flex span itself — otherwise
            it shares a text line with the h2 below (which has to be
            display:inline-block for the gradient-clip trick, so it no longer
            forces its own line the way a plain block heading would), and the
            two end up centered together as one group instead of each on its
            own row. */}
        <div>
          <span className="inline-flex items-center rounded-full bg-brand-teal-soft px-[14px] py-[7px] text-xs text-brand-teal-dark">
            Company spotlight
          </span>
        </div>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{
            fontSize: "clamp(34px, 4vw, 56px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            // Same size and teal-into-gold gradient as the employer landing
            // page's own hero heading and the "Companies building their
            // teams..." row above it — one family of headings down the page.
            backgroundImage: "var(--brand-gradient-employer)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            display: "inline-block",
            paddingBottom: "0.08em",
          }}
        >
          See what companies on
          <br />
          JobGiga are building
        </h2>
      </div>

      <CompanyAdsCarousel ads={cards} startIndex={startIndex} autoAdvance={autoAdvance} />
    </section>
  );
}

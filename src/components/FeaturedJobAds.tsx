"use client";

import AdCarousel from "./AdCarousel";
import JobAdCard, { JOB_AD_STRIP_HEIGHT, type JobAdCardData } from "./JobAdCard";
import ScrollWidthBackground from "./ScrollWidthBackground";

// The middle card's width; it's that plus the details strip tall.
const STAGE_WIDTH = "min(320px, 70vw)";

// `selectable: false` — a sample ad whose sample listing isn't on the page, so there's nothing to open.
export type FeaturedJobAd = JobAdCardData & { id: string; jobPostingId: string; selectable?: boolean };

/**
 * The jobseeker page's featured jobs — superadmin-approved job posting ads,
 * booked from the employer's Advertisement page, with sample ads filling the
 * slots real ones don't use. The same carousel as the employer page's
 * Company spotlight (AdCarousel), full width with two main cards on wide
 * screens, square artwork and the jobseeker gold; picking a main card opens
 * that job in the details panel below.
 */
export default function FeaturedJobAds({
  ads,
  onSelect,
}: {
  ads: FeaturedJobAd[];
  onSelect: (jobPostingId: string) => void;
}) {
  if (ads.length === 0) return null;

  return (
    // Breaks out of the page's side padding so the band spans the full screen
    // width, like the employer page's Company spotlight.
    <div className="relative z-0 mt-[56px] ml-[calc(50%-50vw)] w-screen">
      <ScrollWidthBackground
        color="#F8EED6"
        fadeEdges
        startWidth={45}
        durationMs={1400}
        // The jobseeker gradient (gold into teal), softened.
        gradient="linear-gradient(120deg, #FBEFCF 0%, #F8EED6 45%, #DCEFEB 100%)"
        // Stock placeholder (Pexels) — trying out a video background here.
        video={{ src: "/videos/featured-jobs-bg.mp4", poster: "/videos/featured-jobs-bg-poster.jpg" }}
      >
        <section aria-label="Featured jobs" className="relative mx-auto w-full py-[clamp(56px,9vh,96px)]">
          {/* Same section heading as "Jobs posted on JobGiga" above — wider,
              so "Jobs promoted on JobGiga" fits on one line at this size. */}
          <div className="mx-auto max-w-[720px] text-center">
            {/* A block wrapper, not just the inline-flex span itself — the h2
                below is display:inline-block (needed for the gradient-clip
                trick), so without this the pill and heading can share a text
                line and get centered together as one group instead of each
                getting its own row. */}
            <div>
              <span className="inline-flex items-center rounded-full bg-brand-gold-soft px-[14px] py-[7px] text-xs text-brand-gold-dark">
                Featured jobs
              </span>
            </div>
            <h2
              className="mt-[16px] font-sans font-semibold text-[#141B2E]"
              style={{
                fontSize: "clamp(34px, 4vw, 56px)",
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                backgroundImage: "var(--brand-gradient-jobseeker)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                display: "inline-block",
                paddingBottom: "0.08em",
              }}
            >
              Jobs promoted on JobGiga
            </h2>
          </div>

          <AdCarousel
            items={ads}
            renderCard={(ad, active) => (
              <JobAdCard
                ad={ad}
                playing={active}
                onSelect={ad.selectable === false ? undefined : () => onSelect(ad.jobPostingId)}
              />
            )}
            dotLabel={(ad, i) => `Show featured job ${i + 1} of ${ads.length}: ${ad.jobTitle}`}
            stageWidth={STAGE_WIDTH}
            stageHeight={`calc(${STAGE_WIDTH} + ${JOB_AD_STRIP_HEIGHT}px)`}
            // Full width: two main cards, the rest spreading out to the screen
            // edges, with just a narrow fade at each edge — masked (no fade
            // colour), so the video band behind shows through.
            twoMain
            fadeWidth="12vw"
            activeDotClassName="bg-brand-gold-dark"
            className="mt-[56px]"
          />
        </section>
      </ScrollWidthBackground>
    </div>
  );
}

"use client";

import AdCarousel from "./AdCarousel";
import CompanyAdCard, { type CompanyAdCardData } from "./CompanyAdCard";

const STAGE_WIDTH = "min(640px, 78vw)";

/** The employer page's Company spotlight row — 16:9 company ads in the shared AdCarousel. */
export default function CompanyAdsCarousel({
  ads,
  startIndex = 0,
  autoAdvance = true,
}: {
  ads: (CompanyAdCardData & { id: string })[];
  // Which card starts in the middle, and whether it moves on by itself —
  // the employer's "Preview on the employer page" starts on their ad, still.
  startIndex?: number;
  autoAdvance?: boolean;
}) {
  return (
    <AdCarousel
      items={ads}
      renderCard={(ad, active) => <CompanyAdCard ad={ad} playing={active} />}
      dotLabel={(ad, i) => `Show ad ${i + 1} of ${ads.length}: ${ad.companyName}`}
      stageWidth={STAGE_WIDTH}
      stageHeight={`calc(${STAGE_WIDTH} * 9 / 16)`}
      // No fade colour: the side cards fade out by mask, over the gradient
      // band behind this section on the employer page.
      startIndex={startIndex}
      autoAdvance={autoAdvance}
    />
  );
}

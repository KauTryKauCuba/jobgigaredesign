"use client";

import { useEffect, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { gradientFrameClass } from "./formStyles";
import { getRevealOffset, getRevealStyle } from "@/lib/cardReveal";

type Company = {
  name: string;
  industry: string;
  // Illustrative for the curated companies below (they haven't posted on
  // JobGiga) — real for a company pulled from `realCompanies`.
  openRoles: number;
} & (
  | { logoKind: "image"; src: string; width?: number; height?: number }
  | { logoKind: "icon" }
);

export type HighlightCompany = {
  companyName: string;
  industry: string | null;
  location: string | null;
  logoUrl: string | null;
  activeCount: number;
  totalCount: number;
};

/**
 * One size/offset variant per card, matched by index to displayCompanies — not
 * literal Math.random() (that would reshuffle on every render/SSR pass and
 * risk a hydration mismatch), but a fixed, deliberately uneven set so the
 * row reads as a bento/skyline rather than a uniform grid. Negative offsets
 * push a card up (further tucked under AnimatedRibbon at rest); positive
 * offsets sit it lower (already clear of the ribbon).
 */
type SizeVariant = { logoBox: number; logoImg: number; padding: string; offset: number };
const SIZE_VARIANTS: SizeVariant[] = [
  { logoBox: 125, logoImg: 120, padding: "p-[22px]", offset: 0 },
  { logoBox: 88, logoImg: 84, padding: "p-[16px]", offset: 30 },
  { logoBox: 150, logoImg: 145, padding: "p-[26px]", offset: -20 },
  { logoBox: 100, logoImg: 96, padding: "p-[18px]", offset: 16 },
  { logoBox: 132, logoImg: 127, padding: "p-[24px]", offset: -8 },
  { logoBox: 92, logoImg: 88, padding: "p-[16px]", offset: 24 },
];

function PlaceholderLogo({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="7" width="14" height="9" rx="1.6" />
      <path d="M7 7V5.6C7 4.72 7.72 4 8.6 4h2.8c.88 0 1.6.72 1.6 1.6V7" />
    </svg>
  );
}

/**
 * Curated padding — real, verified outside companies (same set as
 * TrustedByStrip; WHALE/usewhale.io's mark pulled from its own site same as
 * the others — see that file's comment), used to fill out empty slots
 * `buildDisplayCompanies` below doesn't have a real JobGiga employer for.
 * "openRoles" is illustrative for every one of these.
 */
const CURATED_COMPANIES: Company[] = [
  {
    name: "aikido",
    industry: "Cybersecurity",
    openRoles: 8,
    logoKind: "image",
    src: "/logos/aikido.svg",
    width: 88,
    height: 20,
  },
  {
    name: "Bolt",
    industry: "Fintech",
    openRoles: 5,
    logoKind: "image",
    src: "/logos/bolt.jpg",
    width: 132,
    height: 64,
  },
  {
    name: "Parim",
    industry: "Workforce management",
    openRoles: 12,
    logoKind: "image",
    src: "/logos/parim.svg",
    width: 104,
    height: 32,
  },
  {
    name: "parcelly",
    industry: "Logistics",
    openRoles: 4,
    logoKind: "image",
    src: "/logos/parcelly.svg",
    width: 90,
    height: 31,
  },
  {
    name: "ParcelTracker",
    industry: "Business software",
    openRoles: 6,
    logoKind: "image",
    src: "/logos/parceltracker.svg",
    width: 168,
    height: 30,
  },
  {
    name: "WHALE",
    industry: "Process documentation software",
    openRoles: 7,
    logoKind: "image",
    src: "/logos/whale.svg",
    width: 104,
    height: 22,
  },
];

const MAX_CARDS = 6;

// Real employers replace curated ones one slot at a time (first real company
// bumps the last curated one, second bumps the second-to-last, etc.) instead
// of an all-or-nothing swap — so the row never suddenly looks sparse while
// the platform still has few real employers, but also never shows a curated
// placeholder next to five real companies once there are enough.
function buildDisplayCompanies(realCompanies: HighlightCompany[]): Company[] {
  const real: Company[] = realCompanies.slice(0, MAX_CARDS).map((c) => ({
    name: c.companyName,
    industry: c.industry ?? "—",
    openRoles: c.activeCount,
    ...(c.logoUrl ? { logoKind: "image" as const, src: c.logoUrl } : { logoKind: "icon" as const }),
  }));
  const curatedNeeded = MAX_CARDS - real.length;
  return [...real, ...CURATED_COMPANIES.slice(0, curatedNeeded)];
}

export default function CompanyHighlights({ realCompanies }: { realCompanies: HighlightCompany[] }) {
  const { ref, progress } = useScrollReveal();
  const displayCompanies = buildDisplayCompanies(realCompanies);

  // useScrollReveal freezes progress at 0 under prefers-reduced-motion —
  // the correct "do nothing" default for the hero badges' analogous hook
  // (0 = fully visible there), but the opposite of correct here (0 =
  // converged/hidden). Force these cards to their settled, fully-revealed
  // state instead of leaving them permanently collapsed near the ribbon for
  // those users.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);
  const revealProgress = reducedMotion ? 1 : progress;

  return (
    <div className="shell relative z-[1] -mt-[32px] pt-[clamp(32px,5vh,56px)] pb-[128px]">
      <div className="relative z-[1] mx-auto max-w-[560px] text-center">
        <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
          Who&apos;s hiring
        </span>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{ fontSize: "clamp(24px,2.6vw,32px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
        >
          Companies building their teams on JobGiga
        </h2>
      </div>

      {/*
        The section itself (above) sits -32px under AnimatedRibbon's tail —
        that's the sliver that reads as "tucked behind" the ribbon at rest.
        Each card then converges out of that spot into its grid position as
        the row scrolls into view — same eased dx/dy/scale/rotate/opacity
        mechanism as the hero's floating badges (see badgeStack.ts /
        cardReveal.ts), just run in reverse (expand-and-arrive instead of
        collapse-and-vanish) and driven by useScrollReveal rather than
        useScrollStack, since this row sits well below the fold instead of
        pinned at the top of the page — see that hook's comment for why.
      */}
      <div
        ref={ref}
        className="relative z-0 mt-[128px] grid grid-cols-2 items-start gap-[12px] sm:grid-cols-3 lg:grid-cols-6"
      >
        {displayCompanies.map((company, i) => {
          const variant = SIZE_VARIANTS[i];
          const revealStyle = getRevealStyle(revealProgress, getRevealOffset(i));
          return (
            <div key={company.name} style={{ transform: `translateY(${variant.offset}px)` }}>
              <div className="will-change-transform" style={revealStyle}>
                <div className={gradientFrameClass("teal")}>
                  <div
                    className={`flex flex-col items-center gap-[10px] rounded-[19px] bg-white text-center ${variant.padding}`}
                  >
                    <div
                      className="flex shrink-0 items-center justify-center"
                      style={{ height: variant.logoBox, width: variant.logoBox }}
                    >
                      {company.logoKind === "image" ? (
                        // Curated logos are static /public assets; real
                        // companies' logoUrl is an arbitrary uploaded
                        // URL/data URI (same convention as HiringStats'
                        // CompanyLogo) — plain <img> covers both without
                        // needing next/image remote-pattern config.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={company.src}
                          alt={company.name}
                          className="object-contain"
                          style={{ height: variant.logoImg, width: variant.logoImg }}
                        />
                      ) : (
                        <PlaceholderLogo
                          className="text-[#141B2E]"
                          style={
                            { height: variant.logoImg * 0.4, width: variant.logoImg * 0.4 } as React.CSSProperties
                          }
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#141B2E]">{company.name}</p>
                      <p className="truncate text-xs text-[#4B5468]">{company.industry}</p>
                      <p className="mt-[2px] text-xs text-brand-teal-dark">
                        {company.openRoles} open roles
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

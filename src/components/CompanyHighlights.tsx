"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { gradientFrameClass } from "./formStyles";
import { getRevealOffset, getRevealStyle, getTuckStyle } from "@/lib/cardReveal";

// How far the page scrolls (px) for the "page" variant's cards to fully tuck
// away behind the directory card.
const TUCK_DISTANCE = 450;

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}
const noSubscribe = () => () => {};
import { CURATED_FILL_TARGET, curatedFill } from "@/lib/curated-companies";

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
  { logoBox: 125, logoImg: 120, padding: "lg:p-[22px]", offset: 0 },
  { logoBox: 88, logoImg: 84, padding: "lg:p-[16px]", offset: 30 },
  { logoBox: 150, logoImg: 145, padding: "lg:p-[26px]", offset: -20 },
  { logoBox: 100, logoImg: 96, padding: "lg:p-[18px]", offset: 16 },
  { logoBox: 132, logoImg: 127, padding: "lg:p-[24px]", offset: -8 },
  { logoBox: 92, logoImg: 88, padding: "lg:p-[16px]", offset: 24 },
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

const MAX_CARDS = CURATED_FILL_TARGET;

// Real employers first, then curated showcase companies (src/lib/
// curated-companies.ts) filling whatever slots are left — same fill logic as
// the Find companies directory.
function buildDisplayCompanies(realCompanies: HighlightCompany[]): Company[] {
  const real: Company[] = realCompanies.slice(0, MAX_CARDS).map((c) => ({
    name: c.companyName,
    industry: c.industry ?? "—",
    openRoles: c.activeCount,
    ...(c.logoUrl ? { logoKind: "image" as const, src: c.logoUrl } : { logoKind: "icon" as const }),
  }));
  const curated: Company[] = curatedFill(
    real.length,
    real.map((c) => c.name),
  ).map((c) => ({ ...c, logoKind: "image" as const }));
  return [...real, ...curated];
}

/**
 * `variant="landing"` (default) is the employer landing page's row, tucked
 * under AnimatedRibbon and revealed by scroll. `variant="page"` is the same
 * row at the top of the Find companies page — already on screen at load, so
 * its cards fade up in a stagger, then tuck down behind the directory card as
 * the page scrolls (the page gives that card a higher z-index).
 */
export default function CompanyHighlights({
  realCompanies,
  variant = "landing",
}: {
  realCompanies: HighlightCompany[];
  variant?: "landing" | "page";
}) {
  const onPage = variant === "page";
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

  // Only the page variant follows the scroll position (server snapshot 0 = at
  // rest), and only in the single 6-across row (lg+) — in the 2/3-column
  // grids the row is too tall to tuck away and would just fade mid-screen.
  const scrollY = useSyncExternalStore(
    onPage ? subscribeScroll : noSubscribe,
    () => (onPage && window.innerWidth >= 1024 ? window.scrollY : 0),
    () => 0,
  );
  const tuckProgress = reducedMotion ? 0 : Math.min(1, scrollY / TUCK_DISTANCE);

  return (
    <div
      className={
        onPage ? "relative z-0 pt-[16px] pb-[48px]" : "shell relative z-[1] -mt-[32px] pt-[clamp(32px,5vh,56px)] pb-[128px]"
      }
    >
      <div className="relative z-[1] mx-auto max-w-[560px] text-center">
        <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
          {onPage ? "Featured companies" : "Who's hiring"}
        </span>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{ fontSize: "clamp(24px,2.6vw,32px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
        >
          {onPage ? "Meet the teams growing with JobGiga" : "Companies building their teams on JobGiga"}
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
        className={`relative z-0 grid grid-cols-2 items-start gap-[12px] sm:grid-cols-3 lg:grid-cols-6 ${
          onPage ? "mt-[40px] lg:mt-[56px]" : "mt-[128px]"
        }`}
      >
        {displayCompanies.map((company, i) => {
          const size = SIZE_VARIANTS[i];
          const revealStyle = onPage
            ? getTuckStyle(tuckProgress, getRevealOffset(i))
            : getRevealStyle(revealProgress, getRevealOffset(i));
          return (
            // The uneven "skyline" offsets only make sense in the single
            // 6-across row; in the 2/3-column grids they overlap the row below.
            // The page variant's load fade lives on this outer div (its
            // keyframes set `transform`; the skyline offset uses the separate
            // `translate` property) so it never overrides the inner div's
            // scroll-driven transform.
            <div
              key={company.name}
              className={`lg:translate-y-[var(--skyline-offset)] ${onPage ? "animate-fade-in-up" : ""}`}
              style={
                {
                  "--skyline-offset": `${size.offset}px`,
                  ...(onPage ? { animationDelay: `${i * 70}ms` } : {}),
                } as React.CSSProperties
              }
            >
              <div className="will-change-transform" style={revealStyle}>
                <div className={gradientFrameClass("teal")}>
                  <div
                    className={`flex flex-col items-center gap-[10px] rounded-[19px] bg-white p-[14px] text-center ${size.padding}`}
                  >
                    <div
                      className="flex max-w-full shrink-0 items-center justify-center"
                      style={{ height: size.logoBox, width: size.logoBox }}
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
                          className="max-w-full object-contain"
                          style={{ height: size.logoImg, width: size.logoImg }}
                        />
                      ) : (
                        <PlaceholderLogo
                          className="text-[#141B2E]"
                          style={
                            { height: size.logoImg * 0.4, width: size.logoImg * 0.4 } as React.CSSProperties
                          }
                        />
                      )}
                    </div>

                    <div className="w-full min-w-0">
                      <p className="truncate text-sm text-[#141B2E]">{company.name}</p>
                      <p className="text-balance break-words text-xs text-[#4B5468]">{company.industry}</p>
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

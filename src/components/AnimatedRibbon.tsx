"use client";

import RibbonLayer, { type Pool } from "./RibbonLayer";
import { useRibbonAnimation } from "@/hooks/useRibbonAnimation";
import { VB_HEIGHT, VB_WIDTH, buildMorphValues, buildStaticPath } from "@/lib/ribbonGeometry";

/*
 * Colours pulled straight from jg-logo.svg (#07BCCA / #008990 / #141B2E),
 * plus tints derived from them for highlight and shadow — nothing invented
 * outside the brand palette. Navy is used once, at low opacity, as a shadow
 * pool rather than a dominant hue: at full strength it reads as heavy next
 * to the two teals.
 */
const TEAL = "#07BCCA";
const TEAL_DARK = "#008990";
const TEAL_LIGHT = "#5CD8E0";
const TEAL_PALE = "#CFF4F6";
const INK = "#141B2E";
/* Same gold used in SiriOrb's third blob (#FFE9A6) — ties the ribbon back
   to the orb instead of introducing an unrelated accent. */
const GOLD = "#FFE9A6";

/*
 * Jobseeker (gold-dominant) counterparts to the teal spread above, occupying
 * the same brightness roles: brand-gold-dark for the "dark" pinches/deep
 * bellies, a mid vivid gold for the belly cores, the existing pale-gold
 * button fill for the "light" passes, and the existing pale-gold chip/
 * dropzone tint (#FFF3D6) reused for the wash — same reuse-existing-tokens
 * approach as the teal set, only one genuinely new stop (GOLD_VIVID).
 */
const GOLD_DARK = "#A67C00";
const GOLD_VIVID = "#C99A2E";
const GOLD_LIGHT = "#FFE9A6";
const GOLD_PALE = "#FFF3D6";

const POOLS_TEAL: readonly Pool[] = [
  { id: "teal1",       cx: 150,  cy: 150, rx: 220, ry: 70,  color: TEAL_LIGHT, opacity: 0.85, rotate: -18, dx: 14, dy: 5, duration: 15.3, parallax: 4 },
  { id: "pinchA",      cx: 320,  cy: 200, rx: 85,  ry: 26,  color: TEAL_DARK,  opacity: 0.92, rotate: 35,  dx: 8,  dy: 4, duration: 12.7, parallax: 5 },
  { id: "belly1Core",  cx: 740,  cy: 225, rx: 230, ry: 95,  color: TEAL,       opacity: 0.95, rotate: -28, dx: 18, dy: 7, duration: 18,   parallax: 7 },
  { id: "belly1Deep",  cx: 800,  cy: 255, rx: 170, ry: 72,  color: TEAL_DARK,  opacity: 0.9,  rotate: -22, dx: 16, dy: 8, duration: 20,   parallax: 8 },
  { id: "belly1Shine", cx: 680,  cy: 175, rx: 140, ry: 45,  color: "#FFFFFF",  opacity: 0.55, rotate: -32, dx: 12, dy: 5, duration: 14,   parallax: 6 },
  { id: "belly1Gold",  cx: 640,  cy: 145, rx: 113, ry: 40,  color: GOLD,       opacity: 0.63, rotate: -20, dx: 11, dy: 5, duration: 15.6, parallax: 5 },
  { id: "link1",       cx: 980,  cy: 205, rx: 150, ry: 50,  color: TEAL_LIGHT, opacity: 0.65, rotate: 15,  dx: 15, dy: 5, duration: 16.7, parallax: 5 },
  { id: "pinchB",      cx: 1150, cy: 205, rx: 80,  ry: 24,  color: TEAL_DARK,  opacity: 0.92, rotate: -35, dx: 8,  dy: 4, duration: 12,   parallax: 5 },
  { id: "belly2Core",  cx: 1560, cy: 240, rx: 240, ry: 100, color: TEAL,       opacity: 0.95, rotate: 30,  dx: 19, dy: 8, duration: 19.3, parallax: 8 },
  { id: "belly2Deep",  cx: 1620, cy: 260, rx: 180, ry: 78,  color: INK,        opacity: 0.28, rotate: 25,  dx: 14, dy: 7, duration: 22,   parallax: 9 },
  { id: "belly2Shine", cx: 1500, cy: 195, rx: 150, ry: 48,  color: "#FFFFFF",  opacity: 0.5,  rotate: 34,  dx: 13, dy: 5, duration: 16,   parallax: 6 },
  { id: "belly2Gold",  cx: 1600, cy: 165, rx: 119, ry: 43,  color: GOLD,       opacity: 0.56, rotate: 22,  dx: 12, dy: 5, duration: 18.2, parallax: 5 },
  { id: "pinchC",      cx: 1860, cy: 165, rx: 80,  ry: 24,  color: TEAL_DARK,  opacity: 0.92, rotate: -30, dx: 8,  dy: 4, duration: 13.5, parallax: 5 },
  { id: "tail",        cx: 1970, cy: 150, rx: 170, ry: 58,  color: TEAL_LIGHT, opacity: 0.8,  rotate: 15,  dx: 15, dy: 5, duration: 17.3, parallax: 6 },
  { id: "tailGold",    cx: 1970, cy: 120, rx: 75,  ry: 26,  color: GOLD,       opacity: 0.55, rotate: 15,  dx: 15, dy: 5, duration: 17.3, parallax: 6 },
  { id: "wash",        cx: 1024, cy: 210, rx: 950, ry: 160, color: TEAL_PALE,  opacity: 0.22, rotate: 0,   dx: 10, dy: 4, duration: 20.7, parallax: 3 },
];

/* Same geometry/timing as POOLS_TEAL — only the dominant/accent colours
   swap: gold takes over the light/dark/vivid/wash roles, teal shrinks down
   to the two small accent blobs (mirrors POOLS_TEAL's gold accents). */
const POOLS_GOLD: readonly Pool[] = [
  { id: "teal1",       cx: 150,  cy: 150, rx: 220, ry: 70,  color: GOLD_LIGHT, opacity: 0.85, rotate: -18, dx: 14, dy: 5, duration: 15.3, parallax: 4 },
  { id: "pinchA",      cx: 320,  cy: 200, rx: 85,  ry: 26,  color: GOLD_DARK,  opacity: 0.92, rotate: 35,  dx: 8,  dy: 4, duration: 12.7, parallax: 5 },
  { id: "belly1Core",  cx: 740,  cy: 225, rx: 230, ry: 95,  color: GOLD_VIVID, opacity: 0.95, rotate: -28, dx: 18, dy: 7, duration: 18,   parallax: 7 },
  { id: "belly1Deep",  cx: 800,  cy: 255, rx: 170, ry: 72,  color: GOLD_DARK,  opacity: 0.9,  rotate: -22, dx: 16, dy: 8, duration: 20,   parallax: 8 },
  { id: "belly1Shine", cx: 680,  cy: 175, rx: 140, ry: 45,  color: "#FFFFFF",  opacity: 0.55, rotate: -32, dx: 12, dy: 5, duration: 14,   parallax: 6 },
  { id: "belly1Gold",  cx: 640,  cy: 145, rx: 113, ry: 40,  color: TEAL_DARK,  opacity: 0.63, rotate: -20, dx: 11, dy: 5, duration: 15.6, parallax: 5 },
  { id: "link1",       cx: 980,  cy: 205, rx: 150, ry: 50,  color: GOLD_LIGHT, opacity: 0.65, rotate: 15,  dx: 15, dy: 5, duration: 16.7, parallax: 5 },
  { id: "pinchB",      cx: 1150, cy: 205, rx: 80,  ry: 24,  color: GOLD_DARK,  opacity: 0.92, rotate: -35, dx: 8,  dy: 4, duration: 12,   parallax: 5 },
  { id: "belly2Core",  cx: 1560, cy: 240, rx: 240, ry: 100, color: GOLD_VIVID, opacity: 0.95, rotate: 30,  dx: 19, dy: 8, duration: 19.3, parallax: 8 },
  { id: "belly2Deep",  cx: 1620, cy: 260, rx: 180, ry: 78,  color: INK,        opacity: 0.28, rotate: 25,  dx: 14, dy: 7, duration: 22,   parallax: 9 },
  { id: "belly2Shine", cx: 1500, cy: 195, rx: 150, ry: 48,  color: "#FFFFFF",  opacity: 0.5,  rotate: 34,  dx: 13, dy: 5, duration: 16,   parallax: 6 },
  { id: "belly2Gold",  cx: 1600, cy: 165, rx: 119, ry: 43,  color: TEAL_DARK,  opacity: 0.56, rotate: 22,  dx: 12, dy: 5, duration: 18.2, parallax: 5 },
  { id: "pinchC",      cx: 1860, cy: 165, rx: 80,  ry: 24,  color: GOLD_DARK,  opacity: 0.92, rotate: -30, dx: 8,  dy: 4, duration: 13.5, parallax: 5 },
  { id: "tail",        cx: 1970, cy: 150, rx: 170, ry: 58,  color: GOLD_LIGHT, opacity: 0.8,  rotate: 15,  dx: 15, dy: 5, duration: 17.3, parallax: 6 },
  { id: "tailGold",    cx: 1970, cy: 120, rx: 75,  ry: 26,  color: TEAL_DARK,  opacity: 0.55, rotate: 15,  dx: 15, dy: 5, duration: 17.3, parallax: 6 },
  { id: "wash",        cx: 1024, cy: 210, rx: 950, ry: 160, color: GOLD_PALE,  opacity: 0.22, rotate: 0,   dx: 10, dy: 4, duration: 20.7, parallax: 3 },
];

const BAND_DURATION = 16;

// Both pure and argument-free — always the same output, so computed once at
// module load instead of on every pointer-driven re-render of AnimatedRibbon.
const STATIC_PATH = buildStaticPath();
const MORPH_VALUES = buildMorphValues();

export default function AnimatedRibbon({ accent = "teal" }: { accent?: "teal" | "gold" }) {
  const { pointer, animate } = useRibbonAnimation();
  const POOLS = accent === "gold" ? POOLS_GOLD : POOLS_TEAL;

  return (
    <div
      aria-hidden
      className="pointer-events-none relative z-[2] h-[160px] w-full select-none sm:h-[220px] lg:h-[300px]"
    >
      <svg
        className="block h-full w-full"
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          {/*
            Feathering the mask (not the fill) softens the silhouette without
            fogging the colour underneath, and lets the pinch points fade out
            instead of terminating as a visible hairline.
          */}
          <filter
            id="bandFeather"
            x="-10%"
            y="-40%"
            width="120%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="2" />
          </filter>

          <mask id="bandMask" maskUnits="userSpaceOnUse">
            <path d={STATIC_PATH} fill="#fff" filter="url(#bandFeather)">
              {animate && (
                <animate
                  attributeName="d"
                  values={MORPH_VALUES}
                  dur={`${BAND_DURATION}s`}
                  calcMode="linear"
                  repeatCount="indefinite"
                />
              )}
            </path>
          </mask>

          {/*
            Long tail on each pool's falloff (still 32% opaque at 0.72 of its
            radius) is what lets neighbouring pools bleed into one another
            instead of reading as discrete blobs.
          */}
          {POOLS.map((p) => (
            <radialGradient key={p.id} id={`pool-${p.id}`}>
              <stop offset="0" stopColor={p.color} stopOpacity="1" />
              <stop offset="0.42" stopColor={p.color} stopOpacity="0.8" />
              <stop offset="0.72" stopColor={p.color} stopOpacity="0.32" />
              <stop offset="0.9" stopColor={p.color} stopOpacity="0.08" />
              <stop offset="1" stopColor={p.color} stopOpacity="0" />
            </radialGradient>
          ))}

          {/* Enhanced multi-layer texture for realistic silk appearance */}
          
          {/* Fine grain - subtle high-frequency noise for fabric texture */}
          <filter id="ribbonGrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.2"
              numOctaves="3"
              stitchTiles="stitch"
              seed="42"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.35" intercept="0" />
            </feComponentTransfer>
          </filter>

          {/* Coarse texture - larger fabric weave pattern */}
          <filter id="ribbonWeave" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.45"
              numOctaves="4"
              stitchTiles="stitch"
              seed="17"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25" intercept="0" />
            </feComponentTransfer>
          </filter>

          {/* Directional fiber texture - simulates silk threads */}
          <filter id="ribbonFibers" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="2.5 0.15"
              numOctaves="2"
              stitchTiles="stitch"
              seed="99"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" intercept="0" />
            </feComponentTransfer>
          </filter>

          <clipPath id="grainClip">
            <path d={STATIC_PATH} />
          </clipPath>
        </defs>

        <g mask="url(#bandMask)">
          {POOLS.map((pool) => (
            <RibbonLayer key={pool.id} pool={pool} pointer={pointer} animate={animate} />
          ))}

          {/* Multi-layer texture compositing for realistic silk appearance */}
          
          {/* Fine grain layer - base fabric texture */}
          <g clipPath="url(#grainClip)" style={{ mixBlendMode: "overlay" }}>
            <rect width={VB_WIDTH} height={VB_HEIGHT} filter="url(#ribbonGrain)" opacity="0.28" />
          </g>

          {/* Coarse weave layer - fabric structure */}
          <g clipPath="url(#grainClip)" style={{ mixBlendMode: "soft-light" }}>
            <rect width={VB_WIDTH} height={VB_HEIGHT} filter="url(#ribbonWeave)" opacity="0.18" />
          </g>

          {/* Directional fiber layer - silk thread highlights */}
          <g clipPath="url(#grainClip)" style={{ mixBlendMode: "overlay" }}>
            <rect width={VB_WIDTH} height={VB_HEIGHT} filter="url(#ribbonFibers)" opacity="0.15" />
          </g>
        </g>
      </svg>
    </div>
  );
}

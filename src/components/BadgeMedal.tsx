import { LockIcon } from "./icons";
import type { BadgeDefinition, BadgeKey } from "@/lib/badge-definitions";

const CX = 50;
const CY = 46;

function point(r: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(t), CY - r * Math.cos(t)];
}

function toPath(points: [number, number][]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("")}Z`;
}

// Radius oscillates `waves` times around the circle — soft seal/rosette edge.
function wavy(waves: number, radius: number, amplitude: number): string {
  const steps = 240;
  return toPath(
    Array.from({ length: steps }, (_, i) => {
      const deg = (i / steps) * 360;
      return point(radius + amplitude * Math.cos((waves * deg * Math.PI) / 180), deg);
    }),
  );
}

// Alternating outer/inner radii — sharp-pointed star or serrated seal.
function star(points: number, outer: number, inner: number): string {
  return toPath(Array.from({ length: points * 2 }, (_, i) => point(i % 2 === 0 ? outer : inner, (i * 180) / points)));
}

function polygon(sides: number, radius: number, rotation = 0): string {
  return toPath(Array.from({ length: sides }, (_, i) => point(radius, rotation + (i * 360) / sides)));
}

const SHIELD =
  "M50 4 C60 9 76 11 88 12 L88 44 C88 67 71 83 50 92 C29 83 12 67 12 44 L12 12 C24 11 40 9 50 4 Z";

// Each badge gets its own silhouette so the set reads as 8 distinct awards,
// not one frame recoloured. `round` softens corners via a same-fill stroke.
const FRAMES: Record<BadgeKey, { d: string; round: number }> = {
  profile_completed: { d: wavy(10, 39, 3.5), round: 0 },
  logo_added: { d: wavy(18, 40, 2), round: 0 },
  profile_boosted: { d: star(8, 44, 35), round: 3 },
  first_job_posted: { d: SHIELD, round: 2 },
  screening_enabled: { d: polygon(6, 41), round: 6 },
  first_candidate_screened: { d: star(16, 43, 37), round: 1.5 },
  first_hire: { d: star(12, 45, 33), round: 2 },
  team_builder: { d: polygon(8, 41, 22.5), round: 6 },
};

// Left laurel sprig (mirrored for the right): a stem arc with paired leaves
// angled forward off it, plus a tip leaf, like classic award medals.
const LAUREL_R = 21;
const [STEM_X0, STEM_Y0] = point(LAUREL_R, 205);
const [STEM_X1, STEM_Y1] = point(LAUREL_R, 305);
const LAUREL_STEM = `M${STEM_X0.toFixed(2)} ${STEM_Y0.toFixed(2)} A${LAUREL_R} ${LAUREL_R} 0 0 1 ${STEM_X1.toFixed(2)} ${STEM_Y1.toFixed(2)}`;
const LAUREL_LEAVES = [
  ...[218, 238, 258, 278, 296].flatMap((deg) => {
    const [ox, oy] = point(LAUREL_R + 2.2, deg);
    const [ix, iy] = point(LAUREL_R - 2.2, deg);
    return [
      { x: ox, y: oy, rot: deg - 90 - 35 },
      { x: ix, y: iy, rot: deg - 90 + 35 },
    ];
  }),
  (() => {
    const [x, y] = point(LAUREL_R, 309);
    return { x, y, rot: 309 - 90 };
  })(),
];

// Mixes a hex color toward white so the palette reads pale/pastel.
function pale(hex: string, amount = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
}

export default function BadgeMedal({ badge, earned }: { badge: BadgeDefinition; earned: boolean }) {
  const id = `medal-${badge.key}`;
  const from = earned ? pale(badge.colorFrom) : "#E4E7EC";
  const to = earned ? pale(badge.colorTo) : "#B4BAC6";
  const ribbon = earned ? pale(badge.ribbon) : "#A9B0BC";
  const ribbonTail = earned ? pale(badge.ribbon, 0.15) : "#8E96A3";
  const frame = FRAMES[badge.key];
  const Icon = badge.icon;

  return (
    <div className="relative aspect-square w-full max-w-[84px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`${id}-star`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor={from} />
          </linearGradient>
          <linearGradient id={`${id}-disc`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <radialGradient id={`${id}-gloss`} cx="38%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx={CX} cy={CY} r="27" />
          </clipPath>
        </defs>

        {/* Soft drop shadow under the frame */}
        <path
          d={frame.d}
          fill={to}
          stroke={to}
          strokeWidth={frame.round}
          strokeLinejoin="round"
          opacity="0.35"
          transform="translate(0 1.8)"
        />
        <path
          d={frame.d}
          fill={`url(#${id}-star)`}
          stroke={`url(#${id}-star)`}
          strokeWidth={frame.round}
          strokeLinejoin="round"
        />

        {/* Beveled rim + inner disc */}
        <circle cx={CX} cy={CY} r="31" fill={`url(#${id}-rim)`} />
        <circle cx={CX} cy={CY} r="27" fill={`url(#${id}-disc)`} stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.2" />
        <circle cx={CX} cy={CY} r="27" fill={`url(#${id}-gloss)`} />

        {[undefined, "translate(100 0) scale(-1 1)"].map((mirror) => (
          <g key={mirror ?? "left"} transform={mirror} opacity="0.6">
            <path d={LAUREL_STEM} fill="none" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
            {LAUREL_LEAVES.map((leaf) => (
              <ellipse
                key={`${leaf.x.toFixed(1)}-${leaf.y.toFixed(1)}`}
                cx={leaf.x}
                cy={leaf.y}
                rx="1.2"
                ry="2.9"
                fill="#FFFFFF"
                transform={`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`}
              />
            ))}
          </g>
        ))}

        {earned && (
          <g clipPath={`url(#${id}-clip)`}>
            <rect
              x={CX - 54}
              y={CY - 54}
              width="108"
              height="108"
              fill={`url(#${id}-shine)`}
              className="badge-shine"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          </g>
        )}

        {/* Ribbon tails, then the arched banner across the lower disc */}
        <path d="M5 67 L20 67 L20 81 L5 81 L10 74 Z" fill={ribbonTail} />
        <path d="M95 67 L80 67 L80 81 L95 81 L90 74 Z" fill={ribbonTail} />
        <path d="M13 64 Q50 59 87 64 L87 79 Q50 74 13 79 Z" fill={ribbon} />
        <text
          x={CX}
          y="69.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="11"
          fontWeight="500"
          fill="#FFFFFF"
        >
          {badge.short}
        </text>
      </svg>

      <div className="absolute left-1/2 top-[40%] h-[22.4%] w-[22.4%] -translate-x-1/2 -translate-y-1/2">
        {earned ? (
          <Icon className="h-full w-full text-white" strokeWidth={1.1} />
        ) : (
          <LockIcon className="h-full w-full text-white/90" />
        )}
      </div>
    </div>
  );
}

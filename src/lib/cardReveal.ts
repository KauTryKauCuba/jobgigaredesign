/**
 * Per-card convergence targets for CompanyHighlights' scroll-driven "fade
 * in from the ribbon" effect — the reveal-direction mirror of
 * badgeStack.ts's hero-badge convergence (same progress input, same
 * translate/scale/rotate/opacity shape). Where the hero badges start spread
 * out and collapse into the ribbon as progress goes 0→1, these cards start
 * collapsed up near the ribbon (large negative dy — roughly where
 * AnimatedRibbon sits relative to the grid's resting position) and travel
 * down into their grid position instead. dx stays small — this reads as a
 * vertical fade-down from the ribbon, not a side-to-side entrance. Index
 * order matches CompanyHighlights' COMPANIES array.
 */
export type RevealOffset = { dx: number; dy: number; rot: number; phase: number };

export const REVEAL_OFFSETS: RevealOffset[] = [
  { dx: -25, dy: -320, rot: -4, phase: 0 },
  { dx: 20, dy: -360, rot: 3, phase: 0.05 },
  { dx: -15, dy: -300, rot: -3, phase: 0.1 },
  { dx: 18, dy: -340, rot: 3, phase: 0.03 },
  { dx: -20, dy: -370, rot: -3, phase: 0.08 },
  { dx: 22, dy: -310, rot: 3, phase: 0.13 },
];

/** Eases 0–1 out, so the front half of the scroll range does most of the
    motion and it settles gently — reads as a deliberate arrival rather than
    an abrupt snap into place. */
function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

export function getRevealOffset(index: number): RevealOffset {
  return REVEAL_OFFSETS[index % REVEAL_OFFSETS.length];
}

export function getRevealStyle(progress: number, offset: RevealOffset): React.CSSProperties {
  const local = Math.min(1, Math.max(0, (progress - offset.phase) / (1 - offset.phase)));
  const eased = easeOut(local);
  const inv = 1 - eased;

  return {
    // opacity tracks the same `eased` curve as position/scale (not a faster
    // ramp) — with a travel distance this large, a card that turned opaque
    // while still far into its trip would sit fully visible on top of the
    // heading above it. Staying translucent until it's actually arrived
    // avoids that.
    transform: `translate3d(${offset.dx * inv}px, ${offset.dy * inv}px, 0) scale(${1 - 0.35 * inv}) rotate(${offset.rot * inv}deg)`,
    opacity: eased,
  };
}

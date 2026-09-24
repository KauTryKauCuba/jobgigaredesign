/**
 * Per-badge convergence targets for the scroll-driven "stack together and
 * slide behind the ribbon" effect on the hero's floating badges. Index order
 * matches each badge list's declaration order — sized to the longest current
 * list (the employer hero's 8) since a shorter list just uses a prefix; a
 * list longer than this would silently wrap and reuse an earlier, wrongly-
 * scaled offset (too much motion for a badge sitting further down/inward),
 * so extend this array first if a badge list grows past 8. dx/dy pull the
 * badge toward a common point below the headline; rot adds a stacked-deck
 * tilt; phase staggers when each badge starts moving, for a cascading
 * collapse rather than all of them moving in lockstep.
 */
export type StackOffset = { dx: number; dy: number; rot: number; phase: number };

export const STACK_OFFSETS: StackOffset[] = [
  { dx: 160, dy: 420, rot: -10, phase: 0 },
  { dx: -160, dy: 400, rot: 8, phase: 0.08 },
  { dx: 170, dy: 300, rot: -6, phase: 0.03 },
  { dx: -160, dy: 290, rot: 7, phase: 0.11 },
  { dx: 110, dy: 200, rot: -4, phase: 0.16 },
  { dx: -100, dy: 190, rot: 5, phase: 0.06 },
  { dx: 130, dy: 260, rot: -5, phase: 0.09 },
  { dx: -100, dy: 190, rot: 5, phase: 0.06 },
];

/** Eases 0–1 in, so early scroll barely moves the badge and the back half of
    the scroll range does most of the motion — reads as a deliberate collapse
    rather than a linear drift. */
function easeIn(t: number) {
  return t * t;
}

// `extraDy` adds flat extra downward travel on top of a badge's base offset,
// for a page where the convergence point (normally just below the headline,
// where the ribbon sits immediately after) needs to reach further down —
// e.g. JobPostingBadges on the jobseeker landing page, where
// JobseekerHowItWorks now sits between the hero and the ribbon. Defaults to
// 0 so every other caller (the employer hero, etc.) is unaffected.
export function getStackOffset(index: number, extraDy = 0): StackOffset {
  if (process.env.NODE_ENV !== "production" && index >= STACK_OFFSETS.length) {
    console.warn(
      `[badgeStack] badge index ${index} has no matching offset (only ${STACK_OFFSETS.length} defined) — it will silently reuse an earlier, wrongly-scaled offset. Add more entries to STACK_OFFSETS.`,
    );
  }
  const base = STACK_OFFSETS[index % STACK_OFFSETS.length];
  return extraDy ? { ...base, dy: base.dy + extraDy } : base;
}

export function getStackStyle(progress: number, offset: StackOffset): React.CSSProperties {
  const local = Math.min(1, Math.max(0, (progress - offset.phase) / (1 - offset.phase)));
  const eased = easeIn(local);

  // Fully transparent by the time convergence completes — the ribbon's wave
  // shape doesn't cover its whole bounding box, so opacity (not just z-index)
  // is what actually sells "gone behind it" once the stack finishes closing.
  return {
    transform: `translate3d(${offset.dx * eased}px, ${offset.dy * eased}px, 0) scale(${1 - 0.42 * eased}) rotate(${offset.rot * eased}deg)`,
    opacity: 1 - Math.max(0, (eased - 0.55) / 0.45),
  };
}

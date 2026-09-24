/**
 * A circular, Siri-style animated orb: three softly-blurred colour blobs
 * drifting independently inside a hard-clipped circle, so they slowly blend
 * and separate — closer to the real Siri orb's liquid motion than a single
 * rotating gradient. No glow: `overflow-hidden` + full radius clips
 * everything to the circle, nothing bleeds past its edge. Pure CSS (see the
 * `.siri-orb-*` rules in globals.css) — no JS, no per-frame React work, and
 * it respects `prefers-reduced-motion` via a plain media query.
 */
export default function SiriOrb({
  className = "",
  active = false,
}: {
  className?: string;
  active?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`siri-orb-base relative inline-block shrink-0 overflow-hidden rounded-full ${
        active ? "siri-orb-active" : ""
      } ${className}`}
    >
      <span className="siri-orb-blob siri-orb-blob-a" />
      <span className="siri-orb-blob siri-orb-blob-b" />
      <span className="siri-orb-blob siri-orb-blob-c" />
    </span>
  );
}

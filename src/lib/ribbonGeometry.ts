/**
 * A single flowing ribbon band, used as a mask. The colour is painted
 * separately as soft radial "light pools" underneath it (see
 * AnimatedRibbon.tsx) — filling the band with a flat gradient reads as vector
 * art, not silk; pooled, two-dimensional colour is what makes it look real.
 *
 * The band itself is one continuous silhouette that pinches thin at three
 * points and bells out at two big ones in between, which is what gives it a
 * more twisted, multi-turn flow across the full width instead of a single
 * loose "S".
 */

export const VB_WIDTH = 2048;
export const VB_HEIGHT = 360;

const X: readonly number[] = [
  0, 150, 320, 480, 620, 760, 900, 1024, 1150, 1290, 1430, 1570, 1710, 1860,
  2048,
];

/** Centreline and thickness — three pinches (idx 2, 8, 13), two bellies (idx 5, 11). */
const CENTRE: readonly number[] = [
  130, 150, 200, 230, 245, 225, 205, 195, 205, 230, 255, 240, 200, 165, 140,
];
const THICKNESS: readonly number[] = [
  95, 75, 16, 55, 130, 168, 140, 70, 16, 55, 140, 172, 145, 16, 65,
];

const round = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom through the points, emitted as cubic Bézier segments. */
function smooth(pts: readonly { x: number; y: number }[]): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(
      p2.x
    )},${round(p2.y)}`;
  }
  return d;
}

function bandPath(top: readonly number[], bottom: readonly number[]): string {
  const topPts = top.map((y, i) => ({ x: X[i], y }));
  const botPts = bottom.map((y, i) => ({ x: X[i], y })).reverse();
  return (
    `M${round(topPts[0].x)},${round(topPts[0].y)}` +
    smooth(topPts) +
    `L${round(botPts[0].x)},${round(botPts[0].y)}` +
    smooth(botPts) +
    "Z"
  );
}

/**
 * The band at phase `t` (0→1). The centreline drifts on two sine terms
 * (different frequencies/phases); thickness breathes independently. Both
 * frequencies are integers so the motion is exactly periodic over t∈[0,1) —
 * t=1 is numerically identical to t=0, so the loop closes with no seam.
 */
function frameAt(t: number): { top: number[]; bottom: number[] } {
  const top: number[] = [];
  const bottom: number[] = [];
  const n = X.length;

  for (let i = 0; i < n; i++) {
    const edgeFade = Math.min(1, Math.min(i, n - 1 - i) / 2);
    // Amplitudes and per-point phase spread raised for more visible twist —
    // both terms still integer-frequency, so t=1 stays identical to t=0.
    const drift =
      (Math.sin(2 * Math.PI * t + i * 0.7 + 0.6) * 15 +
        Math.sin(2 * Math.PI * 2 * t + i * 1.05 + 2.4) * 8) *
      edgeFade;
    const breathe = 1 + 0.13 * Math.sin(2 * Math.PI * t + i * 0.6 + 1.3);

    const c = CENTRE[i] + drift;
    const h = (THICKNESS[i] / 2) * breathe;
    top.push(c - h);
    bottom.push(c + h);
  }

  return { top, bottom };
}

const STATES = 12;

export function buildMorphValues(): string {
  const frames: string[] = [];
  for (let s = 0; s <= STATES; s++) {
    const f = frameAt(s / STATES);
    frames.push(bandPath(f.top, f.bottom));
  }
  return frames.join(";");
}

/** Resting silhouette — first paint, and what reduced-motion users get. */
export function buildStaticPath(): string {
  const f = frameAt(0);
  return bandPath(f.top, f.bottom);
}

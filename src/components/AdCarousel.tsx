"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const AUTO_ADVANCE_MS = 3000;

type Slot = { x: number; scale: number; opacity: number };

// One card in the middle: where each card sits by how far it is from the
// middle — sideways offset (as a share of the middle card's width), scale
// and opacity. Further out = hidden.
const ONE_MAIN: Slot[] = [
  { x: 0, scale: 1, opacity: 1 },
  { x: 72, scale: 0.78, opacity: 0.75 },
  { x: 128, scale: 0.6, opacity: 0.4 },
];
const ONE_MAIN_HIDDEN: Slot = { x: 165, scale: 0.5, opacity: 0 };

// Two cards in the middle, side by side, with the rest spreading out to the
// screen edges — by level: 0 = the two main cards, 1 = their neighbours, …
const TWO_MAIN: Slot[] = [
  { x: 54, scale: 1, opacity: 1 },
  { x: 150, scale: 0.82, opacity: 0.85 },
  { x: 232, scale: 0.66, opacity: 0.6 },
  { x: 300, scale: 0.54, opacity: 0.35 },
];
const TWO_MAIN_HIDDEN: Slot = { x: 360, scale: 0.45, opacity: 0 };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const wideQuery = "(min-width: 1024px)";
function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}
const subscribeReducedMotion = subscribeMedia(reducedMotionQuery);
const subscribeWide = subscribeMedia(wideQuery);

// How far the edge mask reaches above and below the cards, for their shadows.
const MASK_BLEED = 64;

/**
 * One row of ads: the middle card large (or, with `twoMain` on wide
 * screens, two side by side), its neighbours smaller and faded on either
 * side. Loops, auto-advances (paused on hover/focus, and off for reduced
 * motion), and moves by dots, swipe, or clicking a side card. Shared by the
 * employer page's Company spotlight and the jobseeker page's Featured jobs —
 * each passes its own card, stage size and colours.
 */
export default function AdCarousel<T extends { id: string }>({
  items,
  renderCard,
  dotLabel,
  stageWidth,
  stageHeight,
  fadeColor,
  fadeWidth,
  twoMain = false,
  activeDotClassName = "bg-brand-teal-dark",
  className = "mt-[96px]",
  startIndex = 0,
  autoAdvance = true,
}: {
  items: T[];
  // `active` = a main card (e.g. only those play their video).
  renderCard: (item: T, active: boolean) => React.ReactNode;
  dotLabel: (item: T, index: number) => string;
  // CSS lengths for one main card's box, e.g. "min(640px, 78vw)".
  stageWidth: string;
  stageHeight: string;
  // The page background the side cards fade into, as "#RRGGBB". Omit to fade
  // them out with a mask instead, for a background that isn't one flat colour.
  fadeColor?: string;
  // Each edge fade's width; by default it runs from the screen edge to the main card.
  fadeWidth?: string;
  // Two main cards side by side on wide screens (one on narrower ones).
  twoMain?: boolean;
  activeDotClassName?: string;
  className?: string;
  // Which card starts in the middle, and whether it moves on by itself —
  // the employer's "Preview on the employer page" starts on their ad, still.
  startIndex?: number;
  autoAdvance?: boolean;
}) {
  const count = items.length;
  const norm = (i: number) => ((i % count) + count) % count;
  // `prev` is where the row was before the last move — a card that wraps
  // round from one end to the other jumps there instead of sliding across.
  const [position, setPosition] = useState({ active: startIndex, prev: startIndex });
  const active = position.active;
  const [paused, setPaused] = useState(!autoAdvance);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(wideQuery).matches, () => false);
  const mains = twoMain && wide && count > 2 ? 2 : 1;
  const swipeStart = useRef<number | null>(null);
  // A drag-to-swipe ends with a click on whatever's under the pointer — swallowed so it doesn't open the card.
  const justSwiped = useRef(false);

  const go = (i: number) => setPosition((p) => ({ active: norm(i), prev: p.active }));

  // Restarts after every move, so a dot/swipe/click gets a full pause before the next step.
  useEffect(() => {
    if (paused || reducedMotion || count <= mains) return;
    const timer = setTimeout(
      () => setPosition((p) => ({ active: (p.active + 1) % count, prev: p.active })),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [paused, reducedMotion, count, mains, active]);

  // Where card i sits when `from` is the (first) main card: its side (-1
  // left, 0 middle, 1 right), its level out from the middle, and its slot.
  function place(i: number, from: number) {
    if (mains === 1) {
      // Shortest way round the loop, so card 0 sits to the right of the last one.
      let d = i - from;
      if (d > count / 2) d -= count;
      if (d < -count / 2) d += count;
      const level = Math.abs(d);
      return { side: Math.sign(d), level, slot: ONE_MAIN[level] ?? ONE_MAIN_HIDDEN };
    }
    // Two mains: measured from the gap between them (k = ±0.5 for the mains).
    let k = i - from - 0.5;
    while (k > count / 2) k -= count;
    while (k <= -count / 2) k += count;
    const level = Math.abs(k) - 0.5;
    return { side: Math.sign(k), level, slot: TWO_MAIN[level] ?? TWO_MAIN_HIDDEN };
  }

  const sideFade = fadeWidth ?? `calc((100vw - ${stageWidth}) / 2)`;
  // Fades to the same colour at zero alpha (not `transparent`, which blends through grey).
  const fade = (direction: "right" | "left") =>
    `linear-gradient(to ${direction}, ${fadeColor}, ${fadeColor}b3, ${fadeColor}00)`;
  // The mask version of the same fade: hidden at the screen edges, 30% shown
  // halfway in, fully shown from the fade's inner edge.
  const edgeMask = `linear-gradient(to right, transparent, rgb(0 0 0 / 0.3) calc(${sideFade} / 2), black ${sideFade}, black calc(100% - ${sideFade}), rgb(0 0 0 / 0.3) calc(100% - ${sideFade} / 2), transparent)`;

  const cards = items.map((item, i) => {
    const { side, level, slot } = place(i, active);
    const before = place(i, position.prev);
    const isMain = level === 0;
    // Wrapped round to the other end: jump, don't slide across the row.
    const wrapped = side !== 0 && before.side !== 0 && side !== before.side && level > 0 && before.level > 0;
    return (
      <div
        key={item.id}
        className={`absolute inset-0 ${wrapped ? "" : "transition-[transform,opacity] duration-500 ease-out"}`}
        style={{
          transform: `translateX(${side * slot.x}%) scale(${slot.scale})`,
          opacity: slot.opacity,
          zIndex: 10 - Math.ceil(level),
          pointerEvents: slot.opacity === 0 ? "none" : undefined,
        }}
        aria-hidden={slot.opacity === 0 || undefined}
        // A side card's first click brings it to the middle instead of opening it.
        onClickCapture={(e) => {
          if (justSwiped.current) {
            justSwiped.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (!isMain) {
            e.preventDefault();
            e.stopPropagation();
            // With two mains, a card on the right becomes the right-hand one.
            go(mains === 2 && side > 0 ? i - 1 : i);
          }
        }}
      >
        <div className={isMain ? "" : "cursor-pointer"}>{renderCard(item, isMain)}</div>
      </div>
    );
  });

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(!autoAdvance)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(!autoAdvance)}
    >
      <div
        className="relative mx-auto touch-pan-y"
        style={{ width: stageWidth, height: stageHeight }}
        onPointerDown={(e) => (swipeStart.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipeStart.current === null) return;
          const dx = e.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(dx) > 40) {
            justSwiped.current = true;
            go(active + (dx < 0 ? 1 : -1));
          }
        }}
      >
        {fadeColor ? (
          <>
            {/* Side cards fade into the page background at the screen edges. */}
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-screen -translate-x-1/2">
              <div className="absolute inset-y-0 left-0" style={{ width: sideFade, background: fade("right") }} />
              <div className="absolute inset-y-0 right-0" style={{ width: sideFade, background: fade("left") }} />
            </div>
            {cards}
          </>
        ) : (
          // Masked to fade out at the screen edges — reaching past the stage
          // top and bottom so the cards' shadows aren't cut off by the mask.
          <div
            className="absolute left-1/2 w-screen -translate-x-1/2"
            style={{
              top: -MASK_BLEED,
              bottom: -MASK_BLEED,
              maskImage: edgeMask,
              WebkitMaskImage: edgeMask,
            }}
          >
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: MASK_BLEED, width: stageWidth, height: stageHeight }}>
              {cards}
            </div>
          </div>
        )}
      </div>

      {count > mains && (
        <div className="mt-[24px] flex items-center justify-center gap-[14px]">
          <div className="flex items-center gap-[6px]">
            {items.map((item, i) => {
              const current = i === active || (mains === 2 && i === norm(active + 1));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={dotLabel(item, i)}
                  aria-current={current}
                  className={`h-[7px] rounded-full transition-all ${
                    current ? `w-[22px] ${activeDotClassName}` : "w-[7px] bg-black/[0.15] hover:bg-black/[0.3]"
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

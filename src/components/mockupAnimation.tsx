"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Drives a looping landing-page mockup demo: returns the current step
 * (0..durations.length), advancing after durations[step] ms and starting over
 * once the last one has been held. Only ticks while the mockup is on screen,
 * and jumps straight to the final step for prefers-reduced-motion.
 */
export function useMockupStep(rootRef: RefObject<HTMLElement | null>, durations: number[]) {
  const [step, setStep] = useState(0);
  // Durations are module constants in practice — keyed by value so an
  // inline array literal doesn't restart the loop every render.
  const key = durations.join(",");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const steps = key.split(",").map(Number);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const advance = (next: number) => {
      timer = setTimeout(() => {
        const wrapped = next > steps.length ? 0 : next;
        setStep(wrapped);
        advance(wrapped + 1);
      }, steps[next - 1] ?? 0);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        stop();
        if (reduceMotion) {
          timer = setTimeout(() => setStep(steps.length), 0);
        } else if (entry.isIntersecting) {
          timer = setTimeout(() => {
            setStep(0);
            advance(1);
          }, 0);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [rootRef, key]);

  return step;
}

/** Skeleton until `shown`, then the real content fades/slides in over it. */
export function Reveal({
  shown,
  skeleton,
  children,
}: {
  shown: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // The real content sets the height (so nothing jumps); the skeleton sits
    // on top of that same space until it's replaced.
    <div className="relative">
      <div className={`transition-all duration-500 ${shown ? "translate-y-0 opacity-100" : "translate-y-[4px] opacity-0"}`}>
        {children}
      </div>
      <div
        className={`absolute inset-x-0 top-0 transition-opacity duration-300 ${shown ? "opacity-0" : "opacity-100"}`}
        aria-hidden
      >
        {skeleton}
      </div>
    </div>
  );
}

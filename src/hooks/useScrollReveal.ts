"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks how far an element has scrolled up from the bottom of the
 * viewport, as a 0–1 progress value over `distance` px. Same shape as
 * useScrollStack (ref + progress, rAF-throttled scroll listener, respects
 * prefers-reduced-motion), but for the opposite trigger: useScrollStack
 * measures distance scrolled PAST the viewport's top edge, which only fits
 * content pinned near the top of the page (the hero badges converging into
 * AnimatedRibbon as the hero scrolls away). A section further down the page
 * needs to finish its reveal while it's still comfortably on screen, not
 * only once it's nearly scrolled past — hence measuring from the bottom
 * edge instead. Used by CompanyHighlights' card reveal.
 */
export function useScrollReveal(distance = 500) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    function measure() {
      ticking = false;
      const top = el!.getBoundingClientRect().top;
      const entered = window.innerHeight - top;
      setProgress(Math.min(1, Math.max(0, entered / distance)));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [distance]);

  return { ref, progress };
}

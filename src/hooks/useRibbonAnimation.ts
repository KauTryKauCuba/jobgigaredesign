"use client";

import { useEffect, useRef, useState } from "react";

export type Pointer = { x: number; y: number };

/**
 * Reduced-motion detection and mouse-parallax state.
 *
 * The frame-by-frame morph itself runs on SMIL (`<animate>`/`<animateTransform>`
 * in RibbonLayer), which stays on the compositor — this hook only re-renders
 * on a pointer move (rAF-throttled) or a reduced-motion change, never per
 * animation frame.
 */
export function useRibbonAnimation() {
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0 });
  const [animate, setAnimate] = useState(true);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setAnimate(!reduce.matches);
    sync();
    reduce.addEventListener("change", sync);

    const onMove = (e: MouseEvent) => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setPointer({
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: (e.clientY / window.innerHeight) * 2 - 1,
        });
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      reduce.removeEventListener("change", sync);
      window.removeEventListener("mousemove", onMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return { pointer, animate };
}

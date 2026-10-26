"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-width colour band that eases out to full width while in view and
 * back down to 70% once it scrolls past — in both directions, so scrolling
 * back up shrinks it again. Only the band's width animates — the content on
 * top of it (passed as children) stays put, unscaled.
 */
export default function ScrollWidthBackground({
  color,
  gradient,
  video,
  fadeEdges = false,
  startWidth = 70,
  durationMs = 700,
  children,
}: {
  color: string;
  /** A CSS gradient to paint the band with instead of the flat `color`. */
  gradient?: string;
  /** A muted, looping video filling the band, under a wash of the band's
   *  colour/gradient so the content on top stays readable. */
  video?: { src: string; poster?: string; washOpacity?: number };
  /** How long the band takes to ease out to full width. */
  durationMs?: number;
  /** The band's width (% of the page) before it eases out to full width. */
  startWidth?: number;
  /** Fades the band out at its left and right edges. */
  fadeEdges?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // A mask (rather than fading the colour itself) so the edges fade the same
  // whatever the band is painted with.
  const edgeMask = fadeEdges ? "linear-gradient(to right, transparent, black 15%, black 85%, transparent)" : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setExpanded(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative z-10 w-full">
      <div
        aria-hidden
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden transition-[width] ease-out"
        style={{
          background: video ? undefined : (gradient ?? color),
          maskImage: edgeMask,
          WebkitMaskImage: edgeMask,
          width: expanded ? "100%" : `${startWidth}%`,
          transitionDuration: `${durationMs}ms`,
        }}
      >
        {video && (
          <>
            <video
              src={video.src}
              poster={video.poster}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: gradient ?? color, opacity: video.washOpacity ?? 0.8 }}
            />
          </>
        )}
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

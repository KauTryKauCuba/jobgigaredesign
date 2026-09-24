"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Inlines public/illustrations/job-title-telecommuting.svg into the DOM
 * (rather than an <img src>) so its "..." speech-bubble dots and desk lamp
 * can actually be targeted and animated by the `.job-*` rules in
 * globals.css — an <img>'s internal markup isn't reachable from CSS.
 * Fetched once on mount since it's a static asset; nothing renders until
 * it lands.
 */
export default function JobTitleIllustration({
  className = "",
  lit = false,
}: {
  className?: string;
  lit?: boolean;
}) {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/illustrations/job-title-telecommuting.svg")
      .then((res) => res.text())
      .then((svg) => {
        if (!cancelled) setMarkup(svg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!markup) return null;

  return (
    <div
      className={className}
      style={
        {
          "--job-lamp-color": lit ? "#FFE9A6" : "#7ac1c5",
          "--job-lit-glow": lit ? 1 : 0,
        } as CSSProperties
      }
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

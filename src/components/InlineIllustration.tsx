"use client";

import { useEffect, useState } from "react";

/**
 * Fetches a static SVG from `/public` and inlines it into the DOM (rather
 * than an <img src>) so it can actually be targeted/animated by CSS —
 * shared by any card that wants one of the Storyset-derived decorative
 * illustrations (see JobTitleIllustration for the one with lamp/typing
 * animation hooks). Fetched once on mount; nothing renders until it lands.
 */
export default function InlineIllustration({ src, className = "" }: { src: string; className?: string }) {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((res) => res.text())
      .then((svg) => {
        if (!cancelled) setMarkup(svg);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!markup) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: markup }} />;
}

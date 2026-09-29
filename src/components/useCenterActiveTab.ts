"use client";

import { useEffect, useRef } from "react";

// On narrow screens the sidebar nav collapses into a horizontally scrolling
// tab bar; without this, the current page's tab can start off-screen.
export function useCenterActiveTab<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const bar = ref.current;
    if (!bar || bar.scrollWidth <= bar.clientWidth) return;
    const active = bar.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const b = bar.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    bar.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2);
  }, []);
  return ref;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { GridIcon } from "./icons";
import PosterGeneratorTeaser from "./PosterGeneratorTeaser";
import ReferralTeaser from "./ReferralTeaser";

/**
 * The navbar's "Tools" button for employers — a dropdown holding the same
 * animated Poster generator / Refer a company cards that used to live as
 * fixed sidebar cards (PosterGeneratorTeaser, ReferralTeaser), just tucked
 * behind a button instead of taking up permanent sidebar space. Same
 * circle-button-plus-dropdown pattern as NotificationBell, so the two read
 * as a pair.
 */
export default function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Tools"
        aria-expanded={open}
        aria-haspopup="menu"
        // Same circle as the navbar's Notifications / Sign out buttons, so all three read as a set.
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-black/[0.1] text-[#141B2E] hover:bg-black/[0.03]"
      >
        <GridIcon className="h-[16px] w-[16px]" />
      </button>

      {open && (
        <div
          role="menu"
          // Landscape, two rows: each card is its own wide, short row (visual
          // on the left, text and button on the right) stacked one above the
          // other — not two narrow cards side by side.
          className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-[460px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-100px)] flex-col gap-[10px] overflow-y-auto rounded-[14px] border border-black/[0.06] bg-[#F8FAFB] p-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
        >
          {/* Navigates away, so the menu closes on click. */}
          <div onClick={() => setOpen(false)}>
            <PosterGeneratorTeaser layout="landscape" />
          </div>
          {/* Shows its "coming soon" note in place — stays open so it's visible. */}
          <ReferralTeaser layout="landscape" />
        </div>
      )}
    </div>
  );
}

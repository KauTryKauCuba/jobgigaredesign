"use client";

import { useEffect, useState } from "react";
import { XIcon } from "./icons";
import Modal from "./Modal";

// Shown once per browser — closing it (the ✕, Escape or the backdrop)
// remembers that, so it never nags on later visits.
const storageKey = (role: string) => `jobgiga-welcome-seen-${role}`;
const SHOW_AFTER_MS = 700;

/**
 * A welcome popup for signed-out visitors to a landing page — just a square
 * (1:1) image, which the superadmin can change (see welcome-images.ts).
 */
export default function WelcomeModal({ role, image }: { role: "employer" | "jobseeker"; image: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey(role)) === "1";
    } catch {
      // Storage blocked (private mode etc.) — just show it.
    }
    if (seen) return;
    const timeout = setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [role]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(storageKey(role), "1");
    } catch {
      // Storage blocked — it may show again next visit, which is fine.
    }
  }

  if (!open) return null;

  return (
    <Modal wide ariaLabel="Welcome to JobGiga" onClose={close}>
      <div className="relative aspect-square w-full bg-[#F1F4F8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Welcome to JobGiga" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-[12px] top-[12px] flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white/90 text-[#4B5468] shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:text-[#141B2E]"
        >
          <XIcon className="h-[11px] w-[11px]" />
        </button>
      </div>
    </Modal>
  );
}

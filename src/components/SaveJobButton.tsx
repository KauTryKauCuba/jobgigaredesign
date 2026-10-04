"use client";

import { useState } from "react";
import { HeartIcon } from "./icons";

/**
 * The heart that saves/un-saves a posting. Optimistic — flips immediately,
 * then rolls back if the request fails. `variant="icon"` is the compact
 * circle for cards; `variant="pill"` adds a "Save"/"Saved" label for
 * detail views. Safe inside a clickable card: it never triggers the card.
 */
export default function SaveJobButton({
  jobPostingId,
  initialSaved,
  variant = "icon",
  onChange,
  className = "",
}: {
  jobPostingId: string;
  initialSaved: boolean;
  variant?: "icon" | "pill";
  onChange?: (saved: boolean) => void;
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      const res = await fetch("/api/jobseeker/saved-jobs", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPostingId }),
      });
      if (!res.ok) throw new Error();
      onChange?.(next);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? "Remove from saved jobs" : "Save job";
  const tone = saved ? "text-[#E5484D]" : "text-[#4B5468]";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        className={`flex h-[42px] items-center gap-[8px] rounded-full border border-black/[0.1] bg-white px-[18px] text-sm text-[#141B2E] transition-colors hover:bg-black/[0.03] ${className}`}
      >
        <HeartIcon filled={saved} className={`h-[15px] w-[15px] ${tone}`} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-black/[0.1] bg-white transition-colors hover:bg-black/[0.03] ${className}`}
    >
      <HeartIcon filled={saved} className={`h-[15px] w-[15px] ${tone}`} />
    </button>
  );
}

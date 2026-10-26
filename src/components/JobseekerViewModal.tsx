"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { gradientFrameClass } from "./formStyles";
import { XIcon } from "./icons";
import JobPostingDetails, { PostingCard, type JobPosting } from "./JobPostingDetails";

const noopSubscribe = () => () => {};

/**
 * A posting exactly as jobseekers see it on the jobseeker landing page —
 * the browse card ("In the job list") beside the full details panel
 * ("When they open it"). Rendered into <body> so a transformed/animated
 * ancestor can't trap the fixed overlay. `footer` holds the caller's actions.
 */
export default function JobseekerViewModal({
  posting,
  subtitle = "This is how the posting appears to jobseekers.",
  onClose,
  footer,
}: {
  posting: JobPosting;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jobseeker view"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-[22px] py-[16px]">
          <div>
            <p className="text-sm text-[#141B2E]">Jobseeker view</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]"
            aria-label="Close jobseeker view"
          >
            <XIcon className="h-[14px] w-[14px]" />
          </button>
        </div>

        <div className="scrollbar-thin-teal flex-1 overflow-y-auto bg-brand-gold-page px-[16px] py-[20px] sm:px-[22px]">
          <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[300px_1fr] lg:items-start">
            {/* Stays put while the details panel scrolls (side-by-side layout only). */}
            <div className="lg:sticky lg:top-0">
              <p className="mb-[8px] text-xs text-[#9AA3B2]">In the job list</p>
              <PostingCard posting={posting} selected />
            </div>
            <div>
              <p className="mb-[8px] text-xs text-[#9AA3B2]">When they open it</p>
              <div className={gradientFrameClass("gold")}>
                <div className="rounded-[19px] bg-white p-[16px] sm:p-[24px]">
                  <JobPostingDetails posting={posting} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {footer && (
          <div className="flex flex-col gap-[8px] border-t border-black/[0.06] px-[22px] py-[16px] sm:flex-row">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

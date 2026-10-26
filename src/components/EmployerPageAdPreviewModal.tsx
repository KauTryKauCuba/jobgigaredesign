"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CompanyAdCardData } from "./CompanyAdCard";
import CompanyAdsSection from "./CompanyAdsSection";
import { XIcon } from "./icons";

const noopSubscribe = () => () => {};

/**
 * The employer's ad shown exactly where it will appear: the employer landing
 * page's real "Company spotlight" section (same component), on the page's
 * own background, with their ad in the middle slot among the ads currently
 * showing (sample ads fill the rest, as on the real page). Rendered into
 * <body> so a transformed/animated ancestor can't trap the fixed overlay.
 */
export default function EmployerPageAdPreviewModal({
  ad,
  otherAds,
  onClose,
}: {
  ad: CompanyAdCardData;
  otherAds: (CompanyAdCardData & { id: string })[];
  onClose: () => void;
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
        aria-label="Preview on the employer page"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-[22px] py-[16px]">
          <div>
            <p className="text-sm text-[#141B2E]">Preview on the employer page</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Your ad is in the middle. Tap the dots or a side card to look around.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]"
            aria-label="Close preview"
          >
            <XIcon className="h-[14px] w-[14px]" />
          </button>
        </div>

        <div className="scrollbar-thin-teal flex-1 overflow-y-auto overflow-x-hidden bg-brand-teal-page">
          {/* Zoomed out 10% so more of the row fits inside the dialog. */}
          <div style={{ zoom: 0.9 }}>
          <CompanyAdsSection
            className="relative px-[16px] pb-[36px] pt-[32px] sm:px-[22px]"
            // No company links inside the preview — clicking a card shouldn't leave the dashboard.
            ads={[{ ...ad, id: "your-ad" }, ...otherAds.map((a) => ({ ...a, companyId: undefined }))]}
            startIndex={0}
            autoAdvance={false}
          />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

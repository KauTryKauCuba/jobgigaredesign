"use client";

import { useState } from "react";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon } from "./icons";

/**
 * Card inviting the employer to refer another company to JobGiga and earn a
 * share of what that company spends. The referral program itself isn't
 * built yet — the button only says so for now.
 * `layout="portrait"` (the original sidebar card: visual on top, text below)
 * or `"landscape"` (visual on the left, text and the button on the right —
 * for the navbar's Tools dropdown). The animation itself is untouched
 * either way; only the surrounding layout changes.
 */
export default function ReferralTeaser({ layout = "portrait" }: { layout?: "portrait" | "landscape" }) {
  const [showSoon, setShowSoon] = useState(false);
  const landscape = layout === "landscape";

  return (
    <div className={gradientFrameClass("teal")}>
      <div className={landscape ? "flex items-center gap-[14px] rounded-[19px] bg-white p-[12px]" : "flex flex-col gap-[12px] rounded-[19px] bg-white p-[16px]"}>
        {/* A looping story (see .referral-* in globals.css): your referral code
            travels to their company, theirs lights up, then +10% arcs back to
            yours. Every piece is positioned from the same centre point. */}
        <div
          aria-hidden
          className={`relative h-[140px] overflow-hidden rounded-[14px] bg-[#F8FAFB] ${landscape ? "w-[190px] shrink-0" : ""}`}
        >
          <div className="referral-line absolute left-[calc(50%-29px)] top-[calc(56%-1px)] h-[2px] w-[58px]" />

          <div className="referral-tile-you absolute left-[calc(50%-81px)] top-[calc(56%-26px)] flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-[#EEF1F5] bg-white text-brand-teal-dark/80 shadow-[0_6px_18px_-6px_rgba(20,27,46,0.08)]">
            <BuildingIcon className="h-[22px] w-[22px]" />
          </div>
          <div className="referral-tile-them absolute left-[calc(50%+29px)] top-[calc(56%-26px)] flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-[#EEF1F5] bg-white text-brand-gold-dark/75 shadow-[0_6px_18px_-6px_rgba(20,27,46,0.08)]">
            <BuildingIcon className="h-[22px] w-[22px]" />
          </div>
          <span className="absolute left-[calc(50%-81px)] top-[calc(56%+31px)] w-[52px] text-center text-[10px] text-[#9AA3B2]">
            You
          </span>
          <span className="absolute left-[calc(50%+29px)] top-[calc(56%+31px)] w-[52px] text-center text-[10px] text-[#9AA3B2]">
            Them
          </span>

          <span className="referral-code absolute left-[calc(50%-27px)] top-[calc(56%-10px)] flex h-[20px] w-[54px] items-center justify-center rounded-full border border-brand-teal/25 bg-white text-[9px] font-medium tracking-[0.04em] text-brand-teal-dark shadow-[0_4px_12px_-4px_rgba(0,137,144,0.25)]">
            JG-7K2Q
          </span>
          <span className="referral-reward absolute left-[calc(50%-23px)] top-[calc(56%-11px)] flex h-[22px] w-[46px] items-center justify-center rounded-full border border-white bg-[#FFF3CF] text-xs font-medium text-brand-gold-dark shadow-[0_4px_12px_-4px_rgba(166,124,0,0.3)]">
            +10%
          </span>
        </div>

        <div className={landscape ? "flex min-w-0 flex-1 flex-col gap-[10px]" : "contents"}>
          <div>
            <p className="text-sm text-[#141B2E]">Refer a company</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Enjoying JobGiga? Introduce another company that&rsquo;s hiring, and earn 10% of what they spend with us.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSoon(true)}
            className="flex h-[38px] items-center justify-center rounded-full border border-brand-teal-dark text-sm text-brand-teal-dark transition-colors hover:bg-brand-teal-soft"
          >
            Get your referral code
          </button>
          {showSoon && (
            <p className={landscape ? "-mt-[4px] text-xs text-[#9AA3B2]" : "-mt-[4px] text-center text-xs text-[#9AA3B2]"}>
              Referral codes are coming soon — stay tuned.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

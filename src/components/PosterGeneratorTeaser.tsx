"use client";

import Link from "next/link";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon } from "./icons";

/**
 * Teaser for the Poster Generator page — an animated illustration (pure CSS,
 * see .poster-teaser-* in globals.css): a small job posting is scanned,
 * turns into a 9:16 poster that draws itself in, shines, and is marked
 * "Ready" — standing in for the feature without a screenshot.
 * `layout="portrait"` (the original sidebar card: visual on top, text below)
 * or `"landscape"` (visual on the left, text and the button on the right —
 * a wide, short row, for the navbar's Tools dropdown). The animation itself
 * is untouched either way; only the surrounding layout changes.
 */
export default function PosterGeneratorTeaser({ layout = "portrait" }: { layout?: "portrait" | "landscape" }) {
  const landscape = layout === "landscape";
  return (
    <div className={gradientFrameClass("teal")}>
      <div className={landscape ? "flex items-center gap-[14px] rounded-[19px] bg-white p-[12px]" : "flex flex-col gap-[12px] rounded-[19px] bg-white p-[16px]"}>
        <div
          aria-hidden
          className={`relative flex h-[140px] items-center justify-center overflow-hidden rounded-[14px] bg-[#F8FAFB] ${
            landscape ? "w-[190px] shrink-0" : ""
          }`}
        >
          {/* A mini job posting, with a scan light reading it */}
          <div className="poster-teaser-posting absolute flex w-[156px] flex-col gap-[7px] overflow-hidden rounded-[12px] border border-[#EEF1F5] bg-white p-[10px] shadow-[0_6px_18px_-6px_rgba(20,27,46,0.08)]">
            <div className="flex items-center gap-[7px]">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-brand-teal-soft text-brand-teal-dark">
                <BuildingIcon className="h-[12px] w-[12px]" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="truncate text-[10px] font-semibold text-[#141B2E]/75">Frontend Engineer</p>
                <p className="mt-[2px] truncate text-[8px] text-[#9AA3B2]">Brightwave · Kuala Lumpur</p>
              </div>
            </div>
            <div className="flex gap-[4px]">
              <span className="rounded-full bg-[#F1F4F8] px-[6px] py-[2px] text-[8px] leading-none text-[#4B5468]/80">Full-time</span>
              <span className="rounded-full bg-[#F1F4F8] px-[6px] py-[2px] text-[8px] leading-none text-[#4B5468]/80">Hybrid</span>
            </div>
            <p className="text-[9px] font-medium leading-none text-brand-teal-dark/80">RM 5,000 – 8,000 / month</p>
            <div className="poster-teaser-scan absolute inset-y-0 left-0 w-[40%] bg-gradient-to-r from-transparent via-brand-teal/15 to-transparent" />
          </div>

          {/* 9:16 poster: rises in, draws its lines, shines, then "Ready" */}
          <div className="poster-teaser-poster absolute">
            <div
              className="relative flex aspect-[9/16] h-[120px] flex-col items-center gap-[6px] overflow-hidden rounded-[12px] p-[8px] shadow-[0_8px_20px_-8px_rgba(0,137,144,0.25)]"
              style={{ background: "linear-gradient(180deg, #7FD3D9, #C2EEF1)" }}
            >
              <div className="poster-teaser-line poster-teaser-line-1 h-[7px] w-[55%] rounded-full bg-[#FFF3CF]" />
              <div className="mt-[4px] flex h-full w-full flex-col items-center justify-center gap-[5px] rounded-[9px] bg-white/95 p-[8px]">
                <div className="poster-teaser-line poster-teaser-line-2 h-[6px] w-[75%] rounded-full bg-[#4B5468]/45" />
                <div className="poster-teaser-line poster-teaser-line-3 h-[5px] w-[60%] rounded-full bg-[#DDE2E9]" />
                <div className="poster-teaser-line poster-teaser-line-4 h-[5px] w-[50%] rounded-full bg-[#DDE2E9]" />
                <div className="poster-teaser-line poster-teaser-line-5 mt-[4px] h-[9px] w-[65%] rounded-full bg-brand-teal-soft" />
              </div>
              <div className="poster-teaser-shine pointer-events-none absolute -inset-y-[20%] left-0 w-[45%] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </div>
            <span className="poster-teaser-ready absolute -right-[30px] -top-[8px] flex items-center gap-[3px] rounded-full border border-white bg-brand-teal-soft px-[7px] py-[3px] text-[10px] font-medium text-brand-teal-dark shadow-[0_4px_12px_-4px_rgba(0,137,144,0.25)]">
              <svg viewBox="0 0 12 12" className="h-[9px] w-[9px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2.5 6.2 2.2 2.2 4.8-4.9" />
              </svg>
              Ready
            </span>
          </div>
        </div>

        <div className={landscape ? "flex min-w-0 flex-1 flex-col gap-[10px]" : "contents"}>
          <div>
            <p className="text-sm text-[#141B2E]">Poster generator</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Turn any active posting into a ready-to-share social media poster.
            </p>
          </div>

          <Link
            href="/employer/jobs/poster-generator"
            className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90"
          >
            Create a poster
          </Link>
        </div>
      </div>
    </div>
  );
}

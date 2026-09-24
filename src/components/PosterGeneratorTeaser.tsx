"use client";

import Link from "next/link";
import { gradientFrameClass } from "./formStyles";

/**
 * Sidebar teaser for the Poster Generator page — an animated illustration
 * (pure CSS, see .poster-teaser-* in globals.css) crossfading a small "job
 * posting" summary card into a small 9:16 "poster" card, standing in for the
 * feature without a static screenshot or a hand-drawn SVG asset.
 */
export default function PosterGeneratorTeaser() {
  return (
    <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[12px] rounded-[19px] bg-white p-[16px]">
        <div className="relative flex h-[140px] items-center justify-center overflow-hidden rounded-[14px] bg-[#F8FAFB]">
          {/* Job posting mini card */}
          <div className="poster-teaser-posting absolute flex w-[150px] flex-col gap-[6px] rounded-[10px] border border-[#EAEDF2] bg-white p-[10px] shadow-[0_2px_6px_rgba(20,27,46,0.06)]">
            <div className="h-[8px] w-[70%] rounded-full bg-[#141B2E]/80" />
            <div className="h-[6px] w-[50%] rounded-full bg-[#C7CDD7]" />
            <div className="h-[6px] w-[40%] rounded-full bg-[#C7CDD7]" />
            <div className="mt-[2px] h-[14px] w-[45%] rounded-full bg-[#E6F9FA]" />
          </div>

          {/* Poster mini card */}
          <div
            className="poster-teaser-poster absolute flex aspect-[9/16] h-[120px] flex-col items-center gap-[6px] rounded-[10px] p-[8px] shadow-[0_4px_10px_rgba(0,137,144,0.25)]"
            style={{ background: "linear-gradient(180deg, #008990, #07BCCA)" }}
          >
            <div className="h-[7px] w-[55%] rounded-full bg-[#FFE9A6]" />
            <div className="mt-[4px] flex h-full w-full flex-col items-center justify-center gap-[5px] rounded-[8px] bg-white p-[8px]">
              <div className="h-[6px] w-[75%] rounded-full bg-[#141B2E]/80" />
              <div className="h-[5px] w-[60%] rounded-full bg-[#C7CDD7]" />
              <div className="h-[5px] w-[50%] rounded-full bg-[#C7CDD7]" />
              <div className="mt-[4px] h-[9px] w-[65%] rounded-full bg-[#E6F9FA]" />
            </div>
          </div>
        </div>

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
  );
}

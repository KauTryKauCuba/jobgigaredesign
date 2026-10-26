"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon } from "./icons";
import VerifiedBadge from "./VerifiedBadge";

export type CompanyAdCardData = {
  mediaType: "image" | "video";
  mediaUrl: string;
  headline: string;
  companyId?: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyIndustry?: string | null;
  companyVerified?: boolean;
};

/**
 * One company advertisement, exactly as it appears in the employer landing
 * page's ads section — also used for the live preview on the employer's
 * Advertisement page, so the two can't drift apart. Videos play muted on a
 * loop, only while the card is on screen — and, in the carousel, only for
 * the card in the middle (`playing`).
 */
export default function CompanyAdCard({
  ad,
  linked = true,
  playing = true,
}: {
  ad: CompanyAdCardData;
  linked?: boolean;
  playing?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ad.mediaUrl, playing]);

  // The whole card is 16:9 — the logo and headline sit over the bottom of
  // the media on a dark fade, like a video thumbnail.
  const body = (
    <>
      {ad.mediaType === "video" ? (
        <video
          ref={videoRef}
          key={ad.mediaUrl}
          src={ad.mediaUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.mediaUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/70 via-black/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-[10px] p-[14px]">
        <div className="relative h-[48px] w-[48px] shrink-0">
          {ad.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.companyLogoUrl} alt="" className="h-full w-full rounded-[10px] bg-white object-contain p-[3px]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-brand-teal-soft text-brand-teal-dark">
              <BuildingIcon className="h-[20px] w-[20px]" />
            </div>
          )}
          {ad.companyVerified && <VerifiedBadge size={15} />}
        </div>
        <div className="min-w-0 flex-1 text-white">
          <p className="line-clamp-2 text-sm font-semibold leading-[18px] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            {ad.headline}
          </p>
          <p className="mt-[2px] truncate text-xs text-white/80">
            {[ad.companyName, ad.companyIndustry].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    </>
  );

  // The employer gradient frame (teal), with the media clipped inside it.
  const cardClass = `group relative block aspect-[16/9] w-full ${gradientFrameClass("teal")}`;
  const inner = <div className="relative h-full w-full overflow-hidden rounded-[19px] bg-[#E9EEF2]">{body}</div>;

  return linked && ad.companyId ? (
    <Link href={`/companies/${ad.companyId}`} className={`${cardClass} transition-transform hover:-translate-y-[2px]`}>
      {inner}
    </Link>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}

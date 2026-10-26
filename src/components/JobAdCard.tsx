"use client";

import { useEffect, useRef } from "react";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon } from "./icons";
import VerifiedBadge from "./VerifiedBadge";

export type JobAdCardData = {
  mediaType: "image" | "video";
  mediaUrl: string;
  jobTitle: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyVerified?: boolean;
  location: string;
  jobType: string;
};

/**
 * One featured job, exactly as it appears above the jobseeker page's job
 * search — the employer's square artwork with the job's own details in a
 * strip below, so the details are always right even when the artwork has
 * little text. Also used for the employer's live preview and the superadmin
 * review list, so the three can't drift apart. Videos play muted on a loop,
 * only while the card is on screen — and, in the carousel, only for the card
 * in the middle (`playing`). The details strip is a fixed JOB_AD_STRIP_HEIGHT,
 * so a card is always its width plus that.
 */
export const JOB_AD_STRIP_HEIGHT = 78;

export default function JobAdCard({
  ad,
  onSelect,
  playing = true,
}: {
  ad: JobAdCardData;
  onSelect?: () => void;
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
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ad.mediaUrl, playing]);

  const body = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-[#E9EEF2]">
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
        <span className="absolute left-[10px] top-[10px] rounded-full bg-white/90 px-[9px] py-[3px] text-[11px] text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          Featured
        </span>
      </div>
      <div className="flex items-center gap-[10px] px-[12px]" style={{ height: JOB_AD_STRIP_HEIGHT }}>
        <div className="relative h-[38px] w-[38px] shrink-0">
          {ad.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.companyLogoUrl}
              alt=""
              className="h-full w-full rounded-[10px] border border-black/[0.06] bg-white object-contain p-[3px]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-brand-gold-soft text-brand-gold-dark">
              <BuildingIcon className="h-[16px] w-[16px]" />
            </div>
          )}
          {ad.companyVerified && <VerifiedBadge size={13} />}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-[#141B2E]">{ad.jobTitle}</p>
          <p className="truncate text-xs text-[#4B5468]">{ad.companyName}</p>
          <p className="mt-[1px] truncate text-xs text-[#9AA3B2]">
            {ad.location} · {ad.jobType}
          </p>
        </div>
      </div>
    </>
  );

  // The jobseeker gradient frame (gold), with the card clipped inside it.
  const cardClass = `block w-full ${gradientFrameClass("gold")}`;
  const inner = <div className="overflow-hidden rounded-[19px] bg-white">{body}</div>;

  return onSelect ? (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${ad.jobTitle} at ${ad.companyName}`}
      className={`${cardClass} transition-transform hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-dark`}
    >
      {inner}
    </button>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}

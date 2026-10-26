"use client";

import { useState } from "react";
import { XIcon } from "./icons";
import type { ThemeBanner } from "@/lib/site-themes-shared";

/** The strip itself — also drawn inside the superadmin editor's preview. */
export function ThemeBannerStrip({
  banner,
  onClose,
  compact = false,
}: {
  banner: ThemeBanner;
  onClose?: () => void;
  compact?: boolean;
}) {
  const external = /^https:\/\//.test(banner.linkUrl);
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative z-[21] text-white"
      // --theme-deep / --theme-main are set by the live theme (SiteThemeLayer)
      // or by the editor preview's wrapper.
      style={{ backgroundImage: "linear-gradient(90deg, var(--theme-deep), var(--theme-main))" }}
    >
      <div
        className={`mx-auto flex max-w-[1600px] items-center justify-center gap-[10px] ${
          compact ? "px-[12px] py-[8px] pr-[40px]" : "px-[16px] py-[10px] pr-[48px] sm:px-[32px]"
        }`}
      >
        {banner.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.imageUrl} alt="" className="h-[28px] w-[28px] shrink-0 object-contain" />
        ) : (
          banner.emoji && (
            <span aria-hidden className="shrink-0 text-lg leading-none">
              {banner.emoji}
            </span>
          )
        )}
        <p className="min-w-0 text-sm leading-[20px]">{banner.text}</p>
        {banner.linkUrl && banner.linkLabel && (
          <a
            href={banner.linkUrl}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="shrink-0 whitespace-nowrap rounded-full bg-white px-[12px] py-[4px] text-xs text-[#141B2E] hover:opacity-90"
          >
            {banner.linkLabel}
          </a>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss announcement"
          className="absolute top-1/2 right-[10px] flex h-[28px] w-[28px] -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
        >
          <XIcon className="h-[12px] w-[12px]" />
        </button>
      )}
    </div>
  );
}

/**
 * A live theme's banner, above the navbar. Dismissing it is remembered in a
 * cookie (read on the server, so it never flashes back on the next page)
 * until the superadmin changes the theme.
 */
export default function SiteThemeBanner({
  banner,
  cookieName,
  version,
}: {
  banner: ThemeBanner;
  cookieName: string;
  version: string | null;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <ThemeBannerStrip
      banner={banner}
      onClose={
        version
          ? () => {
              document.cookie = `${cookieName}=${encodeURIComponent(version)}; path=/; max-age=31536000; samesite=lax`;
              setOpen(false);
            }
          : () => setOpen(false)
      }
    />
  );
}

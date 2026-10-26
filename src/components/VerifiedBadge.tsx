"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// A checkmark badge for a verified company's logo — earned once a superadmin
// approves the SSM document uploaded in onboarding/Company Profile (see
// ssmVerificationStatus on employerProfiles).

/** Flat icon for inline status pills (fill follows the text colour). */
export function VerifiedBadgeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M6.2 10.3l2.3 2.3 5.3-5.3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const noopSubscribe = () => () => {};

// A sharp 12-point star seal: straight edges alternating between an outer
// (tip) and inner (notch) radius.
const STAR_SEAL = (() => {
  const tips = 12;
  const points = Array.from({ length: tips * 2 }, (_, i) => {
    const t = (i / (tips * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 11.2 : 8.9;
    return `${(12 + r * Math.sin(t)).toFixed(2)} ${(12 - r * Math.cos(t)).toFixed(2)}`;
  });
  return `M${points.join("L")}Z`;
})();

// The same seal in two meanings: a verified business (teal, on logos) and a
// verified phone number (green, on people's avatars).
const VARIANTS = {
  business: {
    stops: ["#2FD3DE", "#07BCCA", "#008990"],
    label: "Verified business",
    iconClass: "text-brand-teal",
    detail: "JobGiga has checked this company’s SSM registration against its official business registration document.",
  },
  phone: {
    stops: ["#5EE08F", "#2FB35F", "#1F7A40"],
    label: "Phone verified",
    iconClass: "text-[#3DCB72]",
    detail: "This person confirmed their phone number with a one-time code sent to it.",
  },
} as const;

/**
 * Overlay badge for the bottom-left corner of a logo or avatar (parent must
 * be `relative`). Glossy, with the same looping light sweep as the
 * achievement medals, and a tooltip on hover/focus explaining what it means.
 * The tooltip is portalled to <body> because the logo usually sits inside a
 * card that clips its overflow.
 */
export default function VerifiedBadge({
  size = 16,
  className = "",
  variant = "business",
  // "logo" sits inside a square logo's corner; "avatar" sits on a round
  // avatar's edge; "inline" sits in a line of text.
  placement = "logo",
  // false inside another control (e.g. the navbar's account button): no
  // focus stop or rich tooltip of its own — just a plain hover title.
  tooltip = true,
}: {
  size?: number;
  className?: string;
  variant?: keyof typeof VARIANTS;
  placement?: "logo" | "avatar" | "inline";
  tooltip?: boolean;
}) {
  const look = VARIANTS[variant];
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function show() {
    if (ref.current) setAnchor(ref.current.getBoundingClientRect());
  }
  function hide() {
    setAnchor(null);
  }

  useEffect(() => {
    if (!anchor) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [anchor]);

  const TOOLTIP_WIDTH = 240;
  const left = anchor
    ? Math.min(Math.max(anchor.left + anchor.width / 2 - TOOLTIP_WIDTH / 2, 8), window.innerWidth - TOOLTIP_WIDTH - 8)
    : 0;
  const below = anchor ? anchor.top < 120 : false;

  return (
    <>
      <span
        ref={ref}
        tabIndex={tooltip ? 0 : undefined}
        role="img"
        aria-label={look.label}
        title={tooltip ? undefined : look.label}
        onMouseEnter={tooltip ? show : undefined}
        onMouseLeave={tooltip ? hide : undefined}
        onFocus={tooltip ? show : undefined}
        onBlur={tooltip ? hide : undefined}
        className={`verified-badge rounded-full outline-none ${
          placement === "inline"
            ? "relative inline-block shrink-0 align-middle"
            : placement === "avatar"
              ? "absolute block -bottom-[3px] -left-[3px]"
              : "absolute block bottom-[5px] left-[5px]"
        } ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full overflow-visible" aria-hidden focusable="false">
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={look.stops[0]} />
              <stop offset="55%" stopColor={look.stops[1]} />
              <stop offset="100%" stopColor={look.stops[2]} />
            </linearGradient>
            <radialGradient id={`${id}-gloss`} cx="35%" cy="28%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <path d={STAR_SEAL} />
            </clipPath>
          </defs>

          {/* White halo so it reads cleanly over any logo */}
          <path d={STAR_SEAL} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="miter" strokeMiterlimit="10" />
          <path d={STAR_SEAL} fill={`url(#${id}-fill)`} />
          <path d={STAR_SEAL} fill={`url(#${id}-gloss)`} />
          <g clipPath={`url(#${id}-clip)`}>
            <rect
              x="-12"
              y="-12"
              width="48"
              height="48"
              fill={`url(#${id}-shine)`}
              className="badge-shine"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          </g>
          <path
            d="M8 12.3l2.8 2.8 5.3-5.6"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {mounted &&
        anchor &&
        createPortal(
          <div
            role="tooltip"
            className="verified-badge-tooltip pointer-events-none fixed z-[60] rounded-[12px] bg-[#141B2E] px-[12px] py-[10px] text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]"
            style={{
              width: TOOLTIP_WIDTH,
              left,
              top: below ? anchor.bottom + 8 : anchor.top - 8,
              transform: below ? undefined : "translateY(-100%)",
            }}
          >
            <p className="flex items-center gap-[6px] text-xs font-semibold text-white">
              <VerifiedBadgeIcon className={`h-[13px] w-[13px] ${look.iconClass}`} />
              {look.label}
            </p>
            <p className="mt-[4px] text-xs leading-[17px] text-white/75">{look.detail}</p>
          </div>,
          document.body,
        )}
    </>
  );
}

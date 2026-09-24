"use client";

import Image from "next/image";
import { useScrollStack } from "@/hooks/useScrollStack";
import { getStackOffset, getStackStyle } from "@/lib/badgeStack";

export type Badge = {
  id: string;
  label: string;
  src: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  duration: string;
  delay: string;
};

export default function FloatingBadges({ badges }: { badges: Badge[] }) {
  const { ref, progress } = useScrollStack();

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] mx-auto hidden max-w-[1300px] md:block"
    >
      {badges.map((badge, i) => (
        <div
          key={badge.id}
          className="absolute will-change-transform"
          style={{
            top: badge.top,
            left: badge.left,
            right: badge.right,
            bottom: badge.bottom,
            ...getStackStyle(progress, getStackOffset(i)),
          }}
        >
          <div
            className="float-bob flex items-center gap-[8px] rounded-full border border-[#EAEDF2] bg-white p-[5px] shadow-[0_8px_20px_rgba(20,27,46,0.1)] lg:py-[6px] lg:pr-[16px]"
            style={{ animationDuration: badge.duration, animationDelay: badge.delay }}
          >
            <span className="relative block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full lg:h-[38px] lg:w-[38px]">
              <Image src={badge.src} alt="" fill sizes="38px" className="object-cover" />
            </span>
            <span className="hidden whitespace-nowrap text-xs text-[#141B2E] lg:inline">
              {badge.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

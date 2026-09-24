"use client";

import { useScrollStack } from "@/hooks/useScrollStack";
import { getStackOffset, getStackStyle } from "@/lib/badgeStack";

type Posting = {
  id: string;
  name: string;
  targetRole: string;
  photo: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  duration: string;
  delay: string;
};

// Onboarding-only badge set: kept separate from JobPostingBadges (the
// landing page's version) so tuning this doesn't touch the landing page.
// Positioned within this component's own fixed-height wrapper rather than
// the full hero, since the hero here grows tall with the onboarding form —
// spreading badges across that height would push most of them down behind
// the form instead of around the heading.
const POSTINGS: Posting[] = [
  {
    id: "graphic-designer",
    name: "Farah Aina",
    targetRole: "Graphic Designer",
    photo: "https://i.pravatar.cc/300?img=47",
    top: "4%",
    left: "2%",
    duration: "5.4s",
    delay: "0s",
  },
  {
    id: "hr-manager",
    name: "Ahmad Rahman",
    targetRole: "HR Manager",
    photo: "https://i.pravatar.cc/300?img=12",
    top: "4%",
    right: "2%",
    duration: "6.1s",
    delay: "0.6s",
  },
  {
    id: "software-engineer",
    name: "Wei Ling Tan",
    targetRole: "Software Engineer",
    photo: "https://i.pravatar.cc/300?img=32",
    bottom: "6%",
    left: "8%",
    duration: "5.8s",
    delay: "1.1s",
  },
  {
    id: "sales-executive",
    name: "Priya Kumar",
    targetRole: "Sales Executive",
    photo: "https://i.pravatar.cc/300?img=45",
    bottom: "6%",
    right: "8%",
    duration: "6.4s",
    delay: "0.3s",
  },
];

export default function JobseekerOnboardingBadges() {
  const { ref, progress } = useScrollStack();

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] mx-auto hidden h-[300px] max-w-[1300px] md:block"
    >
      {POSTINGS.map((posting, i) => (
        <div
          key={posting.id}
          className="absolute will-change-transform"
          style={{
            top: posting.top,
            left: posting.left,
            right: posting.right,
            bottom: posting.bottom,
            ...getStackStyle(progress, getStackOffset(i)),
          }}
        >
          <div
            className="float-bob flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-white p-[8px] shadow-[0_8px_20px_rgba(20,27,46,0.1)] lg:py-[9px] lg:pr-[16px]"
            style={{ animationDuration: posting.duration, animationDelay: posting.delay }}
          >
            <span className="relative block h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full lg:h-[34px] lg:w-[34px]">
              <img src={posting.photo} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="hidden flex-col lg:flex">
              <span className="whitespace-nowrap text-xs text-[#141B2E]">
                {posting.name}
              </span>
              <span className="whitespace-nowrap text-xs text-[#9AA3B2]">
                {posting.targetRole}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

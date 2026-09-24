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

const POSTINGS: Posting[] = [
  {
    id: "graphic-designer",
    name: "Farah Aina",
    targetRole: "Graphic Designer",
    photo: "https://i.pravatar.cc/300?img=47",
    top: "6%",
    left: "3%",
    duration: "5.4s",
    delay: "0s",
  },
  {
    id: "hr-manager",
    name: "Ahmad Rahman",
    targetRole: "HR Manager",
    photo: "https://i.pravatar.cc/300?img=12",
    top: "16%",
    right: "4%",
    duration: "6.1s",
    delay: "0.6s",
  },
  {
    id: "software-engineer",
    name: "Wei Ling Tan",
    targetRole: "Software Engineer",
    photo: "https://i.pravatar.cc/300?img=32",
    top: "52%",
    left: "1%",
    duration: "5.8s",
    delay: "1.1s",
  },
  {
    id: "sales-executive",
    name: "Priya Kumar",
    targetRole: "Sales Executive",
    photo: "https://i.pravatar.cc/300?img=45",
    top: "58%",
    right: "2%",
    duration: "6.4s",
    delay: "0.3s",
  },
  {
    id: "warehouse-supervisor",
    name: "Danial Hafiz",
    targetRole: "Warehouse Supervisor",
    photo: "https://i.pravatar.cc/300?img=14",
    bottom: "4%",
    left: "16%",
    duration: "5.6s",
    delay: "1.4s",
  },
  {
    id: "customer-service",
    name: "Nurul Izzati",
    targetRole: "Customer Service Exec.",
    photo: "https://i.pravatar.cc/300?img=25",
    bottom: "8%",
    right: "15%",
    duration: "6.7s",
    delay: "0.8s",
  },
  {
    id: "warehouse-assistant",
    name: "Chee Keong Lim",
    targetRole: "Warehouse Assistant",
    photo: "https://i.pravatar.cc/300?img=53",
    top: "34%",
    left: "9%",
    duration: "6.0s",
    delay: "0.5s",
  },
  {
    id: "marketing-executive",
    name: "Siti Batrisyia",
    targetRole: "Marketing Executive",
    photo: "https://i.pravatar.cc/300?img=48",
    bottom: "22%",
    right: "10%",
    duration: "6.3s",
    delay: "0.2s",
  },
];

// The convergence point (STACK_OFFSETS' dy) normally lands just below the
// headline, where the ribbon used to sit immediately after the hero.
// JobseekerHowItWorks now sits in between, so the badges need this much
// extra downward travel to still converge at the ribbon instead of
// vanishing mid-section — tuned to roughly that section's height.
const EXTRA_DY = 560;

export default function JobPostingBadges() {
  // Default distance (420) assumes the ribbon sits right below the hero —
  // JobseekerHowItWorks now sits between them, pushing the ribbon further
  // down, so the convergence needs more scroll room to still finish exactly
  // as the ribbon reaches the badges instead of fading out beforehand.
  const { ref, progress } = useScrollStack(950);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] mx-auto hidden max-w-[1300px] md:block"
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
            ...getStackStyle(progress, getStackOffset(i, EXTRA_DY)),
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

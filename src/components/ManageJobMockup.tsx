"use client";

import { useRef } from "react";
import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { CheckIcon, EyeIcon, TrendUpIcon, UsersIcon } from "./icons";
import { useMockupStep } from "./mockupAnimation";

// Same status colors as Manage Job's STATUS_TILE_COLOR (EmployerJobsView.tsx),
// so a pill/tile means the same thing here as it does on the real page.
const TONE = {
  active: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
  pending: { bg: "bg-[#FFF3D6]", text: "text-[#A67C00]" },
  draft: { bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]" },
};

// The demo's timeline: TICKS "live" updates (views/applicants ticking up),
// with the pending posting approved at APPROVE_AT, then a hold before looping.
const TICKS = 12;
const APPROVE_AT = 6;
const DURATIONS = [900, ...Array.from({ length: TICKS - 1 }, () => 650), 2800];

/** A number that briefly "bumps" (highlight + pop) whenever it changes. */
function Live({ value }: { value: number | string }) {
  return (
    <span key={value} className="mock-bump inline-block tabular-nums">
      {value}
    </span>
  );
}

/**
 * A small animated recreation of Manage Job — every posting's views and
 * applicants tick up live, the top posting's "+N today" climbs, and the
 * pending posting gets approved mid-loop (Pending → Active, with the
 * Pipeline counts following). Loops while on screen; shows the finished
 * state without motion for prefers-reduced-motion.
 */
export default function ManageJobMockup() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const step = useMockupStep(rootRef, DURATIONS);
  const tick = Math.min(step, TICKS);
  const approved = tick >= APPROVE_AT;
  const sinceApproval = Math.max(0, tick - APPROVE_AT);

  const postings = [
    {
      title: "Sales Executive",
      meta: "Petaling Jaya, Selangor · Posted 4d ago",
      salary: "RM3,000–4,500",
      tone: "active" as const,
      status: "Active",
      views: 214 + tick * 4,
      applicants: 18 + Math.floor(tick / 3),
      trend: `+${12 + Math.floor(tick / 3)} today`,
    },
    {
      title: "Frontend Engineer",
      meta: "Cyberjaya · Posted 1w ago",
      salary: "RM5,500–8,000",
      tone: "active" as const,
      status: "Active",
      views: 356 + tick * 2,
      applicants: 27 + (tick >= 9 ? 1 : 0),
      trend: null,
    },
    {
      title: "Warehouse Associate",
      meta: approved ? "Shah Alam, Selangor · Approved just now" : "Shah Alam, Selangor · Posted today",
      salary: "RM2,200–2,800",
      tone: approved ? ("active" as const) : ("pending" as const),
      status: approved ? "Active" : "Pending",
      views: 42 + sinceApproval * 6,
      // Under review it can't take applicants yet — shown as a shimmer.
      applicants: approved ? Math.floor(sinceApproval / 2) : null,
      trend: null,
      justApproved: approved,
    },
    {
      title: "HR Manager",
      meta: "Kuala Lumpur · Saved as draft",
      salary: "RM4,500–6,000",
      tone: "draft" as const,
      status: "Draft",
      views: 0,
      applicants: 0,
      trend: null,
    },
  ];

  const pipeline = [
    { label: "Active", count: approved ? 4 : 3, tone: TONE.active, live: true },
    { label: "Pending", count: approved ? 0 : 1, tone: TONE.pending, live: false },
    { label: "Draft", count: 1, tone: TONE.draft, live: false },
  ];

  return (
    <div ref={rootRef} className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — same rationale as the other mockups' narrow
            side card: doesn't fit a phone-width card without overflowing. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Pipeline</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">At a glance.</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {pipeline.map((tile) => (
              <div
                key={tile.label}
                className={`flex items-center justify-between rounded-[8px] px-[8px] py-[6px] transition-opacity duration-500 ${tile.tone.bg} ${
                  tile.live ? "ai-fill-pulse" : ""
                } ${tile.count === 0 ? "opacity-50" : "opacity-100"}`}
              >
                <span className={`flex items-center gap-[5px] text-xs ${tile.tone.text}`}>
                  {tile.live && <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />}
                  {tile.label}
                </span>
                <span className={`text-xs ${tile.tone.text}`}>
                  <Live value={tile.count} />
                </span>
              </div>
            ))}
          </div>

          <p className="flex items-center gap-[5px] text-[11px] text-[#9AA3B2]">
            <span aria-hidden className="ai-fill-caret h-[5px] w-[5px] rounded-full bg-[#2F9E56]" />
            Updating live
          </p>
        </div>

        <div className={`${cardClass} flex flex-col gap-[8px]`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Your job postings</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Views, applicants, status — all in one place.</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {postings.map((p) => (
              <div
                key={p.title}
                className={`flex flex-col gap-[4px] rounded-[8px] border px-[8px] py-[6px] transition-colors duration-700 ${
                  p.justApproved && sinceApproval < 3 ? "border-brand-teal-dark/40 bg-[#F2FAF5]" : "border-black/[0.06] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-[6px]">
                  <span className="truncate text-xs text-[#141B2E]">{p.title}</span>
                  <span
                    key={p.status}
                    className={`mock-bump flex shrink-0 items-center gap-[3px] rounded-full px-[6px] py-[1.5px] text-xs ${TONE[p.tone].bg} ${TONE[p.tone].text}`}
                  >
                    {p.justApproved && <CheckIcon className="h-[8px] w-[8px]" />}
                    {p.status}
                  </span>
                </div>
                <p className="truncate text-xs text-[#9AA3B2]">{p.meta}</p>
                <p className="text-xs text-[#4B5468]">{p.salary}</p>
                <div className="flex items-center gap-[10px] text-xs text-[#9AA3B2]">
                  <span className="flex items-center gap-[3px]">
                    <EyeIcon className="h-[10px] w-[10px]" />
                    <Live value={p.views} />
                  </span>
                  <span className="flex items-center gap-[3px]">
                    <UsersIcon className="h-[10px] w-[10px]" />
                    {p.applicants === null ? (
                      <span className="ai-fill-shimmer inline-block h-[10px] w-[16px] rounded-full align-middle" />
                    ) : (
                      <Live value={p.applicants} />
                    )}
                  </span>
                  {p.trend && (
                    <span className="ml-auto flex items-center gap-[3px] rounded-full bg-[#E7F6EC] px-[6px] py-[1.5px] text-xs text-[#2F9E56]">
                      <TrendUpIcon className="h-[9px] w-[9px]" />
                      <Live value={p.trend} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

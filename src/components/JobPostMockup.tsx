"use client";

import { useRef } from "react";
import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { CheckIcon, UserIcon } from "./icons";
import { Reveal, useMockupStep } from "./mockupAnimation";
import SiriOrb from "./SiriOrb";

const PROMPT = "Looking for a friendly sales exec who’s great on the phone…";

const CANDIDATES = [
  { name: "Nur Aisyah", pct: 96 },
  { name: "Daniel Wong", pct: 88 },
  { name: "Priya Kumar", pct: 74 },
];

const POSTING_SECTIONS = 4;

// Same score bands as matchBand() in EmployerDashboardOverview.tsx/
// TopMatchesCard.tsx — a match badge's color means the same thing here as
// it does everywhere else a match score shows up.
function matchBandClass(pct: number): string {
  if (pct >= 80) return "bg-[#E7F6EC] text-[#2F9E56]";
  if (pct >= 60) return "bg-[#E6F9FA] text-[#008990]";
  return "bg-[#F1F4F8] text-[#4B5468]";
}

// The demo's timeline, as the delay (ms) before each step. Steps:
//   1..PROMPT.length       the description types itself in
//   WRITING                "Writing your job posting…"
//   SECTIONS (x4)          the posting fills in section by section
//   POSTED                 published — it appears in "Your job postings"
//   APPLICANTS (x3)        applicants arrive, ranked by fit
//   then a hold on the finished state before looping.
const TYPED_END = PROMPT.length;
const WRITING = TYPED_END + 1;
const FIRST_SECTION = WRITING + 1;
const POSTED = FIRST_SECTION + POSTING_SECTIONS;
const FIRST_APPLICANT = POSTED + 1;
const DURATIONS = [
  450,
  ...Array.from({ length: PROMPT.length - 1 }, () => 32),
  450, // -> writing
  1500, // -> first section
  ...Array.from({ length: POSTING_SECTIONS - 1 }, () => 420),
  500, // -> posted
  800, // -> first applicant
  ...Array.from({ length: CANDIDATES.length - 1 }, () => 550),
  2800, // hold, then loop
];

/**
 * A small animated recreation of the "create a job" flow — the employer
 * describes the role in their own words, AI writes the posting section by
 * section, it's published into "Your job postings", then applicants arrive
 * ranked by fit. Loops while on screen; shows the finished state without
 * motion for prefers-reduced-motion.
 */
export default function JobPostMockup() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const step = useMockupStep(rootRef, DURATIONS);

  const typed = Math.min(step, TYPED_END);
  const typing = step < WRITING;
  const writing = step >= WRITING && step < POSTED;
  const posted = step >= POSTED;
  const sectionShown = (i: number) => step >= FIRST_SECTION + i;
  const applicantsShown = Math.max(0, Math.min(CANDIDATES.length, step - FIRST_APPLICANT + 1));

  return (
    <div ref={rootRef} className="flex h-full w-full items-center justify-center p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — three columns of dense text don't fit a phone-width
            card; the other two cards carry the idea on their own there. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div className="flex items-start justify-between gap-[6px]">
            <div>
              <h3 className="text-xs font-semibold text-[#141B2E]">Applicants</h3>
              <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Ranked by fit.</p>
            </div>
            {applicantsShown > 0 && (
              <span className="rounded-full bg-[#E6F9FA] px-[6px] py-[1px] text-[11px] text-[#008990]">
                {applicantsShown} new
              </span>
            )}
          </div>

          <div className="flex flex-col gap-[6px]">
            {CANDIDATES.map((c, i) => (
              <Reveal
                key={c.name}
                shown={i < applicantsShown}
                skeleton={
                  <div className="flex items-center gap-[6px]">
                    <span className="h-[20px] w-[20px] shrink-0 rounded-full bg-[#F1F4F8]" />
                    <div className="h-[10px] flex-1 rounded-full bg-[#F1F4F8]" />
                  </div>
                }
              >
                <div className="flex items-center justify-between gap-[6px]">
                  <div className="flex min-w-0 items-center gap-[6px]">
                    <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#F1F4F8]">
                      <UserIcon className="h-[9px] w-[9px] text-[#9AA3B2]" />
                    </span>
                    <span className="truncate text-xs text-[#141B2E]">{c.name}</span>
                  </div>
                  <span className={`shrink-0 rounded-full px-[6px] py-[1.5px] text-xs ${matchBandClass(c.pct)}`}>{c.pct}%</span>
                </div>
              </Reveal>
            ))}
          </div>
          {applicantsShown === 0 && <p className="text-[11px] text-[#9AA3B2]">Waiting for your first applicants…</p>}
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={cardClass}>
            <h3 className="text-xs font-semibold text-[#141B2E]">Describe the role</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">
              Tell us who you&rsquo;re looking for, in your own words.
            </p>

            <div
              className={`mt-[8px] min-h-[29px] rounded-[8px] border bg-[#F8FAFB] px-[8px] py-[6px] text-xs leading-[15px] text-[#141B2E] transition-colors ${
                typing ? "border-brand-teal-dark" : "border-black/[0.1]"
              }`}
            >
              {PROMPT.slice(0, typed)}
              {typing && <span className="ai-fill-caret ml-[1px] inline-block h-[11px] w-px translate-y-[1px] bg-[#141B2E]" />}
            </div>

            <div
              className={`mt-[8px] flex h-[26px] items-center justify-center gap-[5px] rounded-[8px] text-xs text-white transition-all duration-500 ${
                posted ? "bg-[#2F9E56]" : "bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)]"
              } ${writing ? "ai-fill-pulse" : ""} ${typing ? "opacity-70" : "opacity-100"}`}
            >
              {posted ? (
                <>
                  <CheckIcon className="h-[9px] w-[9px]" />
                  Posted — now live
                </>
              ) : (
                <>
                  <SiriOrb className="h-[10px] w-[10px]" active={writing} />
                  {writing ? "Writing your job posting…" : "Write my job posting"}
                </>
              )}
            </div>

            <div className="mt-[12px] flex flex-col gap-[9px] border-t border-black/[0.06] pt-[12px]">
              <Reveal shown={sectionShown(0)} skeleton={<div className="ai-fill-shimmer h-[30px] w-[60%] rounded-[8px]" />}>
                <p className="text-xs font-semibold text-[#141B2E]">Sales Executive</p>
                <div className="mt-[4px] flex flex-wrap gap-[4px]">
                  {["Full-time", "Petaling Jaya", "RM 3,500 – 4,500"].map((chip) => (
                    <span key={chip} className="rounded-full bg-[#F1F4F8] px-[6px] py-[1px] text-[10px] text-[#4B5468]">
                      {chip}
                    </span>
                  ))}
                </div>
              </Reveal>
              <Reveal
                shown={sectionShown(1)}
                skeleton={<div className="ai-fill-shimmer h-[24px] w-[92%] rounded-[6px]" style={{ animationDelay: "0.12s" }} />}
              >
                <p className="text-[11px] leading-[14px] text-[#4B5468]">
                  Turn warm leads into happy customers over the phone and WhatsApp, in a friendly 8-person sales team.
                </p>
              </Reveal>
              <div className="grid grid-cols-2 gap-[10px]">
                <Reveal
                  shown={sectionShown(2)}
                  skeleton={<div className="ai-fill-shimmer h-[40px] rounded-[6px]" style={{ animationDelay: "0.24s" }} />}
                >
                  <p className="text-[11px] font-semibold text-[#141B2E]">What you&rsquo;ll do</p>
                  <ul className="mt-[2px] list-disc pl-[12px] text-[11px] leading-[14px] text-[#4B5468]">
                    <li>Follow up 30–40 leads a day</li>
                    <li>Hit targets, earn commission</li>
                  </ul>
                </Reveal>
                <Reveal
                  shown={sectionShown(3)}
                  skeleton={<div className="ai-fill-shimmer h-[40px] rounded-[6px]" style={{ animationDelay: "0.36s" }} />}
                >
                  <p className="text-[11px] font-semibold text-[#141B2E]">You&rsquo;ll need</p>
                  <ul className="mt-[2px] list-disc pl-[12px] text-[11px] leading-[14px] text-[#4B5468]">
                    <li>1+ year in sales or service</li>
                    <li>Fluent BM &amp; English</li>
                  </ul>
                </Reveal>
              </div>
            </div>
          </div>

          <div className={`${cardClass} flex flex-col gap-[8px]`}>
            <div>
              <h3 className="text-xs font-semibold text-[#141B2E]">Your job postings</h3>
              <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Everything in one place.</p>
            </div>

            <div className="flex flex-col gap-[6px]">
              {/* The new posting's slot is reserved from the start (an empty
                  dashed row) so publishing it never shifts the page layout. */}
              <Reveal
                shown={posted}
                skeleton={
                  <div className="flex h-[29px] items-center rounded-[8px] border border-dashed border-black/[0.12] px-[8px] text-[11px] text-[#9AA3B2]">
                    New posting will appear here
                  </div>
                }
              >
                <div className="flex items-center justify-between gap-[6px] rounded-[8px] border border-brand-teal-dark/30 bg-[#F2FAF5] px-[8px] py-[6px]">
                  <span className="truncate text-xs text-[#141B2E]">Sales Executive</span>
                  <div className="flex shrink-0 items-center gap-[6px]">
                    {applicantsShown > 0 && (
                      <span className="text-[11px] text-[#9AA3B2]">
                        {applicantsShown} applicant{applicantsShown === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="rounded-full bg-[#E6F9FA] px-[6px] py-[1.5px] text-xs text-[#008990]">Active</span>
                  </div>
                </div>
              </Reveal>
              <div className="flex items-center justify-between rounded-[8px] border border-black/[0.06] px-[8px] py-[6px]">
                <span className="truncate text-xs text-[#141B2E]">HR Manager</span>
                {/* Same Draft color as Manage Job's status tiles. */}
                <span className="shrink-0 rounded-full bg-[#F1ECFB] px-[6px] py-[1.5px] text-xs text-[#7C5CD1]">Draft</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

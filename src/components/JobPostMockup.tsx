import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { UserIcon } from "./icons";
import SiriOrb from "./SiriOrb";

const CANDIDATES = [
  { name: "Nur Aisyah", pct: 96, shimmer: false },
  { name: "Daniel Wong", pct: null, shimmer: true },
  { name: "Priya Kumar", pct: 74, shimmer: false },
];

const JOBS = [
  { title: "Sales Executive", status: "Active", tone: "active" as const },
  { title: "HR Manager", status: "Draft", tone: "draft" as const },
];

// Same status-tile colors as Manage Job's STATUS_TILE_COLOR
// (EmployerJobsView.tsx) — Draft is purple there, not gold.
const TONE_CLASS: Record<(typeof JOBS)[number]["tone"], string> = {
  active: "bg-[#E6F9FA] text-[#008990]",
  draft: "bg-[#F1ECFB] text-[#7C5CD1]",
};

// Same score bands as matchBand() in EmployerDashboardOverview.tsx/
// TopMatchesCard.tsx — a match badge's color means the same thing here as
// it does everywhere else a match score shows up.
function matchBandClass(pct: number): string {
  if (pct >= 80) return "bg-[#E7F6EC] text-[#2F9E56]";
  if (pct >= 60) return "bg-[#E6F9FA] text-[#008990]";
  return "bg-[#F1F4F8] text-[#4B5468]";
}

/**
 * A small, animated recreation of the full "create a job" flow — three
 * cards (Applicants / Describe the role / Your job postings), same
 * three-card composition as AiFillMockup, not a screenshot. The main card's
 * button pulses while "generating" and its drafted lines shimmer; the
 * Applicants card has one row mid-review. Pure CSS (see .ai-fill-* in
 * globals.css), respects prefers-reduced-motion.
 */
export default function JobPostMockup() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — three columns of dense text don't fit a phone-width
            card without overflowing; the other two cards carry the idea fine
            on their own at that size. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Applicants</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Ranked by fit.</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {CANDIDATES.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-[6px]">
                <div className="flex min-w-0 items-center gap-[6px]">
                  <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#F1F4F8]">
                    <UserIcon className="h-[9px] w-[9px] text-[#9AA3B2]" />
                  </span>
                  <span className="truncate text-xs text-[#141B2E]">{c.name}</span>
                </div>
                {c.shimmer || c.pct === null ? (
                  <div className="ai-fill-shimmer h-[13px] w-[34px] shrink-0 rounded-full" />
                ) : (
                  <span className={`shrink-0 rounded-full px-[6px] py-[1.5px] text-xs ${matchBandClass(c.pct)}`}>
                    {c.pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={cardClass}>
            <h3 className="text-xs font-semibold text-[#141B2E]">Describe the role</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">
              Tell us who you&rsquo;re looking for, in your own words.
            </p>

            <div className="mt-[8px] rounded-[8px] border border-black/[0.1] bg-[#F8FAFB] px-[8px] py-[6px] text-xs leading-[15px] text-[#141B2E]">
              Looking for a friendly sales exec who&rsquo;s great on the phone…
            </div>

            <div className="ai-fill-pulse mt-[8px] flex h-[26px] items-center justify-center gap-[5px] rounded-[8px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] text-xs text-white">
              <SiriOrb className="h-[10px] w-[10px]" active />
              Writing your job posting…
            </div>

            <div className="mt-[12px] flex flex-col gap-[7px] border-t border-black/[0.06] pt-[12px]">
              {[
                { w: "50%", h: 10 },
                { w: "88%", h: 7 },
                { w: "80%", h: 7 },
                { w: "68%", h: 7 },
                { w: "38%", h: 10 },
                { w: "84%", h: 7 },
                { w: "58%", h: 7 },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="ai-fill-shimmer rounded-full"
                  style={{ width: bar.w, height: bar.h, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          </div>

          <div className={`${cardClass} flex flex-col gap-[8px]`}>
            <div>
              <h3 className="text-xs font-semibold text-[#141B2E]">Your job postings</h3>
              <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Everything in one place.</p>
            </div>

            <div className="flex flex-col gap-[6px]">
              {JOBS.map((j, i) => (
                <div key={i} className="flex items-center justify-between rounded-[8px] border border-black/[0.06] px-[8px] py-[6px]">
                  <span className="truncate text-xs text-[#141B2E]">{j.title}</span>
                  <span className={`shrink-0 rounded-full px-[6px] py-[1.5px] text-xs ${TONE_CLASS[j.tone]}`}>
                    {j.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

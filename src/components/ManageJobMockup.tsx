import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { EyeIcon, TrendUpIcon, UsersIcon } from "./icons";

// Same status-tile colors as Manage Job's STATUS_TILE_COLOR
// (EmployerJobsView.tsx), so a pill/tile means the same thing here as it
// does on the real page.
const PIPELINE = [
  { label: "Active", count: 3, bg: "bg-[#E6F9FA]", text: "text-[#008990]", live: true },
  { label: "Pending", count: 1, bg: "bg-[#FFF3D6]", text: "text-[#A67C00]", live: false },
  { label: "Draft", count: 1, bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]", live: false },
];

const POSTINGS = [
  {
    title: "Sales Executive",
    posted: "Posted 4d ago",
    location: "Petaling Jaya, Selangor",
    salary: "RM3,000–4,500",
    status: "Active",
    tone: "bg-[#E6F9FA] text-[#008990]",
    views: 214,
    applicants: 18,
    trend: "+12 today",
    shimmer: false,
  },
  {
    title: "Frontend Engineer",
    posted: "Posted 1w ago",
    location: "Cyberjaya",
    salary: "RM5,500–8,000",
    status: "Active",
    tone: "bg-[#E6F9FA] text-[#008990]",
    views: 356,
    applicants: 27,
    trend: null,
    shimmer: false,
  },
  {
    title: "Warehouse Associate",
    posted: "Posted today",
    location: "Shah Alam, Selangor",
    salary: "RM2,200–2,800",
    status: "Pending",
    tone: "bg-[#FFF3D6] text-[#A67C00]",
    views: 42,
    applicants: 5,
    trend: null,
    shimmer: true,
  },
  {
    title: "HR Manager",
    posted: "Saved as draft",
    location: "Kuala Lumpur",
    salary: "RM4,500–6,000",
    status: "Draft",
    tone: "bg-[#F1ECFB] text-[#7C5CD1]",
    views: 0,
    applicants: 0,
    trend: null,
    shimmer: false,
  },
];

/**
 * A small, animated recreation of the Manage Job layout — two cards
 * (Pipeline / Your job postings), same composition as AiFillMockup/
 * JobPostMockup, not a screenshot. The Active pipeline tile softly pulses
 * (standing in for "tracked live"), the top posting's view count carries a
 * "+N today" trend chip, and the pending row's applicant count shimmers,
 * standing in for a fresh count still settling in. Pure CSS (see
 * .ai-fill-* in globals.css), respects prefers-reduced-motion.
 */
export default function ManageJobMockup() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — same rationale as the other mockups' narrow
            side card: doesn't fit a phone-width card without overflowing. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Pipeline</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">At a glance.</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {PIPELINE.map((tile) => (
              <div
                key={tile.label}
                className={`flex items-center justify-between rounded-[8px] px-[8px] py-[6px] ${tile.bg} ${
                  tile.live ? "ai-fill-pulse" : ""
                }`}
              >
                <span className={`flex items-center gap-[5px] text-xs ${tile.text}`}>
                  {tile.live && <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />}
                  {tile.label}
                </span>
                <span className={`text-xs ${tile.text}`}>{tile.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} flex flex-col gap-[8px]`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Your job postings</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">
              Views, applicants, status — all in one place.
            </p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {POSTINGS.map((p) => (
              <div
                key={p.title}
                className="flex flex-col gap-[4px] rounded-[8px] border border-black/[0.06] px-[8px] py-[6px]"
              >
                <div className="flex items-center justify-between gap-[6px]">
                  <span className="truncate text-xs text-[#141B2E]">{p.title}</span>
                  <span className={`shrink-0 rounded-full px-[6px] py-[1.5px] text-xs ${p.tone}`}>
                    {p.status}
                  </span>
                </div>
                <p className="truncate text-xs text-[#9AA3B2]">
                  {p.location} · {p.posted}
                </p>
                <p className="text-xs text-[#4B5468]">{p.salary}</p>
                <div className="flex items-center gap-[10px] text-xs text-[#9AA3B2]">
                  <span className="flex items-center gap-[3px]">
                    <EyeIcon className="h-[10px] w-[10px]" />
                    {p.views}
                  </span>
                  <span className="flex items-center gap-[3px]">
                    <UsersIcon className="h-[10px] w-[10px]" />
                    {p.shimmer ? (
                      <span className="ai-fill-shimmer inline-block h-[10px] w-[16px] rounded-full align-middle" />
                    ) : (
                      p.applicants
                    )}
                  </span>
                  {p.trend && (
                    <span className="ml-auto flex items-center gap-[3px] rounded-full bg-[#E7F6EC] px-[6px] py-[1.5px] text-xs text-[#2F9E56]">
                      <TrendUpIcon className="h-[9px] w-[9px]" />
                      {p.trend}
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

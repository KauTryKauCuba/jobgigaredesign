import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { CalendarIcon, UserIcon } from "./icons";

// Same response-status colors as INTERVIEW_RESPONSE_STATUS_COLOR
// (applicationStatus.ts), so a tile means the same thing here as it does on
// the real Interviews page.
const RESPONSE_TILES = [
  { label: "Pending", count: 2, bg: "bg-[#FFF3D6]", text: "text-brand-gold-dark", live: false },
  { label: "Accepted", count: 4, bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]", live: true },
  { label: "Attended", count: 3, bg: "bg-[#E6F9FA]", text: "text-[#008990]", live: false },
];

// Same Kanban column colors as EmployerInterviewsView.tsx's own column
// definitions (Scheduled/Interviewed/Evaluation/Evaluated).
const KANBAN_COLUMNS = [
  {
    label: "Scheduled",
    bg: "bg-[#F1ECFB]",
    text: "text-[#7C5CD1]",
    cards: [
      { name: "Nur Aisyah", detail: "Round 1 · Today 2:00 PM" },
      { name: "Priya Kumar", detail: "Round 2 · Tomorrow 10:00 AM" },
      { name: "Aiman Hafiz", detail: "Round 1 · Thu 3:30 PM" },
    ],
  },
  {
    label: "Interviewed",
    bg: "bg-[#E8F1FF]",
    text: "text-[#2B6CB0]",
    cards: [
      { name: "Daniel Wong", detail: "Round 1 · Awaiting evaluation" },
      { name: "Farah Aisyah", detail: "Round 2 · Awaiting evaluation" },
    ],
  },
];

const LIST_ROWS = [
  {
    name: "Nur Aisyah",
    detail: "Round 1 · Online · Today 2:00 PM",
    status: "Accepted",
    statusBg: "bg-[#E7F6EC]",
    statusText: "text-[#2F9E56]",
  },
  {
    name: "Priya Kumar",
    detail: "Round 2 · Onsite · Tomorrow 10:00 AM",
    status: "Pending",
    statusBg: "bg-[#FFF3D6]",
    statusText: "text-brand-gold-dark",
  },
  {
    name: "Daniel Wong",
    detail: "Round 1 · Online · Attended",
    status: "Attended",
    statusBg: "bg-[#E6F9FA]",
    statusText: "text-[#008990]",
  },
  {
    name: "Aiman Hafiz",
    detail: "Round 1 · Onsite · Thu 3:30 PM",
    status: "Reschedule",
    statusBg: "bg-[#FFEFE3]",
    statusText: "text-[#C2600A]",
  },
];

// Mon-first month grid, matching the real Interview Calendar's convention
// (InterviewBigCalendar) — blanks for the leading days before the 1st, dots
// mark the days with something scheduled, TODAY rings the current day.
const CALENDAR_WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const CALENDAR_LEADING_BLANKS = 4;
const CALENDAR_DAYS_IN_MONTH = 30;
const CALENDAR_TODAY = 12;
const CALENDAR_MARKED_DAYS = [3, 12, 18, 24];
const CALENDAR_UPCOMING = { name: "Nur Aisyah", detail: "Sep 18 · 2:00 PM · Round 1" };

/**
 * A small, animated recreation of the Interviews page's List/Kanban/
 * Calendar view toggle — same segmented-pill control as the real page
 * (EmployerInterviewsView), cycling through all three on a shared 12s CSS
 * timeline (see the mockup-view- and mockup-tab- rules in globals.css) so
 * the active tab and the panel below it always switch together. Same composition
 * style as the other mockups, not a screenshot; the "Accepted" response
 * tile softly pulses (standing in for "tracked live"). Respects
 * prefers-reduced-motion by freezing on List.
 */
export default function InterviewMockup() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — same rationale as the other mockups' narrow
            side card: doesn't fit a phone-width card without overflowing. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">Interviews</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">This week.</p>
          </div>

          <div className="flex flex-col gap-[6px]">
            {RESPONSE_TILES.map((tile) => (
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

        <div className={`${cardClass} flex flex-col gap-[10px]`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">See it your way</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">List, Kanban, or Calendar — same data.</p>
          </div>

          {/* Same segmented-pill control as the real page's List/Kanban/
              Calendar toggle (EmployerInterviewsView) — each label's
              highlight is driven by its own .mockup-tab-* animation,
              phase-matched to the panel below. */}
          <div aria-hidden className="flex h-[26px] items-center rounded-full border border-black/[0.1] p-[2px]">
            {[
              { label: "List", cls: "mockup-tab-list" },
              { label: "Kanban", cls: "mockup-tab-kanban" },
              { label: "Calendar", cls: "mockup-tab-calendar" },
            ].map((tab) => (
              <span
                key={tab.label}
                className={`flex h-full flex-1 items-center justify-center rounded-full text-[10px] capitalize ${tab.cls}`}
              >
                {tab.label}
              </span>
            ))}
          </div>

          <div className="relative h-[228px]">
            {/* List */}
            <div className="mockup-view-list absolute inset-0 flex flex-col gap-[8px]">
              {LIST_ROWS.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center gap-[8px] rounded-[8px] border border-black/[0.06] px-[10px] py-[9px]"
                >
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#F1F4F8]">
                    <UserIcon className="h-[9px] w-[9px] text-[#9AA3B2]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[#141B2E]">{row.name}</p>
                    <p className="truncate text-[10px] text-[#9AA3B2]">{row.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-[6px] py-[1.5px] text-[10px] ${row.statusBg} ${row.statusText}`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Kanban */}
            <div className="mockup-view-kanban absolute inset-0 grid grid-cols-2 gap-[8px]">
              {KANBAN_COLUMNS.map((col) => (
                <div key={col.label} className="flex flex-col gap-[6px] rounded-[8px] bg-[#F8FAFB] p-[8px]">
                  <span
                    className={`flex w-fit items-center gap-[4px] rounded-full px-[7px] py-[2px] text-[10px] ${col.bg} ${col.text}`}
                  >
                    {col.label}
                    <span className="opacity-70">{col.cards.length}</span>
                  </span>
                  <div className="flex flex-col gap-[5px]">
                    {col.cards.map((card) => (
                      <div
                        key={card.name}
                        className="rounded-[6px] border border-black/[0.06] bg-white px-[8px] py-[6px]"
                      >
                        <p className="truncate text-xs text-[#141B2E]">{card.name}</p>
                        <p className="truncate text-[10px] text-[#9AA3B2]">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar — a month grid (not just a week), same Mon-first
                convention as InterviewBigCalendar. Cells before the 1st and
                after the last day render as empty spacers so the grid keeps
                its shape without implying dates that don't exist. */}
            <div className="mockup-view-calendar absolute inset-0 flex flex-col gap-[6px]">
              <p className="flex items-center gap-[5px] text-xs text-[#141B2E]">
                <CalendarIcon className="h-[11px] w-[11px] text-[#9AA3B2]" />
                This month
              </p>
              <div className="grid grid-cols-7 gap-[3px]">
                {CALENDAR_WEEKDAY_LABELS.map((label, i) => (
                  <div key={i} className="text-center text-[9px] text-[#C7CDD7]">
                    {label}
                  </div>
                ))}
                {Array.from({ length: CALENDAR_LEADING_BLANKS }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: CALENDAR_DAYS_IN_MONTH }).map((_, i) => {
                  const day = i + 1;
                  const marked = CALENDAR_MARKED_DAYS.includes(day);
                  const today = day === CALENDAR_TODAY;
                  return (
                    <div
                      key={day}
                      className={`flex flex-col items-center justify-center gap-[2px] rounded-[5px] py-[2px] text-[9px] ${
                        marked ? "bg-[#F1ECFB] text-[#7C5CD1]" : "text-[#9AA3B2]"
                      } ${today ? "ring-1 ring-inset ring-brand-teal-dark" : ""}`}
                    >
                      {day}
                      {/* Always reserves the dot's space (opacity, not
                          conditional rendering) — otherwise rows with a
                          marked day are taller than rows without one, since
                          each row's height stretches to its tallest cell. */}
                      <span
                        aria-hidden
                        className={`h-[2px] w-[2px] rounded-full bg-current ${marked ? "" : "opacity-0"}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-[6px] rounded-[8px] border border-black/[0.06] px-[8px] py-[6px]">
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#F1ECFB]">
                  <UserIcon className="h-[9px] w-[9px] text-[#7C5CD1]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-[#141B2E]">{CALENDAR_UPCOMING.name}</p>
                  <p className="truncate text-[10px] text-[#9AA3B2]">{CALENDAR_UPCOMING.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

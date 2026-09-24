"use client";

import { useState } from "react";
import { ChevronDownIcon } from "./icons";
import type { InterviewDetails } from "@/lib/applicationStatus";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Same status colors as the applicant/status pills elsewhere in the app
// (APPLICATION_STATUS_COLOR in applicationStatus.ts) so an event chip's
// color means the same thing here as it does on the Applicants page.
const STATUS_CHIP: Record<string, { bg: string; text: string }> = {
  interview: { bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]" },
  interviewed: { bg: "bg-[#E8F1FF]", text: "text-[#2B6CB0]" },
  evaluation: { bg: "bg-[#FFE9D6]", text: "text-[#B45309]" },
  evaluated: { bg: "bg-[#EDFBF4]", text: "text-[#0F9D6C]" },
};

export type BigCalendarInterview = {
  applicationId: string;
  applicantName: string;
  jobPostingTitle: string;
  status: string;
  details: InterviewDetails;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday) — same convention
// as InterviewCalendarCard/DatePicker elsewhere in the app.
function mondayFirstDay(date: Date) {
  return (date.getDay() + 6) % 7;
}

const MAX_VISIBLE_PER_DAY = 3;

export default function InterviewBigCalendar({
  interviews,
  onSelectInterview,
  onScheduleDate,
}: {
  interviews: BigCalendarInterview[];
  onSelectInterview: (applicationId: string) => void;
  // Clicking a day's empty space (not one of its interview chips) opens the
  // scheduling picker pre-filled with that date, instead of making the
  // employer re-pick the date they just clicked on.
  onScheduleDate?: (date: Date) => void;
}) {
  const today = startOfDay(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  function goToMonth(delta: number) {
    let year = viewYear;
    let month = viewMonth + delta;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewYear(year);
    setViewMonth(month);
    setExpandedDay(null);
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setExpandedDay(null);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = mondayFirstDay(firstOfMonth);
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  type Cell = { day: number; inCurrentMonth: boolean; year: number; month: number };
  const cells: Cell[] = [];
  for (let i = leadingBlanks - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const month = viewMonth === 0 ? 11 : viewMonth - 1;
    const year = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day, inCurrentMonth: false, year, month });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inCurrentMonth: true, year: viewYear, month: viewMonth });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const month = viewMonth === 11 ? 0 : viewMonth + 1;
    const year = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: trailing, inCurrentMonth: false, year, month });
    trailing++;
  }

  const interviewsByDate = new Map<string, BigCalendarInterview[]>();
  for (const interview of interviews) {
    const d = new Date(interview.details.scheduledAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const list = interviewsByDate.get(key) ?? [];
    list.push(interview);
    interviewsByDate.set(key, list);
  }
  for (const list of interviewsByDate.values()) {
    list.sort((a, b) => new Date(a.details.scheduledAt).getTime() - new Date(b.details.scheduledAt).getTime());
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-[10px] pb-[16px]">
        <p className="text-base text-[#141B2E]">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </p>
        <div className="flex items-center gap-[4px]">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8]"
          >
            <ChevronDownIcon className="h-[11px] w-[11px] rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8]"
          >
            <ChevronDownIcon className="h-[11px] w-[11px] -rotate-90" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToToday}
          className="ml-auto rounded-full border border-black/[0.1] px-[14px] py-[6px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-[14px] border border-[#EAEDF2]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-b border-[#EAEDF2] bg-[#F8FAFB] px-[10px] py-[8px] text-center text-xs text-[#9AA3B2]">
            {label}
          </div>
        ))}

        {cells.map((cell, i) => {
          const isToday = cell.year === today.getFullYear() && cell.month === today.getMonth() && cell.day === today.getDate();
          const key = `${cell.year}-${cell.month}-${cell.day}`;
          const dayInterviews = interviewsByDate.get(key) ?? [];
          const isExpanded = expandedDay === i;
          const visibleInterviews = isExpanded ? dayInterviews : dayInterviews.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = dayInterviews.length - visibleInterviews.length;

          return (
            <div
              key={i}
              className={`group relative flex min-h-[110px] flex-col gap-[4px] border-b border-r border-[#EAEDF2] p-[6px] [&:nth-child(7n)]:border-r-0 ${
                cell.inCurrentMonth ? "bg-white" : "bg-[#FBFCFD]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-xs ${
                    isToday
                      ? "bg-brand-teal-dark text-white"
                      : cell.inCurrentMonth
                        ? "text-[#141B2E]"
                        : "text-[#D5DAE1]"
                  }`}
                >
                  {cell.day}
                </span>
                {onScheduleDate && (
                  <button
                    type="button"
                    onClick={() => onScheduleDate(new Date(cell.year, cell.month, cell.day))}
                    aria-label={`Schedule an interview on ${MONTH_LABELS[cell.month]} ${cell.day}, ${cell.year}`}
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-sm leading-none text-[#9AA3B2] opacity-0 transition-opacity hover:bg-[#F1ECFB] hover:text-[#7C5CD1] group-hover:opacity-100"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-[3px]">
                {visibleInterviews.map((interview) => {
                  const chip = STATUS_CHIP[interview.status] ?? STATUS_CHIP.interview;
                  return (
                    <button
                      key={interview.applicationId}
                      type="button"
                      onClick={() => onSelectInterview(interview.applicationId)}
                      title={`${interview.applicantName} — ${interview.jobPostingTitle}`}
                      className={`truncate rounded-[6px] px-[6px] py-[3px] text-left text-[11px] ${chip.bg} ${chip.text} hover:opacity-80`}
                    >
                      {new Date(interview.details.scheduledAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        // Pinned for server/client render parity — see the
                        // matching note in EmployerInterviewsView.tsx.
                        timeZone: "UTC",
                      })}{" "}
                      {interview.applicantName}
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedDay(i)}
                    className="truncate rounded-[6px] px-[6px] py-[2px] text-left text-[11px] text-[#9AA3B2] hover:text-[#141B2E]"
                  >
                    +{hiddenCount} more
                  </button>
                )}
                {isExpanded && dayInterviews.length > MAX_VISIBLE_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => setExpandedDay(null)}
                    className="truncate rounded-[6px] px-[6px] py-[2px] text-left text-[11px] text-[#9AA3B2] hover:text-[#141B2E]"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
        {(["interview", "interviewed", "evaluation", "evaluated"] as const).map((status) => (
          <div key={status} className="flex items-center gap-[6px]">
            <span className={`h-[8px] w-[8px] rounded-full ${STATUS_CHIP[status].bg}`} />
            <span className="text-xs text-[#4B5468] capitalize">
              {status === "interview" ? "Scheduled" : status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

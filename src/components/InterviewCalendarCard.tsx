"use client";

import { useState } from "react";
import { ChevronDownIcon, CalendarIcon } from "./icons";
import { INTERVIEW_MODE_LABEL, type InterviewDetails } from "@/lib/applicationStatus";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
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

export type CalendarInterview = {
  applicationId: string;
  applicantName: string;
  jobPostingTitle: string;
  details: InterviewDetails;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday), matching DatePicker.
function mondayFirstDay(date: Date) {
  return (date.getDay() + 6) % 7;
}

function isSameDay(a: Date, b: { year: number; month: number; day: number }) {
  return a.getFullYear() === b.year && a.getMonth() === b.month && a.getDate() === b.day;
}

export default function InterviewCalendarCard({
  interviews,
  onScheduleDate,
}: {
  interviews: CalendarInterview[];
  onScheduleDate?: (date: Date) => void;
}) {
  const today = startOfDay(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<{ year: number; month: number; day: number } | null>(null);

  const markedDays = new Set(
    interviews
      .map((i) => new Date(i.details.scheduledAt))
      .filter((d) => d.getFullYear() === viewYear && d.getMonth() === viewMonth)
      .map((d) => d.getDate()),
  );

  const selectedInterviews = selected
    ? interviews
        .filter((i) => isSameDay(new Date(i.details.scheduledAt), selected))
        .sort((a, b) => new Date(a.details.scheduledAt).getTime() - new Date(b.details.scheduledAt).getTime())
    : [];

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
    setSelected(null);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = mondayFirstDay(firstOfMonth);
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  type Cell = { day: number; inCurrentMonth: boolean };
  const cells: Cell[] = [];
  for (let i = leadingBlanks - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inCurrentMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: trailing, inCurrentMonth: false });
    trailing++;
  }

  return (
    <div>
      <div className="flex items-center gap-[8px]">
        <p className="text-sm text-[#141B2E]">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </p>
        <div className="ml-auto flex items-center gap-[4px]">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8]"
          >
            <ChevronDownIcon className="h-[10px] w-[10px] rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8]"
          >
            <ChevronDownIcon className="h-[10px] w-[10px] -rotate-90" />
          </button>
        </div>
      </div>

      <div className="mt-[14px] grid grid-cols-7 gap-y-[6px] text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <p key={i} className="text-xs text-[#9AA3B2]">
            {label}
          </p>
        ))}
        {cells.map((cell, i) => {
          const isToday =
            cell.inCurrentMonth && viewYear === today.getFullYear() && viewMonth === today.getMonth() && cell.day === today.getDate();
          const isSelected =
            cell.inCurrentMonth && !!selected && selected.year === viewYear && selected.month === viewMonth && selected.day === cell.day;
          const hasInterview = cell.inCurrentMonth && markedDays.has(cell.day);
          return (
            <div key={i} className="flex flex-col items-center gap-[2px]">
              <button
                type="button"
                disabled={!cell.inCurrentMonth}
                onClick={() =>
                  setSelected((prev) =>
                    prev && prev.year === viewYear && prev.month === viewMonth && prev.day === cell.day
                      ? null
                      : { year: viewYear, month: viewMonth, day: cell.day },
                  )
                }
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-[8px] text-sm transition-colors ${
                  !cell.inCurrentMonth
                    ? "cursor-default text-[#D5DAE1]"
                    : isSelected
                      ? "bg-[#7C5CD1] text-white"
                      : isToday
                        ? "bg-brand-teal-dark text-white"
                        : "text-[#141B2E] hover:bg-[#F1F4F8]"
                }`}
              >
                {cell.day}
              </button>
              <span
                className={`h-[4px] w-[4px] rounded-full ${hasInterview && !isSelected ? "bg-[#7C5CD1]" : "bg-transparent"}`}
              />
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <div className="flex items-center justify-between gap-[8px]">
            <p className="text-xs text-[#141B2E]">
              {MONTH_LABELS[selected.month]} {selected.day}, {selected.year}
            </p>
            {onScheduleDate && (
              <button
                type="button"
                onClick={() => onScheduleDate(new Date(selected.year, selected.month, selected.day))}
                className="shrink-0 text-sm text-[#7C5CD1] hover:opacity-80"
              >
                + Schedule
              </button>
            )}
          </div>
          {selectedInterviews.length === 0 ? (
            <p className="mt-[8px] text-xs text-[#9AA3B2]">No interviews scheduled on this day.</p>
          ) : (
            <div className="mt-[10px] flex flex-col gap-[8px]">
              {selectedInterviews.map((interview) => (
                <div key={interview.applicationId} className="rounded-[10px] bg-[#F8FAFB] p-[10px]">
                  <p className="truncate text-xs text-[#141B2E]">{interview.applicantName}</p>
                  <p className="mt-[1px] truncate text-xs text-[#4B5468]">{interview.jobPostingTitle}</p>
                  <p className="mt-[6px] flex items-center gap-[5px] text-xs text-[#7C5CD1]">
                    <CalendarIcon className="h-[11px] w-[11px]" />
                    Round {interview.details.round} · {INTERVIEW_MODE_LABEL[interview.details.mode]}
                  </p>
                  <p className="mt-[2px] text-xs text-[#4B5468]">
                    {new Date(interview.details.scheduledAt).toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      // Pinned so server (SSR) and client format the same
                      // instant identically regardless of the server
                      // process's local timezone — see the matching note in
                      // EmployerInterviewsView.tsx.
                      timeZone: "UTC",
                    })}
                    {interview.details.durationMinutes ? ` · ${interview.details.durationMinutes} min` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { addDays, checkStartFromCounts, lastBookableStart, runEndDate, type SlotBooking } from "@/lib/ad-slots";
import { ChevronDownIcon } from "./icons";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Inline booking calendar for a company ad's start date — same look as
 * DatePicker (Monday-first grid, round day buttons, teal selection), plus
 * what booking needs: full dates and dates that clash with this company's
 * other booking are unavailable, and the chosen 30-day run is highlighted.
 */
export default function AdSlotCalendar({
  today,
  value,
  onChange,
  counts,
  ownBookings,
  excludeId,
}: {
  today: string;
  value: string | null;
  onChange: (start: string) => void;
  counts: Record<string, number>;
  ownBookings: SlotBooking[];
  excludeId?: string;
}) {
  const firstMonth = monthKey(today);
  const lastMonth = monthKey(lastBookableStart(today));
  const [view, setView] = useState(() => (value ? monthKey(value) : firstMonth));

  const [y, m] = view.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const runEnd = value ? runEndDate(value) : null;

  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${view}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-[14px]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#141B2E]">{monthLabel}</p>
        <div className="flex items-center gap-[4px]">
          <button
            type="button"
            onClick={() => setView(shiftMonth(view, -1))}
            disabled={view <= firstMonth}
            aria-label="Previous month"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDownIcon className="h-[10px] w-[10px] rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => setView(shiftMonth(view, 1))}
            disabled={view >= lastMonth}
            aria-label="Next month"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDownIcon className="h-[10px] w-[10px] -rotate-90" />
          </button>
        </div>
      </div>

      <div className="mt-[10px] grid grid-cols-7 gap-y-[4px] text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <p key={i} className="pb-[2px] text-xs text-[#9AA3B2]">
            {label}
          </p>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const check = checkStartFromCounts(day, today, counts, ownBookings, excludeId);
          const isStart = day === value;
          const inRun = !!value && !!runEnd && day > value && day < runEnd;
          const isRunLast = !!runEnd && day === addDays(runEnd, -1);
          const outside = !check.ok && (check.reason === "past" || check.reason === "too_far");
          const full = !check.ok && check.reason === "full";
          const overlap = !check.ok && check.reason === "overlap";
          const title = full
            ? "All 10 slots are taken for part of this month"
            : overlap
              ? "Overlaps your other booking"
              : outside
                ? undefined
                : "Available";
          return (
            <div
              key={i}
              className={`flex h-[34px] items-center justify-center ${
                inRun || isStart ? "bg-brand-teal-soft" : ""
              } ${isStart ? "rounded-l-full" : ""} ${isRunLast ? "rounded-r-full" : ""}`}
            >
              <button
                type="button"
                disabled={!check.ok}
                onClick={() => onChange(day)}
                title={title}
                aria-label={`${day}${title ? ` — ${title}` : ""}`}
                aria-pressed={isStart}
                className={`flex h-[32px] w-[32px] items-center justify-center rounded-full text-sm transition-colors ${
                  isStart
                    ? "bg-brand-teal-dark text-white"
                    : full
                      ? "cursor-not-allowed text-[#C0C6D0] line-through"
                      : overlap
                        ? "cursor-not-allowed text-[#C0C6D0]"
                        : outside
                          ? "cursor-not-allowed text-[#D5DAE1]"
                          : `text-[#141B2E] hover:bg-[#F1F4F8] ${day === today ? "font-semibold text-brand-teal-dark" : ""}`
                }`}
              >
                {Number(day.slice(8))}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-[12px] flex flex-wrap items-center gap-x-[14px] gap-y-[6px] border-t border-black/[0.06] pt-[10px] text-xs text-[#4B5468]">
        <span className="flex items-center gap-[6px]">
          <span className="h-[10px] w-[10px] rounded-full bg-brand-teal-dark" /> Start
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[10px] w-[18px] rounded-full bg-brand-teal-soft" /> Your 30 days
        </span>
        <span className="flex items-center gap-[6px] text-[#9AA3B2]">
          <span className="line-through">12</span> Full
        </span>
      </div>
    </div>
  );
}

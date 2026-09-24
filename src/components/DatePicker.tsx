"use client";

import { useEffect, useRef, useState } from "react";
import Dropdown from "./Dropdown";
import { CalendarIcon, ChevronDownIcon } from "./icons";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function formatDisplay(value: string) {
  const parsed = parseISODate(value);
  if (!parsed) return "";
  return `${pad(parsed.day)}/${pad(parsed.month + 1)}/${parsed.year}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday), matching the rest
// of the app's Malaysia-locale conventions rather than JS's Sunday-first.
function mondayFirstDay(date: Date) {
  return (date.getDay() + 6) % 7;
}

const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({ value: pad(i + 1), label }));

function yearOptions(fromYear: number, toYear: number) {
  const options: { value: string; label: string }[] = [];
  for (let y = fromYear; y >= toYear; y--) options.push({ value: String(y), label: String(y) });
  return options;
}

export default function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "DD/MM/YYYY",
  accent = "teal",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  // Lower bound (ISO "YYYY-MM-DD") — e.g. "today" for scheduling something
  // that can't be in the past. Opposite of `max`, which is for the reverse
  // case (e.g. a date of birth that can't be in the future).
  min?: string;
  max?: string;
  placeholder?: string;
  accent?: "teal" | "gold";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parseISODate(value);
  const today = startOfDay(new Date());
  const maxDate = max ? startOfDay(parseISODate(max) ? new Date(max) : today) : null;
  const minDate = min ? startOfDay(parseISODate(min) ? new Date(min) : today) : null;

  const [viewYear, setViewYear] = useState(() => (selected ?? { year: today.getFullYear() }).year);
  const [viewMonth, setViewMonth] = useState(() => (selected ?? { month: today.getMonth() }).month);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openPicker() {
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
    setOpen(true);
  }

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
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = mondayFirstDay(firstOfMonth);
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  type Cell = { day: number; year: number; month: number; inCurrentMonth: boolean };
  const cells: Cell[] = [];
  for (let i = leadingBlanks - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      inCurrentMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, year: viewYear, month: viewMonth, inCurrentMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: trailing,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      inCurrentMonth: false,
    });
    trailing++;
  }

  const canGoNextMonth = !maxDate || new Date(viewYear, viewMonth + 1, 1) <= maxDate;
  const canGoPrevMonth = !minDate || new Date(viewYear, viewMonth, 0) >= minDate;
  const yearTop = maxDate ? maxDate.getFullYear() : today.getFullYear();
  const yearBottom = minDate ? minDate.getFullYear() : yearTop - 100;
  const YEAR_OPTIONS = yearOptions(yearTop, yearBottom);

  function selectCell(cell: Cell) {
    const cellDate = startOfDay(new Date(cell.year, cell.month, cell.day));
    if (maxDate && cellDate > maxDate) return;
    if (minDate && cellDate < minDate) return;
    onChange(toISODate(cell.year, cell.month, cell.day));
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={openPicker}
        className={`flex h-[38px] w-full items-center justify-between rounded-[12px] border border-black/[0.1] px-[14px] text-sm outline-none ${
          accent === "gold" ? "focus:border-brand-gold-dark" : "focus:border-brand-teal-dark"
        }`}
      >
        <span className={value ? "text-[#141B2E]" : "text-[#9AA3B2]"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <CalendarIcon className="h-[13px] w-[13px] text-[#9AA3B2]" />
      </button>

      {open && (
        <div className="absolute z-10 mt-[6px] w-[320px] rounded-[12px] border border-black/[0.1] bg-white p-[14px] shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]">
          <div className="flex items-center gap-[8px]">
            <div className="w-[124px]">
              <Dropdown
                label="Month"
                value={pad(viewMonth + 1)}
                options={MONTH_OPTIONS}
                onChange={(value) => setViewMonth(Number(value) - 1)}
                accent={accent}
              />
            </div>
            <div className="w-[92px]">
              <Dropdown
                label="Year"
                value={String(viewYear)}
                options={YEAR_OPTIONS}
                onChange={(value) => setViewYear(Number(value))}
                accent={accent}
              />
            </div>
            <div className="ml-auto flex items-center gap-[4px]">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                disabled={!canGoPrevMonth}
                aria-label="Previous month"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDownIcon className="h-[10px] w-[10px] rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                disabled={!canGoNextMonth}
                aria-label="Next month"
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[#4B5468] hover:bg-[#F1F4F8] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDownIcon className="h-[10px] w-[10px] -rotate-90" />
              </button>
            </div>
          </div>

          <div className="mt-[10px] grid grid-cols-7 gap-[2px] text-center">
            {WEEKDAY_LABELS.map((label, i) => (
              <p key={i} className="text-xs text-[#9AA3B2]">
                {label}
              </p>
            ))}
            {cells.map((cell, i) => {
              const cellDate = startOfDay(new Date(cell.year, cell.month, cell.day));
              const isSelected =
                selected &&
                cell.year === selected.year &&
                cell.month === selected.month &&
                cell.day === selected.day;
              const isToday = cellDate.getTime() === today.getTime();
              const disabled = (!!maxDate && cellDate > maxDate) || (!!minDate && cellDate < minDate);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectCell(cell)}
                  disabled={disabled}
                  className={`flex h-[28px] items-center justify-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? accent === "gold"
                        ? "bg-[#FFE9A6] text-[#141B2E]"
                        : "bg-brand-teal-dark text-white"
                      : disabled
                        ? "cursor-not-allowed text-[#D5DAE1]"
                        : cell.inCurrentMonth
                          ? `text-[#141B2E] hover:bg-[#F1F4F8] ${
                              isToday
                                ? accent === "gold"
                                  ? "text-brand-gold-dark"
                                  : "text-brand-teal-dark"
                                : ""
                            }`
                          : "text-[#D5DAE1] hover:bg-[#F1F4F8]"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-[10px] flex items-center justify-between border-t border-black/[0.06] pt-[10px]">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                onChange(toISODate(today.getFullYear(), today.getMonth(), today.getDate()));
                setOpen(false);
              }}
              className={`text-sm hover:opacity-70 ${
                accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark"
              }`}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

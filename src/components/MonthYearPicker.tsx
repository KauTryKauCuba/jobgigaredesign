"use client";

import { useState } from "react";
import Dropdown from "./Dropdown";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_OPTIONS = MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

const CURRENT_YEAR = new Date().getFullYear();
// Covers a full working career span, most recent first (most entries skew
// recent, so this avoids the year list opening scrolled past what's usually
// needed — same reasoning as the date-of-birth year list).
const YEAR_OPTIONS = Array.from({ length: 61 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { value: String(year), label: String(year) };
});

// Lenient — accepts what this field already stores/produces ("Jan 2022")
// and what AI resume parsing may hand back (a bare year like "2022"),
// leaving month blank in the latter case so the picker prompts for it.
function parseValue(value: string): { month: string; year: string } {
  const trimmed = value.trim();
  const withMonth = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (withMonth) {
    const idx = MONTHS.findIndex((m) => m.toLowerCase() === withMonth[1].slice(0, 3).toLowerCase());
    if (idx !== -1) return { month: String(idx + 1).padStart(2, "0"), year: withMonth[2] };
  }
  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) return { month: "", year: yearOnly[1] };
  return { month: "", year: "" };
}

export default function MonthYearPicker({
  value,
  onChange,
  disabled,
  disabledLabel = "Present",
  accent = "teal",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledLabel?: string;
  accent?: "teal" | "gold";
}) {
  const [month, setMonth] = useState(() => parseValue(value).month);
  const [year, setYear] = useState(() => parseValue(value).year);
  // Tracks the last prop value seen, so a re-render triggered by the parent
  // actually changing `value` (draft restore, resume parsing, "I currently
  // work here" clearing it) re-syncs local state — but a re-render for any
  // other reason, while `value` is still unchanged (e.g. still "" because
  // only a month has been picked so far, with no year yet), doesn't wipe it.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const parsed = parseValue(value);
    setMonth(parsed.month);
    setYear(parsed.year);
  }

  function commit(nextMonth: string, nextYear: string) {
    setMonth(nextMonth);
    setYear(nextYear);
    if (nextMonth && nextYear) onChange(`${MONTHS[Number(nextMonth) - 1]} ${nextYear}`);
  }

  if (disabled) {
    return (
      <div className="flex h-[38px] flex-1 items-center rounded-[12px] border border-black/[0.1] bg-black/[0.04] px-[14px] text-sm text-[#9AA3B2]">
        {disabledLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-[6px]">
      <div className="flex-1">
        <Dropdown
          label="Month"
          value={month}
          options={[{ value: "", label: "Month" }, ...MONTH_OPTIONS]}
          onChange={(v) => commit(v, year)}
          accent={accent}
        />
      </div>
      <div className="flex-1">
        <Dropdown
          label="Year"
          value={year}
          options={[{ value: "", label: "Year" }, ...YEAR_OPTIONS]}
          onChange={(v) => commit(month, v)}
          accent={accent}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// 24h "HH:MM" -> "h:mm AM/PM", matching how times are shown elsewhere in
// the app (e.g. InterviewCountdown, applicant cards).
function formatLabel(hour24: number, minute: number) {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${pad(minute)} ${period}`;
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hour24 = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return { value: `${pad(hour24)}:${pad(minute)}`, label: formatLabel(hour24, minute) };
});

// Same trigger/popover/list styling as Dropdown, but supports a genuinely
// empty (unselected) value with a placeholder — Dropdown always renders
// some option as selected, which doesn't fit "no time chosen yet".
// value/onChange are 24h "HH:MM" (same format the browser's native
// <input type="time"> produces) so this drops in wherever that used to be.
export default function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select time",
  accent = "teal",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accent?: "teal" | "gold";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const selected = TIME_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-[38px] w-full items-center justify-between rounded-[12px] border border-black/[0.1] px-[14px] text-sm outline-none ${
          accent === "gold" ? "focus:border-brand-gold-dark" : "focus:border-brand-teal-dark"
        }`}
      >
        <span className={selected ? "text-[#141B2E]" : "text-[#9AA3B2]"}>{selected?.label ?? placeholder}</span>
        <ChevronDownIcon className={`h-[11px] w-[11px] text-[#9AA3B2] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-10 mt-[6px] w-full rounded-[12px] border border-black/[0.1] bg-white p-[6px] shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]">
          <ul role="listbox" aria-label="Time" className="flex max-h-[240px] flex-col gap-[2px] overflow-y-auto">
            {TIME_OPTIONS.map((option) => (
              <li
                key={option.value}
                ref={option.value === value ? selectedRef : undefined}
                role="option"
                aria-selected={option.value === value}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex h-[32px] w-full items-center rounded-[8px] px-[10px] text-left text-sm transition-colors hover:bg-[#F1F4F8] ${
                    option.value === value ? "bg-[#F1F4F8] text-[#141B2E]" : "text-[#4B5468]"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "./icons";

export default function Dropdown<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  accent = "teal",
  searchable = false,
  searchPlaceholder = "Search...",
}: {
  id?: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  accent?: "teal" | "gold";
  // Adds a filter input at the top of the popover — for option lists long
  // enough that scanning beats scrolling (e.g. industries, occupations).
  // Off by default so short lists (employment type, work arrangement) don't
  // grow an unnecessary input.
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Jumps straight to the selected option on open — without this, a long
  // list (e.g. 100 birth years) always opens scrolled to the top, so
  // reaching an already-selected value further down means scrolling past
  // everything above it every single time. When searchable, focus the
  // search input instead so typing works immediately.
  useEffect(() => {
    if (!open) return;
    if (searchable) {
      searchInputRef.current?.focus();
    } else {
      selectedRef.current?.scrollIntoView({ block: "center" });
    }
  }, [open, searchable]);

  // Clears the filter every time the popover closes so it doesn't carry a
  // stale query into the next open. Adjusted during render (React's
  // "storing information from previous renders" pattern) instead of an
  // effect, since it only needs to react to `open` flipping, not run after
  // every commit.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`flex h-[38px] w-full items-center justify-between rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none ${
          accent === "gold" ? "focus:border-brand-gold-dark" : "focus:border-brand-teal-dark"
        }`}
      >
        {selected?.label}
        <ChevronDownIcon
          className={`h-[11px] w-[11px] text-[#9AA3B2] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-10 mt-[6px] w-full rounded-[12px] border border-black/[0.1] bg-white p-[6px] shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]">
          {searchable && (
            <div className="mb-[4px] flex items-center gap-[8px] rounded-[8px] border border-black/[0.08] px-[10px]">
              <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-[32px] w-full text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
              />
            </div>
          )}
          <ul role="listbox" aria-label={label} className="flex max-h-[260px] flex-col gap-[2px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-[10px] py-[10px] text-sm text-[#9AA3B2]">No matches found</li>
            ) : (
              filteredOptions.map((option) => (
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
                    className={`flex h-[38px] w-full min-w-0 items-center rounded-[8px] px-[10px] text-left text-sm transition-colors hover:bg-[#F1F4F8] ${
                      option.value === value ? "bg-[#F1F4F8] text-[#141B2E]" : "text-[#4B5468]"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}


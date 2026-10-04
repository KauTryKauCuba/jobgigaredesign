"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANIES_CHANGED_EVENT, COMPANY_SWITCHED_EVENT } from "./CompanySwitcher";
import { useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { XIcon } from "./icons";

// Last answer from the server, kept for the browser session (module scope
// survives client-side navigation). Never set during the server render, so
// a full page load always starts hidden on both sides — no hydration mismatch.
let cachedShow: boolean | null = null;

/**
 * Full-width teal bar under the employer navbar: points new employers at My
 * Profile's "Sample data" card so they can try every feature with demo data.
 * The server decides whether it shows — hidden once the employer closes it
 * (remembered on their account, so on every device) or once their current
 * company already has sample data. Re-checks when sample data is added or
 * removed, or the company is switched.
 */
export default function SampleDataBanner() {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();
  // Every employer page renders its own shell, so this remounts on each
  // sidebar click — starting from the last known answer (instead of hidden)
  // keeps the bar from popping in and shoving the page down every time.
  const [show, setShow] = useState(() => cachedShow ?? false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/employer/sample-data-banner", { cache: "no-store" });
        const data = await res.json();
        cachedShow = data.show === true;
        if (!cancelled) setShow(cachedShow);
      } catch {
        // Offline or a blip — just leave the bar hidden.
      }
    }
    check();
    window.addEventListener(COMPANIES_CHANGED_EVENT, check);
    window.addEventListener(COMPANY_SWITCHED_EVENT, check);
    return () => {
      cancelled = true;
      window.removeEventListener(COMPANIES_CHANGED_EVENT, check);
      window.removeEventListener(COMPANY_SWITCHED_EVENT, check);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    cachedShow = false;
    setShow(false);
    fetch("/api/employer/sample-data-banner", { method: "POST" }).catch(() => {
      // Best-effort — worst case it shows again on the next page load.
    });
  }

  return (
    <div className="bg-brand-teal-dark text-white">
      <div className="app-shell flex items-center gap-[12px] py-[10px]">
        <p className="min-w-0 flex-1 text-sm leading-[20px]">
          <span className="font-semibold">Want to see JobGiga in action?</span>{" "}
          {/* The detail line is dropped on phones so the button keeps its room. */}
          <span className="hidden text-white/85 sm:inline">
            Add sample job postings, applicants, interviews and teammates to explore every feature — remove them anytime.
          </span>
        </p>
        <button
          type="button"
          onClick={() => guardNavigation(() => router.push("/employer/profile#sample-data"))}
          className="flex h-[32px] shrink-0 items-center rounded-full bg-white px-[14px] text-sm text-brand-teal-dark transition-opacity hover:opacity-90"
        >
          Get sample data
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close this notice"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <XIcon className="h-[12px] w-[12px]" />
        </button>
      </div>
    </div>
  );
}

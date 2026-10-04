"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANIES_CHANGED_EVENT } from "./CompanySwitcher";
import { gradientFrameClass } from "./formStyles";

/**
 * My Profile's one switch for demo data — sample job postings, applicants
 * (with interviews and video pitches), teammates and the two real-branded
 * demo companies, all added or removed together. Lives here rather than on
 * the Manage Job / Applicants / Interviews pages so those stay clean.
 */
export default function DummyDataCard({ initialHasDummyData }: { initialHasDummyData: boolean }) {
  const router = useRouter();
  const [hasDummyData, setHasDummyData] = useState(initialHasDummyData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const calls = hasDummyData
        ? // Applicants reference postings, so clear them first — otherwise
          // deleting the postings cascades their applications away silently
          // instead of going through the applicants' own cleanup.
          [
            ["/api/employer/applications/dummy", "DELETE"],
            ["/api/employer/job-postings/dummy", "DELETE"],
            ["/api/employer/team/dummy", "DELETE"],
            ["/api/employer/dummy-companies", "DELETE"],
          ]
        : [
            ["/api/employer/job-postings/dummy", "POST"],
            ["/api/employer/applications/dummy", "POST"],
            ["/api/employer/team/dummy", "POST"],
            ["/api/employer/dummy-companies", "POST"],
          ];
      for (const [url, method] of calls) {
        const res = await fetch(url, { method });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't update the sample data.");
        }
      }
      setHasDummyData(!hasDummyData);
      window.dispatchEvent(new Event(COMPANIES_CHANGED_EVENT));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the sample data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // id = the target of the "Get sample data" bar under the navbar.
    <div
      id="sample-data"
      className={`animate-fade-in-up scroll-mt-[100px] ${gradientFrameClass("teal")}`}
      style={{ animationDelay: "160ms" }}
    >
      <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <div className="flex items-center justify-between gap-[8px]">
          <p className="text-sm text-[#141B2E]">Sample data</p>
          {hasDummyData && (
            <span className="rounded-full bg-[#FFF3D6] px-[8px] py-[2px] text-xs text-[#A67C00]">On</span>
          )}
        </div>
        <p className="text-xs text-[#4B5468]">
          {hasDummyData
            ? "Sample job postings, applicants, interviews and teammates are in your account. Remove them all in one go when you're done exploring."
            : "Fill your account with sample job postings, applicants, interviews and teammates to try every feature. Your real data isn't touched."}
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className="mt-[4px] flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (hasDummyData ? "Removing…" : "Adding…") : hasDummyData ? "Remove sample data" : "Add sample data"}
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import SaveJobButton from "./SaveJobButton";
import { gradientFrameClass } from "./formStyles";
import { BellIcon } from "./icons";
import { relativeTimeAgo } from "@/lib/applicationStatus";
import type { AuthUser } from "./AuthModal";

type SavedJobRow = {
  savedAt: string;
  posting: {
    id: string;
    slug: string;
    title: string;
    status: string;
    employmentType: string;
    workArrangement: string;
    location: string;
    salaryMin: number | null;
    salaryMax: number | null;
  };
  companyName: string;
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

export default function SavedJobsView({
  authUser,
  resume,
  savedJobs,
  appliedJobPostingIds,
  initialAlertsEnabled,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  savedJobs: SavedJobRow[];
  appliedJobPostingIds: string[];
  initialAlertsEnabled: boolean;
}) {
  // Un-saving here removes the card right away (the heart's request runs
  // in the background, same as everywhere else).
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [alertsEnabled, setAlertsEnabled] = useState(initialAlertsEnabled);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const applied = new Set(appliedJobPostingIds);
  const visible = savedJobs.filter((row) => !removedIds.has(row.posting.id));

  async function toggleAlerts() {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    setAlertsBusy(true);
    setAlertsError(null);
    try {
      const res = await fetch("/api/jobseeker/job-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAlertsEnabled(!next);
      setAlertsError("Couldn't update your alerts — try again.");
    } finally {
      setAlertsBusy(false);
    }
  }

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="saved"
      heading="Saved Jobs"
      subheading="Jobs you've hearted, and alerts for new ones that fit you."
      resume={resume}
    >
      <div className="flex flex-col gap-[20px]">
        <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
          <div className="flex items-start gap-[12px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#FFF3D6] text-brand-gold-dark">
              <BellIcon className="h-[16px] w-[16px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#141B2E]">New job alerts</p>
              <p className="mt-[2px] text-xs text-[#4B5468]">
                Get a notification when a new job is posted that&rsquo;s a strong match for your profile (70% or
                higher). Keep your profile up to date for better matches.
              </p>
              {alertsError && <p className="mt-[6px] text-xs text-red-500">{alertsError}</p>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={alertsEnabled}
              aria-label="New job alerts"
              disabled={alertsBusy}
              onClick={toggleAlerts}
              className={`relative mt-[4px] h-[24px] w-[42px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                alertsEnabled ? "bg-brand-gold-dark" : "bg-[#D7DCE4]"
              }`}
            >
              <span
                className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] ${
                  alertsEnabled ? "left-[21px]" : "left-[3px]"
                }`}
              />
            </button>
          </div>
        </div>

        <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`} style={{ animationDelay: "60ms" }}>
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div className="flex items-center gap-[8px]">
              <p className="text-sm text-[#141B2E]">Saved jobs</p>
              <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-brand-gold-dark">
                {visible.length}
              </span>
            </div>

            {visible.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                Nothing saved yet — tap the heart on any job to keep it here for later.{" "}
                <Link href="/jobseeker#job-search" className="text-brand-gold-dark hover:underline">
                  Browse jobs
                </Link>
              </p>
            ) : (
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {visible.map(({ posting, companyName, savedAt }) => {
                  const isOpen = posting.status === "active";
                  const hasApplied = applied.has(posting.id);
                  const salary =
                    posting.salaryMin && posting.salaryMax
                      ? `RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
                      : "Salary not disclosed";
                  const details = (
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[6px]">
                        <p className={`truncate text-sm ${isOpen ? "text-[#141B2E]" : "text-[#9AA3B2]"}`}>
                          {posting.title}
                        </p>
                        {hasApplied && (
                          <span className="rounded-full bg-[#E7F6EC] px-[8px] py-[1px] text-xs text-[#2F9E56]">
                            Applied
                          </span>
                        )}
                        {!isOpen && (
                          <span className="rounded-full bg-[#F1F4F8] px-[8px] py-[1px] text-xs text-[#4B5468]">
                            No longer accepting applications
                          </span>
                        )}
                      </div>
                      <p className="mt-[2px] text-xs text-[#4B5468]">{companyName}</p>
                      <div className="mt-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                        <span>{posting.location || "Location not set"}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{EMPLOYMENT_TYPE_LABEL[posting.employmentType] ?? posting.employmentType}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{WORK_ARRANGEMENT_LABEL[posting.workArrangement] ?? posting.workArrangement}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{salary}</span>
                      </div>
                      <p className="mt-[4px] text-xs text-[#9AA3B2]">Saved {relativeTimeAgo(savedAt)}</p>
                    </div>
                  );
                  const heart = (
                    <SaveJobButton
                      jobPostingId={posting.id}
                      initialSaved
                      onChange={(saved) => {
                        if (!saved) setRemovedIds((prev) => new Set(prev).add(posting.id));
                      }}
                    />
                  );
                  const rowClass =
                    "flex items-start gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]";
                  // Closed postings no longer have a page to open.
                  return isOpen ? (
                    <Link
                      key={posting.id}
                      href={`/jobseeker/jobs/${posting.slug}`}
                      className={`${rowClass} transition-colors hover:bg-[#F1F4F8]`}
                    >
                      {details}
                      {heart}
                    </Link>
                  ) : (
                    <div key={posting.id} className={rowClass}>
                      {details}
                      {heart}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </JobseekerDashboardShell>
  );
}

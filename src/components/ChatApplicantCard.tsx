"use client";

import { useEffect } from "react";
import { APPLICATION_STATUS_COLOR, APPLICATION_STATUS_LABEL, relativeTimeAgo } from "@/lib/applicationStatus";
import type { ApplicantFit } from "./ApplicantModalHost";
import type { ApplicantDetail } from "./ApplicantDetailModal";
import { UserIcon } from "./icons";

/** What the chat's profile card shows — kept live as the profile changes. */
export type ApplicantSummary = {
  name: string;
  avatarUrl: string | null;
  posting: string;
  status: string;
  appliedAt: string;
  location: string;
  years: number;
  salaryMin: number;
  salaryMax: number;
  skills: string[];
  fit: ApplicantFit;
};

export function summarize(applicant: ApplicantDetail, fit: ApplicantFit): ApplicantSummary {
  return {
    name: applicant.applicantName,
    avatarUrl: applicant.applicantAvatarUrl,
    posting: applicant.jobPostingTitle,
    status: applicant.application.status,
    appliedAt: applicant.application.appliedAt,
    location: applicant.applicantLocation,
    years: applicant.applicantYearsExperience,
    salaryMin: applicant.applicantExpectedSalaryMin,
    salaryMax: applicant.applicantExpectedSalaryMax,
    skills: applicant.applicantSkills,
    fit,
  };
}

const viewButton =
  "w-fit rounded-full border border-brand-teal/40 bg-[#F0FCFD] px-[12px] py-[5px] text-[11px] text-brand-teal-dark transition-colors hover:bg-brand-teal-soft";

function Avatar({ url, size }: { url: string | null | undefined; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} referrerPolicy="no-referrer" alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-brand-teal-dark"
      style={{ width: size, height: size }}
    >
      <UserIcon className="h-[15px] w-[15px]" />
    </span>
  );
}

/**
 * An applicant's profile at a glance, right in the JobGiga Assistant's
 * conversation. On its own it's a full-width card that opens into the full
 * profile in the same spot (Chat mode); several people show as slim cards
 * side by side, whose full profile opens under the row.
 */
export default function ChatApplicantCard({
  name,
  summary,
  error,
  onNeed,
  expanded = false,
  onOpen,
  compact = false,
  active = false,
  onHide,
  children,
}: {
  // Shown while the live details load.
  name: string;
  summary?: ApplicantSummary;
  error?: string;
  // Asks for this applicant's details (fetched once and shared by every card).
  onNeed: () => void;
  // Showing the full profile (children) here in the conversation; its own
  // close button folds it back into this card.
  expanded?: boolean;
  onOpen: () => void;
  // A slim card in a row of several.
  compact?: boolean;
  // Compact: their full profile is the one open under the row.
  active?: boolean;
  onHide?: () => void;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (!summary && !error) onNeed();
  }, [summary, error, onNeed]);

  if (expanded && children) {
    return <div className="animate-fade-in-up flex h-[min(640px,72vh)] w-full">{children}</div>;
  }

  const color = summary ? (APPLICATION_STATUS_COLOR[summary.status] ?? APPLICATION_STATUS_COLOR.applied) : null;
  const salary =
    summary && (summary.salaryMin || summary.salaryMax)
      ? `RM ${summary.salaryMin.toLocaleString("en-MY")}–${summary.salaryMax.toLocaleString("en-MY")}`
      : null;
  const stagePill =
    summary && color ? (
      <span className={`w-fit shrink-0 rounded-full px-[8px] py-[2px] text-[11px] ${color.bg} ${color.text}`}>
        {APPLICATION_STATUS_LABEL[summary.status] ?? summary.status}
      </span>
    ) : null;
  const facts = (parts: (string | null)[]) => (
    <p className="flex flex-wrap gap-x-[6px] gap-y-[2px] text-[11px] text-[#4B5468]">
      {parts.filter(Boolean).map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mr-[6px] text-[#C5CBD5]">·</span>}
          {part}
        </span>
      ))}
    </p>
  );
  const skills = (max: number) =>
    summary && summary.skills.length > 0 ? (
      <div className="flex flex-wrap gap-[4px]">
        {summary.skills.slice(0, max).map((skill) => (
          <span key={skill} className="rounded-full bg-[#F1F4F8] px-[8px] py-[2px] text-[11px] text-[#4B5468]">
            {skill}
          </span>
        ))}
        {summary.skills.length > max && (
          <span className="px-[4px] py-[2px] text-[11px] text-[#9AA3B2]">+{summary.skills.length - max} more</span>
        )}
      </div>
    ) : null;
  const fit = summary?.fit ? `Fit ${summary.fit.score}${summary.fit.eligible ? "" : " · misses a must-have"}` : null;

  if (compact) {
    return (
      <div
        className={`flex w-[248px] shrink-0 snap-start flex-col gap-[8px] rounded-[14px] border bg-white p-[12px] text-xs text-[#141B2E] transition-colors ${
          active ? "border-brand-teal-dark/50 ring-1 ring-brand-teal/30" : "border-[#EAEDF2]"
        }`}
      >
        <div className="flex items-center gap-[8px]">
          <Avatar url={summary?.avatarUrl} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{summary?.name ?? name}</p>
            <p className="truncate text-[11px] text-[#9AA3B2]">{summary ? summary.posting : error ? "" : "Loading…"}</p>
          </div>
        </div>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        {summary && (
          <>
            {stagePill}
            {facts([summary.location, `${summary.years} yr${summary.years === 1 ? "" : "s"}`])}
            {facts([salary, fit])}
            {skills(3)}
          </>
        )}
        {!error && (
          <button type="button" onClick={active ? onHide : onOpen} className={`mt-auto ${viewButton}`}>
            {active ? "Hide profile" : "View profile →"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-white p-[12px] text-xs text-[#141B2E]">
      <div className="flex items-center gap-[10px]">
        <Avatar url={summary?.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{summary?.name ?? name}</p>
          <p className="truncate text-[11px] text-[#9AA3B2]">
            {summary ? `${summary.posting} · applied ${relativeTimeAgo(summary.appliedAt)}` : error ? "" : "Loading profile…"}
          </p>
        </div>
        {stagePill}
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {summary && (
        <>
          {facts([summary.location, `${summary.years} yr${summary.years === 1 ? "" : "s"} experience`, salary, fit])}
          {skills(5)}
        </>
      )}

      {!error && (
        <button type="button" onClick={onOpen} className={viewButton}>
          View full profile →
        </button>
      )}
    </div>
  );
}

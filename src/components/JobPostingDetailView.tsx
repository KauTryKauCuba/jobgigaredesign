"use client";

import { useEffect } from "react";
import Link from "next/link";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import RichTextContent from "./RichTextContent";
import { gradientFrameClass } from "./formStyles";
import { CheckIcon, XIcon } from "./icons";
import { relativeTimeAgo } from "@/lib/applicationStatus";
import { fullPostingAddress } from "@/lib/postingLocation";
import type { AuthUser } from "./AuthModal";

type Posting = {
  id: string;
  title: string;
  description: string;
  responsibilities: string;
  industry: string | null;
  employmentType: string;
  workArrangement: string;
  location: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  openings: number;
  skills: string[];
  softSkills: string[];
  minYearsExperience: number | null;
  minQualificationTier: string | null;
  languages: { language: string; level: string }[];
  workAuthorizations: string[];
  drivingLicense: string | null;
  createdAt: string;
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

type MatchBreakdown = {
  skills: number | null;
  softSkills: number | null;
  niceToHaveSkills: number | null;
  experience: number | null;
  industry: number | null;
  workArrangement: number | null;
  employmentType: number | null;
};

type Match = {
  score: number;
  eligible: boolean;
  ineligibleReasons: string[];
  breakdown: MatchBreakdown;
};

// Mirrors matchBand/BREAKDOWN_LABELS in TopMatchesCard.tsx (the employer-
// side equivalent) — same bands/labels so "80% strong match" means the same
// thing on both sides of the marketplace.
const BREAKDOWN_LABELS: { key: keyof MatchBreakdown; label: string }[] = [
  { key: "skills", label: "Required skills" },
  { key: "softSkills", label: "Soft skills" },
  { key: "niceToHaveSkills", label: "Nice-to-have skills" },
  { key: "experience", label: "Experience" },
  { key: "industry", label: "Industry" },
  { key: "workArrangement", label: "Work arrangement" },
  { key: "employmentType", label: "Employment type" },
];

function matchBand(score: number): { label: string; bg: string; text: string } {
  if (score >= 80) return { label: "Strong match", bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" };
  if (score >= 60) return { label: "Good match", bg: "bg-[#E6F9FA]", text: "text-[#008990]" };
  return { label: "Possible match", bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
}

function PlaceholderLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="14" height="9" rx="1.6" />
      <path d="M7 7V5.6C7 4.72 7.72 4 8.6 4h2.8c.88 0 1.6.72 1.6 1.6V7" />
    </svg>
  );
}

function CompanyLogo({ url, className = "" }: { url: string | null; className?: string }) {
  if (!url) return <PlaceholderLogo className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className} object-contain`} />;
}

export default function JobPostingDetailView({
  authUser,
  resume,
  posting,
  companyName,
  companyLogoUrl,
  match,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  posting: Posting;
  companyName: string;
  companyLogoUrl: string | null;
  match: Match | null;
}) {
  useEffect(() => {
    fetch(`/api/jobseeker/job-postings/${posting.id}/view`, { method: "POST" }).catch(() => {});
  }, [posting.id]);

  const salary =
    posting.salaryMin && posting.salaryMax
      ? `RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
      : "Salary not disclosed";

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="overview"
      resume={resume}
      heading={posting.title}
      subheading={companyName}
    >
      <Link
        href="/jobseeker/dashboard"
        className="text-sm text-[#9AA3B2] hover:text-[#141B2E]"
      >
        ← Back to dashboard
      </Link>

      {match && (
        <div className={`mt-[16px] ${gradientFrameClass("gold")}`}>
          <div className="rounded-[19px] bg-white p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-[10px]">
              <p className="text-sm text-[#141B2E]">Your match for this role</p>
              {(() => {
                const band = matchBand(match.score);
                return (
                  <span className={`rounded-full px-[10px] py-[4px] text-xs ${band.bg} ${band.text}`}>
                    {match.score}% · {band.label}
                  </span>
                );
              })()}
            </div>

            {!match.eligible && match.ineligibleReasons.length > 0 && (
              <p className="mt-[8px] text-xs text-red-500">{match.ineligibleReasons.join(" · ")}</p>
            )}

            <div className="mt-[10px] flex flex-wrap items-center gap-x-[12px] gap-y-[6px] text-xs text-[#4B5468]">
              {BREAKDOWN_LABELS.map(({ key, label }) => {
                const value = match.breakdown[key];
                if (value === null) return null;
                const pass = value >= 0.5;
                return (
                  <span key={key} className="flex items-center gap-[4px]">
                    {pass ? (
                      <CheckIcon className="h-[10px] w-[10px] text-[#2F9E56]" />
                    ) : (
                      <XIcon className="h-[10px] w-[10px] text-red-400" />
                    )}
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={`mt-[16px] ${gradientFrameClass("gold")}`}>
        <div className="rounded-[19px] bg-white p-[24px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div>
              <p className="text-lg text-[#141B2E]">{posting.title}</p>
              <p className="mt-[4px] text-sm text-[#4B5468]">{companyName}</p>
            </div>
            <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center">
              <CompanyLogo url={companyLogoUrl} className="h-[44px] w-[56px]" />
            </div>
          </div>

          <div className="mt-[16px] flex flex-wrap items-center gap-[8px] text-xs">
            {posting.industry && (
              <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.industry}</span>
            )}
            <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.location}</span>
            <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
              {EMPLOYMENT_TYPE_LABEL[posting.employmentType] ?? posting.employmentType}
            </span>
            <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
              {WORK_ARRANGEMENT_LABEL[posting.workArrangement] ?? posting.workArrangement}
            </span>
            <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{salary}</span>
            <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
              {posting.openings} opening{posting.openings === 1 ? "" : "s"}
            </span>
            <span className="text-[#9AA3B2]">Posted {relativeTimeAgo(posting.createdAt)}</span>
          </div>

          <RichTextContent html={posting.description} className="mt-[20px] text-sm leading-[22px] text-[#4B5468]" />

          <div className="mt-[20px]">
            <p className="text-xs text-[#141B2E]">Job description</p>
            <RichTextContent
              html={posting.responsibilities}
              className="mt-[6px] text-sm leading-[22px] text-[#4B5468]"
            />
          </div>

          {posting.skills.length > 0 && (
            <div className="mt-[20px]">
              <p className="text-xs text-[#141B2E]">Skills required</p>
              <div className="mt-[8px] flex flex-wrap gap-[6px]">
                {posting.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[#FFE9A6] px-[12px] py-[6px] text-xs text-[#141B2E]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {posting.softSkills.length > 0 && (
            <div className="mt-[16px]">
              <p className="text-xs text-[#141B2E]">Soft skills</p>
              <div className="mt-[8px] flex flex-wrap gap-[6px]">
                {posting.softSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {posting.location && (
            <div className="mt-[16px]">
              <p className="text-xs text-[#141B2E]">Location</p>
              <p className="mt-[2px] text-sm text-[#4B5468]">{fullPostingAddress(posting)}</p>
              <iframe
                title={`Map for ${posting.location}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(fullPostingAddress(posting))}&output=embed`}
                loading="lazy"
                className="mt-[8px] h-[160px] w-full rounded-[12px] border border-black/[0.08]"
              />
            </div>
          )}

          <div className="mt-[24px] border-t border-black/[0.06] pt-[16px]">
            <p className="text-sm text-[#141B2E]">Screening requirements</p>
            <div className="mt-[12px] grid grid-cols-1 gap-x-[20px] gap-y-[12px] sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#4B5468]">Minimum experience</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {!posting.minYearsExperience
                    ? "No requirement"
                    : `${posting.minYearsExperience} year${posting.minYearsExperience === 1 ? "" : "s"}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#4B5468]">Minimum education</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">{posting.minQualificationTier ?? "No requirement"}</p>
              </div>
              {posting.drivingLicense && (
                <div>
                  <p className="text-xs text-[#4B5468]">Driving license</p>
                  <p className="mt-[2px] text-sm text-[#141B2E]">{posting.drivingLicense}</p>
                </div>
              )}
              {posting.languages.length > 0 && (
                <div>
                  <p className="text-xs text-[#4B5468]">Languages required</p>
                  <p className="mt-[2px] text-sm text-[#141B2E]">
                    {posting.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
                  </p>
                </div>
              )}
              {posting.workAuthorizations.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#4B5468]">Accepted work authorization</p>
                  <p className="mt-[2px] text-sm text-[#141B2E]">{posting.workAuthorizations.join(", ")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </JobseekerDashboardShell>
  );
}

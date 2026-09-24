"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApplicantDetailModal from "./ApplicantDetailModal";
import type { EmployerAddress } from "@/lib/employer-profile";
import EmployerDashboardShell from "./EmployerDashboardShell";
import RichTextContent from "./RichTextContent";
import { gradientFrameClass } from "./formStyles";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  relativeTimeAgo,
  type InterviewDetails,
  type InterviewResponseStatus,
} from "@/lib/applicationStatus";
import { UserIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import type { EvaluationCriterion, InterviewEvaluation, InterviewRecommendation } from "@/lib/interviewEvaluation";
import { fullPostingAddress } from "@/lib/postingLocation";

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

const INTERVIEW_STAGE_STATUSES = ["interview", "interviewed", "evaluation", "evaluated"];

// Funnel order for the analytics card — terminal/parked statuses (kiv,
// rejected, withdrawn) are excluded since they're off the main path and
// would make the funnel non-monotonic.
const FUNNEL_STAGES = ["applied", "screened", "shortlisted", "interview", "interviewed", "evaluation", "evaluated", "offer", "hired"];
const FUNNEL_STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  shortlisted: "Shortlisted",
  interview: "Interview",
  interviewed: "Interviewed",
  evaluation: "Evaluation",
  evaluated: "Evaluated",
  offer: "Offer",
  hired: "Hired",
};

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);
}

// Same logic as OnboardingForm.tsx's calculateAge — kept in sync so an
// applicant's bucketed age here matches what they'd see as "Age: N" there.
function calculateAge(dateOfBirth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age >= 0 ? age : null;
}

const AGE_BANDS = [
  { label: "18-24", min: 18, max: 24, color: "#7C5CD1" },
  { label: "25-34", min: 25, max: 34, color: "#008990" },
  { label: "35-44", min: 35, max: 44, color: "#2B6CB0" },
  { label: "45-54", min: 45, max: 54, color: "#E6B34D" },
  { label: "55+", min: 55, max: Infinity, color: "#C2600A" },
];

// Fill colors for the funnel bands — same hues as APPLICATION_STATUS_COLOR
// (applicationStatus.ts) so a stage reads the same color here as it does on
// every applicant status pill, just used as an SVG fill instead of a bg/text pair.
const FUNNEL_STAGE_HEX: Record<string, string> = {
  applied: "#9AA3B2",
  screened: "#E6B34D",
  shortlisted: "#008990",
  interview: "#7C5CD1",
  interviewed: "#2B6CB0",
  evaluated: "#0F9D6C",
  offer: "#C2600A",
  hired: "#2F9E56",
};

// Solid fill colors matching the match-score band text colors from matchBand().
const SCORE_BAND_FILL: Record<string, string> = {
  "Strong (80+)": "bg-[#2F9E56]",
  "Good (60-79)": "bg-[#008990]",
  "Possible (<60)": "bg-[#4B5468]",
};

type MatchResult = {
  applicationId: string;
  jobPostingId: string;
  score: number;
  eligible: boolean;
};

// Same bands as TopMatchesCard.tsx (the Applicants page's own "Top Matches")
// so a score reads the same wherever it shows up.
function matchBand(score: number): { label: string; bg: string; text: string } {
  if (score >= 80) return { label: "Strong match", bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" };
  if (score >= 60) return { label: "Good match", bg: "bg-[#E6F9FA]", text: "text-[#008990]" };
  return { label: "Possible match", bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
}

type Posting = {
  id: string;
  status: string;
  flagReason: string | null;
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

type ApplicationRow = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
    hiredAt?: string | null;
    interviewDetails: InterviewDetails | null;
    interviewResponseStatus?: InterviewResponseStatus | null;
    jobseekerConfirmedAttendance?: boolean;
  };
  jobPostingId: string;
  jobPostingTitle: string;
  applicantName: string;
  applicantAvatarUrl: string | null;
  applicantLocation: string;
  applicantDateOfBirth: string | null;
  applicantTargetRole: string;
  applicantYearsExperience: number;
  applicantSkills: string[];
  applicantExpectedSalaryMin: number;
  applicantExpectedSalaryMax: number;
  applicantEmploymentType: string;
  applicantWorkArrangement: string;
  applicantNoticePeriod: string;
  applicantResumeUrl: string | null;
  applicantResumeFileName: string | null;
  evaluation?: InterviewEvaluation | null;
};

function ApplicantAvatar({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
        <UserIcon className="h-[15px] w-[15px]" />
      </div>
    );
  }
  // Jobseeker avatars are arbitrary uploaded URLs/data URIs, same convention
  // used everywhere else avatars appear in the app.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[36px] w-[36px] shrink-0 rounded-full object-cover" />;
}

function ApplicantRow({
  applicant,
  match,
  onClick,
}: {
  applicant: ApplicationRow;
  match?: MatchResult;
  onClick: () => void;
}) {
  const color = APPLICATION_STATUS_COLOR[applicant.application.status] ?? APPLICATION_STATUS_COLOR.applied;
  const band = match ? matchBand(match.score) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] text-left transition-colors hover:bg-[#F1F4F8]"
    >
      <ApplicantAvatar url={applicant.applicantAvatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[#141B2E]">{applicant.applicantName}</p>
        <p className="mt-[1px] truncate text-xs text-[#4B5468]">
          {applicant.applicantTargetRole} · Applied {relativeTimeAgo(applicant.application.appliedAt)}
        </p>
      </div>
      {band && match && (
        <span className={`shrink-0 rounded-full px-[10px] py-[3px] text-xs ${band.bg} ${band.text}`}>
          {match.score}% match
        </span>
      )}
      <span className={`shrink-0 rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}>
        {APPLICATION_STATUS_LABEL[applicant.application.status] ?? applicant.application.status}
      </span>
    </button>
  );
}

function PostingAnalytics({
  postingCreatedAt,
  rows,
  matchByApplicationId,
}: {
  postingCreatedAt: string;
  rows: ApplicationRow[];
  matchByApplicationId: Record<string, MatchResult>;
}) {
  const funnelClipId = useId();

  // 1. Funnel: how many applicants have reached (or passed) each stage.
  // A stage counts every applicant currently at or beyond it in FUNNEL_STAGES,
  // so the bars are monotonically non-increasing left to right.
  const stageIndex: Record<string, number> = {};
  FUNNEL_STAGES.forEach((s, i) => (stageIndex[s] = i));
  const funnelCounts = FUNNEL_STAGES.map((stage, i) => ({
    stage,
    count: rows.filter((r) => (stageIndex[r.application.status] ?? -1) >= i).length,
  }));
  const funnelMax = funnelCounts[0]?.count || 1;

  // Smooth funnel silhouette: one continuous curved outline (cubic beziers
  // through each stage's width) instead of stacked straight-edged trapezoids,
  // with per-stage color bands clipped inside it.
  const funnelRowH = 30;
  const funnelTotalH = funnelCounts.length * funnelRowH;
  const funnelWidthPct = (count: number) =>
    funnelMax > 0 ? Math.max((count / funnelMax) * 100, count > 0 ? 12 : 0) : 0;
  // n+1 width levels: one per stage boundary, plus the bottom of the last stage.
  const funnelLevels = [...funnelCounts.map((f) => funnelWidthPct(f.count)), funnelWidthPct(funnelCounts.at(-1)?.count ?? 0)];
  const funnelYs = funnelLevels.map((_, i) => i * funnelRowH);
  const funnelRightXs = funnelLevels.map((w) => 50 + w / 2);
  const funnelLeftXs = funnelLevels.map((w) => 50 - w / 2);
  function smoothEdge(xs: number[], ys: number[]): string {
    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < xs.length; i++) {
      const midY = (ys[i - 1] + ys[i]) / 2;
      d += ` C ${xs[i - 1]} ${midY}, ${xs[i]} ${midY}, ${xs[i]} ${ys[i]}`;
    }
    return d;
  }
  const funnelOutlinePath =
    smoothEdge(funnelRightXs, funnelYs) +
    " " +
    smoothEdge([...funnelLeftXs].reverse(), [...funnelYs].reverse()).replace("M", "L") +
    " Z";

  // 2. Time-to-hire: average days from appliedAt to hiredAt, hired applicants only.
  const hiredRows = rows.filter((r) => r.application.status === "hired" && r.application.hiredAt);
  const avgTimeToHire =
    hiredRows.length > 0
      ? Math.round(
          hiredRows.reduce((sum, r) => sum + daysBetween(r.application.appliedAt, r.application.hiredAt as string), 0) /
            hiredRows.length,
        )
      : null;

  // 3. Applicant locations — grouped counts, most common first.
  const locationCounts = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const loc = r.applicantLocation?.trim() || "Not specified";
      acc[loc] = (acc[loc] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);
  const LOCATION_FILL = [
    "#7C5CD1",
    "#008990",
    "#C2600A",
    "#2B6CB0",
    "#E6B34D",
    "#0F9D6C",
    "#D1476B",
    "#4B5468",
    "#3B5BDB",
    "#9C6B1F",
    "#2F9E56",
    "#9AA3B2",
  ];
  const donutSlices = locationCounts.map((l, i) => ({ ...l, color: LOCATION_FILL[i % LOCATION_FILL.length] }));
  const donutTotal = donutSlices.reduce((sum, s) => sum + s.count, 0);
  const donutPcts = donutSlices.map((s) => (donutTotal > 0 ? (s.count / donutTotal) * 100 : 0));
  const donutArcs = donutSlices.map((s, i) => {
    const cumulative = donutPcts.slice(0, i).reduce((sum, p) => sum + p, 0);
    const pct = donutPcts[i];
    return { ...s, pct, dashArray: `${pct} ${100 - pct}`, dashOffset: 25 - cumulative };
  });

  // 4. Applicant ages, bucketed into bands — only counts applicants who
  // have a valid date of birth on file (optional field, so this is often
  // a subset of total applicants).
  const ages = rows
    .map((r) => (r.applicantDateOfBirth ? calculateAge(r.applicantDateOfBirth) : null))
    .filter((a): a is number => a !== null);
  const ageBandCounts = AGE_BANDS.map((band) => ({
    ...band,
    count: ages.filter((a) => a >= band.min && a <= band.max).length,
  }));
  const ageBandMax = Math.max(1, ...ageBandCounts.map((b) => b.count));

  // 5. Match score distribution across the same bands used on applicant rows.
  const scores = rows
    .map((r) => matchByApplicationId[r.application.id]?.score)
    .filter((s): s is number => typeof s === "number");
  const scoreBands = [
    { ...matchBand(80), label: "Strong (80+)", min: 80, max: Infinity },
    { ...matchBand(60), label: "Good (60-79)", min: 60, max: 79 },
    { ...matchBand(0), label: "Possible (<60)", min: 0, max: 59 },
  ];
  const scoreCounts = scoreBands.map((band) => ({
    ...band,
    count: scores.filter((s) => s >= band.min && s <= band.max).length,
  }));

  // 6. Applications per day since the posting went live, most recent 14 days.
  const today = new Date();
  const dayBuckets: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = rows.filter((r) => r.application.appliedAt.slice(0, 10) === key).length;
    dayBuckets.push({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      count,
    });
  }
  const dayMax = Math.max(1, ...dayBuckets.map((d) => d.count));
  const postedDaysAgo = Math.max(0, Math.round(daysBetween(postingCreatedAt, today.toISOString())));
  const totalInPeriod = dayBuckets.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay = totalInPeriod / dayBuckets.length;
  const peakDay = dayBuckets.reduce((best, d) => (d.count > best.count ? d : best), dayBuckets[0]);

  return (
    <div className={gradientFrameClass("teal")}>
      <div className="rounded-[19px] bg-white p-[22px]">
        <p className="text-sm text-[#141B2E]">Analytics</p>

        {/* Funnel */}
        <div className="mt-[14px]">
          <p className="text-xs text-[#4B5468]">Hiring funnel</p>
          <div className="mt-[10px] flex gap-[10px]">
            <div className="flex shrink-0 flex-col" style={{ width: 72 }}>
              {funnelCounts.map(({ stage }) => (
                <div key={stage} className="flex items-center justify-end text-right text-xs text-[#4B5468]" style={{ height: funnelRowH }}>
                  {FUNNEL_STAGE_LABEL[stage]}
                </div>
              ))}
            </div>
            <div className="relative flex-1">
              <svg
                viewBox={`0 0 100 ${funnelTotalH}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: funnelTotalH }}
              >
                <defs>
                  <clipPath id={funnelClipId}>
                    <path d={funnelOutlinePath} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${funnelClipId})`}>
                  {funnelCounts.map(({ stage }, i) => (
                    <rect
                      key={stage}
                      x={0}
                      y={i * funnelRowH}
                      width={100}
                      height={funnelRowH}
                      fill={FUNNEL_STAGE_HEX[stage] ?? "#008990"}
                    />
                  ))}
                </g>
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col">
                {funnelCounts.map(({ stage, count }) => (
                  <div key={stage} className="flex items-center justify-center text-xs text-white" style={{ height: funnelRowH }}>
                    {count > 0 ? count : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Time to hire */}
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <p className="text-xs text-[#4B5468]">Avg. time to hire</p>
          <p className="mt-[4px] text-lg text-[#141B2E]">
            {avgTimeToHire === null ? "No hires yet" : `${avgTimeToHire} day${avgTimeToHire === 1 ? "" : "s"}`}
          </p>
          {hiredRows.length > 0 && (
            <p className="mt-[1px] text-xs text-[#9AA3B2]">
              Across {hiredRows.length} hire{hiredRows.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* Applicant locations */}
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <p className="text-xs text-[#4B5468]">Where applicants are from</p>
          {locationCounts.length === 0 ? (
            <p className="mt-[6px] text-xs text-[#9AA3B2]">No applicants yet.</p>
          ) : (
            <div className="mt-[10px] flex items-center gap-[16px]">
              <div className="relative h-[92px] w-[92px] shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  {donutArcs.map((arc) => (
                    <circle
                      key={arc.location}
                      cx={18}
                      cy={18}
                      r={15.9155}
                      fill="transparent"
                      stroke={arc.color}
                      strokeWidth={4}
                      strokeDasharray={arc.dashArray}
                      strokeDashoffset={arc.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base text-[#141B2E]">{donutTotal}</span>
                  <span className="text-[9px] text-[#9AA3B2]">applicants</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                {donutArcs.map((arc) => (
                  <div key={arc.location} className="flex items-center gap-[6px]">
                    <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs text-[#4B5468]" title={arc.location}>
                      {arc.location}
                    </span>
                    <span className="shrink-0 text-xs text-[#141B2E]">{arc.count}</span>
                    <span className="w-[32px] shrink-0 text-right text-[11px] text-[#9AA3B2]">
                      {Math.round(arc.pct)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Applicant ages */}
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <p className="text-xs text-[#4B5468]">Applicant ages</p>
          {ages.length === 0 ? (
            <p className="mt-[6px] text-xs text-[#9AA3B2]">No date of birth on file for these applicants yet.</p>
          ) : (
            <div className="mt-[8px] flex flex-col gap-[6px]">
              {ageBandCounts.map((band) => (
                <div key={band.label} className="flex items-center gap-[8px]">
                  <span className="w-[48px] shrink-0 text-xs text-[#4B5468]">{band.label}</span>
                  <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-[#F1F4F8]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(band.count / ageBandMax) * 100}%`, backgroundColor: band.color }}
                    />
                  </div>
                  <span className="w-[24px] shrink-0 text-right text-xs text-[#141B2E]">
                    {band.count}
                  </span>
                </div>
              ))}
              {ages.length < rows.length && (
                <p className="text-[11px] text-[#9AA3B2]">
                  {rows.length - ages.length} applicant{rows.length - ages.length === 1 ? "" : "s"} without a date of
                  birth on file
                </p>
              )}
            </div>
          )}
        </div>

        {/* Match score distribution */}
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <p className="text-xs text-[#4B5468]">Match score distribution</p>
          {scores.length === 0 ? (
            <p className="mt-[6px] text-xs text-[#9AA3B2]">No match scores available yet.</p>
          ) : (
            <div className="mt-[8px] flex flex-col gap-[6px]">
              {scoreCounts.map((band) => (
                <div key={band.label} className="flex items-center gap-[8px]">
                  <span className={`w-[104px] shrink-0 rounded-full px-[8px] py-[2px] text-center text-[11px] ${band.bg} ${band.text}`}>
                    {band.label}
                  </span>
                  <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-[#F1F4F8]">
                    <div
                      className={`h-full rounded-full ${SCORE_BAND_FILL[band.label] ?? "bg-brand-teal-dark"}`}
                      style={{ width: `${scores.length > 0 ? (band.count / scores.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-[24px] shrink-0 text-right text-xs text-[#141B2E]">{band.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applications over time */}
        <div className="mt-[16px] border-t border-black/[0.06] pt-[14px]">
          <div className="flex items-baseline justify-between gap-[8px]">
            <p className="text-xs text-[#4B5468]">
              Applications, last 14 days {postedDaysAgo < 14 ? `(posted ${postedDaysAgo}d ago)` : ""}
            </p>
            <span className="shrink-0 text-xs text-[#7C5CD1]">{totalInPeriod} total</span>
          </div>
          <p className="mt-[2px] text-[11px] text-[#9AA3B2]">
            {avgPerDay.toFixed(1)} / day avg
            {peakDay.count > 0 ? ` · peak ${peakDay.count} on ${peakDay.label}` : ""}
          </p>

          <div className="mt-[12px] flex h-[56px] items-end gap-[3px]">
            {dayBuckets.map((d, i) => {
              const isToday = i === dayBuckets.length - 1;
              return (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-[3px]" title={`${d.label}: ${d.count}`}>
                  {d.count > 0 && <span className="text-[9px] leading-none text-[#7C5CD1]">{d.count}</span>}
                  <div
                    className={`w-full rounded-t-[3px] ${isToday ? "bg-[#5A3FA8]" : "bg-[#7C5CD1]"}`}
                    style={{ height: `${Math.max(2, (d.count / dayMax) * 40)}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-[4px] flex items-center justify-between text-[10px] text-[#9AA3B2]">
            <span>{dayBuckets[0]?.label}</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployerJobPostingView({
  authUser,
  posting,
  applications,
  addresses,
}: {
  authUser: AuthUser;
  posting: Posting;
  applications: ApplicationRow[];
  addresses: EmployerAddress[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(applications);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [matchByApplicationId, setMatchByApplicationId] = useState<Record<string, MatchResult>>({});
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  async function handleResubmit() {
    setResubmitting(true);
    setResubmitError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${posting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't resubmit this posting.");
      // Resubmitting moves it to "pending" — this page only serves
      // active/filled/closed/flagged postings, so it 404s on refresh.
      // Manage Job's own pending section is where it lives now.
      router.push("/employer/jobs");
    } catch (err) {
      setResubmitError(err instanceof Error ? err.message : "Couldn't resubmit this posting.");
    } finally {
      setResubmitting(false);
    }
  }

  // Same scoring "Top Matches" uses on the Applicants page, just scoped down
  // to this one posting's applicants via jobPostingId.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/employer/applicants/matches")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { results: MatchResult[] } | null) => {
        if (cancelled || !data) return;
        const byId: Record<string, MatchResult> = {};
        for (const result of data.results) {
          if (result.jobPostingId === posting.id) byId[result.applicationId] = result;
        }
        setMatchByApplicationId(byId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [posting.id]);

  const viewingApplicant = rows.find((r) => r.application.id === viewingId) ?? null;
  const interviewRows = rows.filter((r) => INTERVIEW_STAGE_STATUSES.includes(r.application.status));

  async function updateStatus(applicationId: string, status: string, interviewDetails?: InterviewDetails) {
    setStatusError(null);
    setUpdatingId(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(interviewDetails !== undefined ? { status, interviewDetails } : { status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update this applicant's status.");
      setRows((prev) =>
        prev.map((row) =>
          row.application.id === applicationId
            ? {
                ...row,
                application: {
                  ...row.application,
                  status,
                  interviewDetails: interviewDetails ?? row.application.interviewDetails,
                },
              }
            : row,
        ),
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't update this applicant's status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function setAttendance(applicationId: string, interviewResponseStatus: "attended" | "no_show") {
    setStatusError(null);
    setUpdatingId(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "interview", interviewResponseStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update this applicant's status.");
      setRows((prev) =>
        prev.map((row) =>
          row.application.id === applicationId
            ? {
                ...row,
                application: {
                  ...row.application,
                  interviewResponseStatus: interviewResponseStatus as InterviewResponseStatus,
                  status: "interviewed",
                },
              }
            : row,
        ),
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't update this applicant's status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveEvaluation(
    applicationId: string,
    scores: Partial<Record<EvaluationCriterion, number>>,
    recommendation: InterviewRecommendation,
    notes: string,
  ) {
    setStatusError(null);
    setUpdatingId(applicationId);
    try {
      const res = await fetch(`/api/employer/applications/${applicationId}/evaluation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, recommendation, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save this evaluation.");
      setRows((prev) =>
        prev.map((row) =>
          row.application.id === applicationId
            ? {
                ...row,
                application: { ...row.application, status: data.status },
                evaluation: {
                  round: data.evaluation.round,
                  scores: data.evaluation.scores,
                  recommendation: data.evaluation.recommendation,
                  notes: data.evaluation.notes,
                },
              }
            : row,
        ),
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't save this evaluation.");
    } finally {
      setUpdatingId(null);
    }
  }

  const salary =
    posting.salaryMin && posting.salaryMax
      ? `RM${posting.salaryMin.toLocaleString("en-US")}–${posting.salaryMax.toLocaleString("en-US")}`
      : "Salary not disclosed";

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="jobs"
      heading={posting.title}
      headerAction={
        <button
          type="button"
          onClick={() => router.push(`/employer/jobs/postajob?id=${posting.id}`)}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Edit posting
        </button>
      }
      subheading="Everything about this posting — details, applicants, and interviews, in one place."
    >
      <Link href="/employer/jobs" className="text-sm text-[#9AA3B2] hover:text-[#141B2E]">
        ← Back to Manage Job
      </Link>

      {posting.status === "flagged" && posting.flagReason && (
        <div className="mt-[16px] rounded-[12px] border border-[#FBDBBE] bg-[#FFF7F0] p-[12px]">
          <p className="mb-[4px] text-xs text-[#C2600A]">Flagged — needs a fix</p>
          <p className="text-xs text-[#9A5209]">{posting.flagReason}</p>
          {resubmitError && <p className="mt-[8px] text-xs text-[#9A5209]">{resubmitError}</p>}
          <button
            type="button"
            disabled={resubmitting}
            onClick={handleResubmit}
            className="mt-[10px] flex h-[34px] w-full items-center justify-center rounded-full border border-[#FBDBBE] bg-white text-sm text-[#C2600A] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-[16px]"
          >
            {resubmitting ? "Resubmitting…" : "↻ Resubmit for Review"}
          </button>
        </div>
      )}

      <div className="mt-[16px] flex flex-col gap-[16px] lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-[16px] lg:flex-[3]">
          <div className={gradientFrameClass("teal")}>
            <div className="rounded-[19px] bg-white p-[22px]">
              <p className="text-sm text-[#141B2E]">Job posting</p>

              <div className="mt-[12px] flex flex-wrap items-center gap-[8px] text-xs">
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

              <RichTextContent html={posting.description} className="mt-[16px] text-sm leading-[22px] text-[#4B5468]" />

              <div className="mt-[16px]">
                <p className="text-xs text-[#141B2E]">Job description</p>
                <RichTextContent
                  html={posting.responsibilities}
                  className="mt-[6px] text-sm leading-[22px] text-[#4B5468]"
                />
              </div>

              {posting.skills.length > 0 && (
                <div className="mt-[16px]">
                  <p className="text-xs text-[#141B2E]">Skills required</p>
                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                    {posting.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {posting.softSkills.length > 0 && (
                <div className="mt-[12px]">
                  <p className="text-xs text-[#141B2E]">Soft skills</p>
                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                    {posting.softSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#141B2E]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {posting.location && (
                <div className="mt-[12px]">
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

              <div className="mt-[20px] border-t border-black/[0.06] pt-[14px]">
                <p className="text-sm text-[#141B2E]">Screening requirements</p>
                <div className="mt-[10px] grid grid-cols-1 gap-x-[20px] gap-y-[10px] sm:grid-cols-2">
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

          <div className={gradientFrameClass("teal")}>
            <div className="rounded-[19px] bg-white p-[22px]">
              <div className="flex items-center gap-[8px]">
                <p className="text-sm text-[#141B2E]">Applicants</p>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                  {rows.length}
                </span>
              </div>
              {statusError && <p className="mt-[6px] text-xs text-red-500">{statusError}</p>}

              {rows.length === 0 ? (
                <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                  No one&rsquo;s applied yet — applicants will show up here as jobseekers apply.
                </p>
              ) : (
                <div className="mt-[12px] flex flex-col gap-[8px]">
                  {rows.map((applicant) => (
                    <ApplicantRow
                      key={applicant.application.id}
                      applicant={applicant}
                      match={matchByApplicationId[applicant.application.id]}
                      onClick={() => {
                        setViewingId(applicant.application.id);
                        if (applicant.application.status === "applied") {
                          updateStatus(applicant.application.id, "screened");
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[16px] lg:flex-[2]">
          <PostingAnalytics postingCreatedAt={posting.createdAt} rows={rows} matchByApplicationId={matchByApplicationId} />

          <div className={gradientFrameClass("teal")}>
            <div className="rounded-[19px] bg-white p-[22px]">
              <div className="flex items-center gap-[8px]">
                <p className="text-sm text-[#141B2E]">Interviews</p>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                  {interviewRows.length}
                </span>
              </div>

              {interviewRows.length === 0 ? (
                <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                  No one&rsquo;s at the interview stage for this posting yet.
                </p>
              ) : (
                <div className="mt-[12px] flex flex-col gap-[8px]">
                  {interviewRows.map((applicant) => (
                    <ApplicantRow
                      key={applicant.application.id}
                      applicant={applicant}
                      match={matchByApplicationId[applicant.application.id]}
                      onClick={() => setViewingId(applicant.application.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewingApplicant && (
        <ApplicantDetailModal
          applicant={viewingApplicant}
          updating={updatingId === viewingApplicant.application.id}
          onUpdateStatus={(status, interviewDetails) =>
            updateStatus(viewingApplicant.application.id, status, interviewDetails)
          }
          onSetAttendance={(status) => setAttendance(viewingApplicant.application.id, status)}
          onSaveEvaluation={(scores, recommendation, notes) =>
            saveEvaluation(viewingApplicant.application.id, scores, recommendation, notes)
          }
          savingEvaluation={updatingId === viewingApplicant.application.id}
          addresses={addresses}
          onClose={() => setViewingId(null)}
        />
      )}
    </EmployerDashboardShell>
  );
}

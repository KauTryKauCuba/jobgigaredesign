"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ApplicantDetailModal from "./ApplicantDetailModal";
import type { EmployerAddress } from "@/lib/employer-profile";
import { COMPANIES_CHANGED_EVENT } from "./CompanySwitcher";
import EmployerDashboardShell from "./EmployerDashboardShell";
import { gradientFrameClass } from "./formStyles";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  relativeTimeAgo,
  type InterviewDetails,
  type InterviewResponseStatus,
} from "@/lib/applicationStatus";
import {
  BoltIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  DraftIcon,
  FlagIcon,
  PencilIcon,
  SearchIcon,
  StackIcon,
  UserIcon,
  XCircleIcon,
} from "./icons";
import TopMatchesCard from "./TopMatchesCard";
import type { CriteriaFlags } from "./MatchSettingsModal";
import type { AuthUser } from "./AuthModal";
import type { EvaluationCriterion, InterviewEvaluation, InterviewRecommendation } from "@/lib/interviewEvaluation";
import { DUMMY_APPLICANT_NAMES } from "@/lib/dummy-applicants";

// Matches application_status exactly (see the finalized pipeline design).
const STATUS_ORDER = [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "interviewed",
  "evaluation",
  "evaluated",
  "kiv",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

const STATUS_ICON: Record<
  string,
  (props: { className?: string; strokeWidth?: number; style?: React.CSSProperties }) => ReactElement
> = {
  applied: StackIcon,
  screened: ClockIcon,
  shortlisted: BoltIcon,
  interview: ClockIcon,
  interviewed: CheckCircleIcon,
  evaluation: PencilIcon,
  evaluated: CheckCircleIcon,
  kiv: FlagIcon,
  offer: DraftIcon,
  hired: CheckCircleIcon,
  rejected: XCircleIcon,
  withdrawn: XCircleIcon,
};

// Same deeper/saturated pastel each status's APPLICATION_STATUS_COLOR.bg
// approximates — used as the gradient-to-white start color + the watermark
// icon's --icon-accent, matching the Manage Job pipeline tiles' treatment.
const STATUS_TILE_GRADIENT: Record<string, string> = {
  applied: "#C9CFDA",
  screened: "#FFE1A1",
  shortlisted: "#8CE6D9",
  interview: "#D4C6F7",
  interviewed: "#A5C6F7",
  evaluation: "#FFCFA3",
  evaluated: "#A5EBCD",
  kiv: "#B9C3F9",
  offer: "#FFCDA1",
  hired: "#A5EBB9",
  rejected: "#F9B9B9",
  withdrawn: "#D4D7DC",
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
const NOTICE_PERIOD_LABEL: Record<string, string> = {
  immediate: "Immediate",
  one_week: "1 week notice",
  two_weeks: "2 weeks notice",
  one_month: "1 month notice",
  two_months: "2 months notice",
  more_than_two_months: "2+ months notice",
};

type ApplicationRow = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
    interviewDetails: InterviewDetails | null;
    interviewResponseStatus?: InterviewResponseStatus | null;
    jobseekerConfirmedAttendance?: boolean;
  };
  jobPostingId: string;
  jobPostingTitle: string;
  applicantName: string;
  applicantAvatarUrl: string | null;
  applicantLocation: string;
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
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
        <UserIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  // Jobseeker avatars are arbitrary uploaded URLs/data URIs, same convention
  // used everywhere else avatars appear in the app.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />;
}

export default function EmployerApplicantsView({
  authUser,
  applications,
  initialSmartMatchEnabled,
  initialCriteria,
  addresses,
}: {
  authUser: AuthUser;
  applications: ApplicationRow[];
  initialSmartMatchEnabled: boolean;
  initialCriteria: CriteriaFlags;
  addresses: EmployerAddress[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId") ?? undefined;
  const [rows, setRows] = useState(applications);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [dummyBusy, setDummyBusy] = useState(false);
  const [collapsedPostings, setCollapsedPostings] = useState<Set<string>>(() => new Set());
  const [howStagesWorkOpen, setHowStagesWorkOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");

  function togglePostingCollapsed(postingId: string) {
    setCollapsedPostings((prev) => {
      const next = new Set(prev);
      if (next.has(postingId)) next.delete(postingId);
      else next.add(postingId);
      return next;
    });
  }
  const viewingApplicant = rows.find((r) => r.application.id === viewingId) ?? null;
  const hasDummyApplicants = rows.some((r) => DUMMY_APPLICANT_NAMES.includes(r.applicantName));

  // router.refresh() re-fetches the server component and passes a new
  // `applications` prop down, but useState only reads its initializer once
  // on mount — resync during render (React's sanctioned pattern for
  // deriving state from a changed prop) whenever the prop actually changes.
  const [prevApplications, setPrevApplications] = useState(applications);
  if (applications !== prevApplications) {
    setPrevApplications(applications);
    setRows(applications);
  }

  // Arriving from a "N applicants" link on Manage Job — scroll straight to
  // that job's group (left expanded, along with every other group).
  useEffect(() => {
    if (!initialJobId) return;
    document.getElementById(`posting-${initialJobId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialJobId]);

  async function toggleDummyApplicants() {
    setDummyBusy(true);
    try {
      if (hasDummyApplicants) {
        // Mirrors the Manage Job button: removing dummy data clears both
        // the dummy applicants and the dummy postings they applied to, so
        // the two pages never fall out of sync with each other.
        await fetch("/api/employer/applications/dummy", { method: "DELETE" });
        await fetch("/api/employer/job-postings/dummy", { method: "DELETE" });
        await fetch("/api/employer/dummy-companies", { method: "DELETE" });
      } else {
        await fetch("/api/employer/job-postings/dummy", { method: "POST" });
        await fetch("/api/employer/dummy-companies", { method: "POST" });
        const res = await fetch("/api/employer/applications/dummy", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't add dummy applicants.");
      }
      window.dispatchEvent(new Event(COMPANIES_CHANGED_EVENT));
      router.refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Couldn't update dummy applicants.");
    } finally {
      setDummyBusy(false);
    }
  }

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

  const trimmedNameQuery = nameQuery.trim().toLowerCase();
  const filteredRows = rows.filter(
    (a) =>
      (!statusFilter || a.application.status === statusFilter) &&
      (!trimmedNameQuery || a.applicantName.toLowerCase().includes(trimmedNameQuery)),
  );
  const postingIds = Array.from(new Set(filteredRows.map((a) => a.jobPostingId)));
  const postings = postingIds.map((id) => ({
    id,
    title: filteredRows.find((a) => a.jobPostingId === id)!.jobPostingTitle,
    applicants: filteredRows.filter((a) => a.jobPostingId === id),
  }));
  const totalPostingCount = new Set(rows.map((a) => a.jobPostingId)).size;
  const hasActiveFilter = !!statusFilter || !!trimmedNameQuery;

  function toggleStatusFilter(status: string) {
    setStatusFilter((prev) => (prev === status ? null : status));
  }

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="applicants"
      heading="Applicants"
      headerAction={
        <button
          type="button"
          disabled={dummyBusy}
          onClick={toggleDummyApplicants}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasDummyApplicants ? "Remove dummy data" : "Get dummy data"}
        </button>
      }
      subheading="See who's applied, and where they stand, across every job posting."
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
      <div className="min-w-0 lg:flex-[3] flex flex-col gap-[20px]">
      <div className={gradientFrameClass("teal")}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <button
            type="button"
            onClick={() => setHowStagesWorkOpen((o) => !o)}
            aria-expanded={howStagesWorkOpen}
            className="flex w-full items-center gap-[8px] text-left"
          >
            <p className="text-sm text-[#141B2E]">How the hiring stages work</p>
            <ChevronDownIcon
              className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${howStagesWorkOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {howStagesWorkOpen && (
            <div className="mt-[12px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: 1, title: "Applied → Screened → Shortlisted", detail: "Click through an applicant's Hiring stage list to move them forward one step at a time." },
                { step: 2, title: "Schedule an interview", detail: "Clicking Interview opens the scheduling form — round, mode, date, time." },
                { step: 3, title: "Attend, then evaluate", detail: "Mark attended/no-show after the interview, then score the candidate to reach Evaluated." },
                { step: 4, title: "Decide", detail: "Move to Offer → Hired, keep them on hold (KIV), or Reject — available at any stage." },
              ].map((s) => (
                <div key={s.step} className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-teal-dark text-xs text-white">
                    {s.step}
                  </span>
                  <p className="mt-[4px] text-xs text-[#141B2E]">{s.title}</p>
                  <p className="text-xs text-[#4B5468]">{s.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={gradientFrameClass("teal")}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="mb-[12px] text-sm text-[#141B2E]">Applicants at a glance</p>
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-4">
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => {
                setStatusFilter(null);
                setNameQuery("");
              }}
              style={{ backgroundImage: "linear-gradient(to bottom, #C9CFDA, white 90%)", "--icon-accent": "#C9CFDA" } as React.CSSProperties}
              className={`gradient-noise relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] text-left transition-opacity ${
                rows.length > 0
                  ? `cursor-pointer hover:opacity-80 ${!statusFilter && !trimmedNameQuery ? "ring-gradient-color" : ""}`
                  : "cursor-default opacity-60"
              }`}
            >
              <span aria-hidden className="pointer-events-none absolute -top-[10%] -right-[10%]">
                <UserIcon
                  className="icon-gradient-color h-[48px] w-[48px] opacity-40"
                  strokeWidth={0.7}
                  style={{ "--icon-accent": "#C9CFDA" } as React.CSSProperties}
                />
              </span>
              <div className="relative flex items-start justify-between">
                <span className="text-xl text-[#141B2E]">{rows.length}</span>
                <UserIcon className="h-[16px] w-[16px] text-[#9AA3B2]" />
              </div>
              <span className="relative text-xs text-[#4B5468]">Total applicants</span>
            </button>
            <div
              style={{ backgroundImage: "linear-gradient(to bottom, #C9CFDA, white 90%)" }}
              className={`gradient-noise relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] ${
                totalPostingCount > 0 ? "" : "opacity-60"
              }`}
            >
              <span aria-hidden className="pointer-events-none absolute -top-[10%] -right-[10%]">
                <UserIcon
                  className="icon-gradient-color h-[48px] w-[48px] opacity-40"
                  strokeWidth={0.7}
                  style={{ "--icon-accent": "#C9CFDA" } as React.CSSProperties}
                />
              </span>
              <div className="relative flex items-start justify-between">
                <span className="text-xl text-[#141B2E]">{totalPostingCount}</span>
                <UserIcon className="h-[16px] w-[16px] text-[#9AA3B2]" />
              </div>
              <span className="relative text-xs text-[#4B5468]">Job postings with applicants</span>
            </div>
            {STATUS_ORDER.map((status) => {
              const count = rows.filter((a) => a.application.status === status).length;
              const Icon = STATUS_ICON[status];
              const color = APPLICATION_STATUS_COLOR[status];
              const gradient = STATUS_TILE_GRADIENT[status];
              const isActive = statusFilter === status;
              return (
                <button
                  type="button"
                  key={status}
                  disabled={count === 0}
                  onClick={() => toggleStatusFilter(status)}
                  style={{ backgroundImage: `linear-gradient(to bottom, ${gradient}, white 90%)`, "--icon-accent": gradient } as React.CSSProperties}
                  className={`gradient-noise relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] text-left transition-opacity ${
                    count > 0
                      ? `cursor-pointer hover:opacity-80 ${isActive ? "ring-gradient-color" : ""}`
                      : "cursor-default opacity-60"
                  }`}
                >
                  <span aria-hidden className="pointer-events-none absolute -top-[10%] -right-[10%]">
                    <Icon
                      className="icon-gradient-color h-[48px] w-[48px] opacity-40"
                      strokeWidth={0.7}
                      style={{ "--icon-accent": gradient } as React.CSSProperties}
                    />
                  </span>
                  <div className="relative flex items-start justify-between">
                    <span className="text-xl text-[#141B2E]">{count}</span>
                    <Icon className={`h-[16px] w-[16px] ${color.text}`} />
                  </div>
                  <span className={`relative text-xs ${color.text}`}>
                    {APPLICATION_STATUS_LABEL[status] ?? status}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-[24px]">
            <div className="flex flex-wrap items-center justify-between gap-[8px]">
              <p className="text-sm text-[#141B2E]">Applicants, grouped by job posting</p>
              <div className="flex items-center gap-[8px]">
                <div className="flex h-[38px] w-[180px] items-center gap-[6px] rounded-full border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
                  <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
                  <input
                    type="text"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="h-full w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
                  />
                </div>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter(null);
                      setNameQuery("");
                    }}
                    className="text-sm text-brand-teal-dark hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
            {statusFilter && (
              <p className="mt-[6px] text-xs text-[#9AA3B2]">
                Showing only{" "}
                <span className="text-[#4B5468]">
                  {APPLICATION_STATUS_LABEL[statusFilter] ?? statusFilter}
                </span>{" "}
                applicants.
              </p>
            )}
            {statusError && <p className="mt-[6px] text-xs text-red-500">{statusError}</p>}

            {postings.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                {hasActiveFilter
                  ? "No applicants match this filter."
                  : "No one’s applied yet — applicants will show up here as jobseekers apply to your postings."}
              </p>
            ) : (
              <div className="mt-[10px] flex flex-col gap-[10px]">
                {postings.map((posting) => {
                  const collapsed = collapsedPostings.has(posting.id);
                  return (
                  <div key={posting.id} id={`posting-${posting.id}`} className={gradientFrameClass("teal")}>
                  <div className="rounded-[19px] bg-white p-[22px]">
                    <button
                      type="button"
                      onClick={() => togglePostingCollapsed(posting.id)}
                      aria-expanded={!collapsed}
                      className="flex w-full items-center gap-[8px] text-left"
                    >
                      <p className="text-sm text-[#141B2E]">{posting.title}</p>
                      <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                        {posting.applicants.length} applicant{posting.applicants.length === 1 ? "" : "s"}
                      </span>
                      <ChevronDownIcon
                        className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${collapsed ? "-rotate-90" : ""}`}
                      />
                    </button>
                    {!collapsed && (
                    <div className="mt-[10px] flex flex-col gap-[10px]">
                      {posting.applicants.map((applicant) => {
                        return (
                          <button
                            key={applicant.application.id}
                            type="button"
                            onClick={() => {
                              setViewingId(applicant.application.id);
                              // Opening an "Applied" applicant is itself the
                              // screening step — auto-advances so the employer
                              // doesn't have to open the modal a second time
                              // just to mark them as screened.
                              if (applicant.application.status === "applied") {
                                updateStatus(applicant.application.id, "screened");
                              }
                            }}
                            className="flex flex-col gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] text-left transition-colors hover:bg-[#F1F4F8] sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-[10px]">
                              <ApplicantAvatar url={applicant.applicantAvatarUrl} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-[#141B2E]">
                                  {applicant.applicantName}
                                </p>
                                <p className="mt-[1px] truncate text-xs text-[#4B5468]">
                                  {applicant.applicantTargetRole}
                                </p>
                                <div className="mt-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#9AA3B2]">
                                  <span>{applicant.applicantLocation || "Location not set"}</span>
                                  <span className="text-[#C7CDD7]">·</span>
                                  <span>
                                    {applicant.applicantYearsExperience} yr
                                    {applicant.applicantYearsExperience === 1 ? "" : "s"} experience
                                  </span>
                                  <span className="text-[#C7CDD7]">·</span>
                                  <span>
                                    {EMPLOYMENT_TYPE_LABEL[applicant.applicantEmploymentType] ??
                                      applicant.applicantEmploymentType}
                                  </span>
                                  <span className="text-[#C7CDD7]">·</span>
                                  <span>
                                    {WORK_ARRANGEMENT_LABEL[applicant.applicantWorkArrangement] ??
                                      applicant.applicantWorkArrangement}
                                  </span>
                                  <span className="text-[#C7CDD7]">·</span>
                                  <span>
                                    RM{applicant.applicantExpectedSalaryMin.toLocaleString()}–
                                    {applicant.applicantExpectedSalaryMax.toLocaleString()}
                                  </span>
                                  <span className="text-[#C7CDD7]">·</span>
                                  <span>
                                    {NOTICE_PERIOD_LABEL[applicant.applicantNoticePeriod] ??
                                      applicant.applicantNoticePeriod}
                                  </span>
                                </div>
                                {applicant.applicantSkills.length > 0 && (
                                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                                    {applicant.applicantSkills.slice(0, 6).map((skill) => (
                                      <span
                                        key={skill}
                                        className="rounded-full bg-[#E6F9FA] px-[9px] py-[3px] text-xs text-brand-teal-dark"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-[6px]">
                              <span className="text-xs text-[#9AA3B2]">
                                Applied {relativeTimeAgo(applicant.application.appliedAt)}
                              </span>
                              {(() => {
                                const color =
                                  APPLICATION_STATUS_COLOR[applicant.application.status] ??
                                  APPLICATION_STATUS_COLOR.applied;
                                return (
                                  <span
                                    className={`shrink-0 rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}
                                  >
                                    {APPLICATION_STATUS_LABEL[applicant.application.status] ??
                                      applicant.application.status}
                                  </span>
                                );
                              })()}
                              <span className="text-xs text-brand-teal-dark">View details →</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:flex-[1]">
        <div className={gradientFrameClass("teal")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <TopMatchesCard initialEnabled={initialSmartMatchEnabled} initialCriteria={initialCriteria} />
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

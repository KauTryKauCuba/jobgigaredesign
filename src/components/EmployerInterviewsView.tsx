"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ApplicantDetailModal from "./ApplicantDetailModal";
import type { EmployerAddress } from "@/lib/employer-profile";
import { COMPANIES_CHANGED_EVENT } from "./CompanySwitcher";
import EmployerDashboardShell from "./EmployerDashboardShell";
import InterviewCalendarCard from "./InterviewCalendarCard";
import InterviewBigCalendar from "./InterviewBigCalendar";
import InterviewCountdown from "./InterviewCountdown";
import Modal from "./Modal";
import { gradientFrameClass } from "./formStyles";
import {
  INTERVIEW_MODE_LABEL,
  INTERVIEW_RESPONSE_STATUS_COLOR,
  INTERVIEW_RESPONSE_STATUS_LABEL,
  type InterviewDetails,
  type InterviewResponseStatus,
} from "@/lib/applicationStatus";
import { CalendarIcon, CheckCircleIcon, ChevronDownIcon, ClockIcon, FlagIcon, SearchIcon, UserIcon, XCircleIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import type { ComponentType } from "react";
import type { EvaluationCriterion, InterviewEvaluation, InterviewRecommendation } from "@/lib/interviewEvaluation";
import { DUMMY_APPLICANT_NAMES } from "@/lib/dummy-applicants";

const INTERVIEW_RESPONSE_STATUS_ORDER: InterviewResponseStatus[] = [
  "pending",
  "accepted",
  "declined",
  "reschedule_requested",
  "attended",
  "no_show",
];

const INTERVIEW_RESPONSE_STATUS_ICON: Record<
  InterviewResponseStatus,
  ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>
> = {
  pending: ClockIcon,
  accepted: CheckCircleIcon,
  declined: XCircleIcon,
  reschedule_requested: CalendarIcon,
  attended: CheckCircleIcon,
  no_show: FlagIcon,
};

// Same deeper/saturated pastel each response status's
// INTERVIEW_RESPONSE_STATUS_COLOR.bg approximates — used as the
// gradient-to-white start color + the watermark icon's --icon-accent.
const INTERVIEW_RESPONSE_STATUS_GRADIENT: Record<InterviewResponseStatus, string> = {
  pending: "#FFE1A1",
  accepted: "#A5EBB9",
  declined: "#F9B9B9",
  reschedule_requested: "#FFCDA1",
  attended: "#8CE6D9",
  no_show: "#D4D7DC",
};

type ApplicationRow = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
    interviewDetails: InterviewDetails | null;
    interviewResponseStatus: InterviewResponseStatus | null;
    jobseekerConfirmedAttendance: boolean;
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
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#F1ECFB] text-[#7C5CD1]">
        <UserIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />;
}

function InterviewRow({
  applicant,
  onView,
  draggable,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  applicant: ApplicationRow;
  onView: (id: string) => void;
  // Kanban view only — list view renders this with none of these set, so
  // it stays a plain click-only row there.
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const details = applicant.application.interviewDetails;
  const responseStatus = applicant.application.interviewResponseStatus;
  const responseColor = responseStatus ? INTERVIEW_RESPONSE_STATUS_COLOR[responseStatus] : null;
  return (
    <button
      type="button"
      onClick={() => onView(applicant.application.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex flex-col gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] text-left transition-colors hover:bg-[#F1F4F8] sm:flex-row sm:items-start sm:justify-between ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-[10px]">
        <ApplicantAvatar url={applicant.applicantAvatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#141B2E]">{applicant.applicantName}</p>
          <p className="mt-[1px] truncate text-xs text-[#4B5468]">
            {applicant.applicantTargetRole} · {applicant.jobPostingTitle}
          </p>
          {details ? (
            <div className="mt-[8px] flex w-full flex-wrap items-center gap-x-[10px] gap-y-[2px] rounded-[10px] bg-[#F1ECFB] px-[10px] py-[6px]">
              <p className="flex shrink-0 items-center gap-[6px] text-xs text-[#7C5CD1]">
                <CalendarIcon className="h-[12px] w-[12px]" />
                Round {details.round} · {INTERVIEW_MODE_LABEL[details.mode]}
              </p>
              <p className="shrink-0 text-xs text-[#4B5468]">
                {new Date(details.scheduledAt).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  // Pinned so this renders identically on the server (whose
                  // process timezone can differ from the deploy region) and
                  // the client (the browser's local timezone) — otherwise
                  // this is the same hydration-mismatch class as
                  // InterviewCountdown's Date.now() bug, just triggered by
                  // TZ offset instead of elapsed time.
                  timeZone: "UTC",
                })}
                {details.durationMinutes ? ` · ${details.durationMinutes} min` : ""}
              </p>
              {applicant.application.status === "interview" && (
                <InterviewCountdown scheduledAt={details.scheduledAt} className="shrink-0 text-xs text-[#7C5CD1]" />
              )}
            </div>
          ) : (
            <p className="mt-[8px] text-xs text-[#9AA3B2]">No interview time set yet.</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-[6px] sm:items-end">
        {responseStatus && responseColor && (
          <span className={`rounded-full px-[10px] py-[3px] text-xs ${responseColor.bg} ${responseColor.text}`}>
            {INTERVIEW_RESPONSE_STATUS_LABEL[responseStatus]}
          </span>
        )}
        <span className="text-xs text-brand-teal-dark">View details →</span>
      </div>
    </button>
  );
}

export default function EmployerInterviewsView({
  authUser,
  applications,
  shortlisted,
  addresses,
}: {
  authUser: AuthUser;
  applications: ApplicationRow[];
  shortlisted: ApplicationRow[];
  addresses: EmployerAddress[];
}) {
  const router = useRouter();
  // Shortlisted applicants aren't scheduled yet, so they're excluded from
  // the Scheduled/Interviewed/Evaluated sections below (those filter on
  // status), but merging them into the same rows array lets the "Schedule
  // interview" picker open the same ApplicantDetailModal/viewingId flow as
  // every other row here, and lets updateStatus's existing row-update logic
  // pick up the shortlisted -> interview transition without a special case.
  const [rows, setRows] = useState([...applications, ...shortlisted]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [dummyBusy, setDummyBusy] = useState(false);
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  // Kanban drag state — dragOverKey highlights the column under the
  // pointer, draggingId dims the card being dragged.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerJobPostingId, setPickerJobPostingId] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  // Set right before opening the modal from the "Schedule interview"
  // applicant picker — unlike the calendar "+" flow, that path has no date
  // to pre-fill (initialInterviewDate stays undefined), so without this the
  // modal would open on the plain detail view instead of the scheduling
  // form, even though scheduling was the entire point of picking them.
  const [openViaSchedulePicker, setOpenViaSchedulePicker] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [responseFilter, setResponseFilter] = useState<InterviewResponseStatus | null>(null);

  function toggleResponseFilter(status: InterviewResponseStatus) {
    setResponseFilter((prev) => (prev === status ? null : status));
  }

  function openPickerForDate(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    setPickerDate(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
    setPickerJobPostingId(null);
    setPickerOpen(true);
  }
  const viewingApplicant = rows.find((r) => r.application.id === viewingId) ?? null;
  const hasDummyData = rows.some((r) => DUMMY_APPLICANT_NAMES.includes(r.applicantName));
  const shortlistedRows = rows.filter((row) => row.application.status === "shortlisted");
  const shortlistedJobPostings = Array.from(
    new Map(shortlistedRows.map((row) => [row.jobPostingId, row.jobPostingTitle])).entries(),
  ).map(([id, title]) => ({
    id,
    title,
    count: shortlistedRows.filter((row) => row.jobPostingId === id).length,
  }));
  const pickerApplicants = pickerJobPostingId
    ? shortlistedRows.filter((row) => row.jobPostingId === pickerJobPostingId)
    : [];

  // router.refresh() re-fetches the server component and passes new
  // `applications`/`shortlisted` props down, but useState only reads its
  // initializer once on mount — resync during render (React's sanctioned
  // pattern for deriving state from a changed prop) whenever either prop
  // actually changes.
  const [prevApplications, setPrevApplications] = useState(applications);
  const [prevShortlisted, setPrevShortlisted] = useState(shortlisted);
  if (applications !== prevApplications || shortlisted !== prevShortlisted) {
    setPrevApplications(applications);
    setPrevShortlisted(shortlisted);
    setRows([...applications, ...shortlisted]);
  }

  async function toggleDummyData() {
    setDummyBusy(true);
    try {
      if (hasDummyData) {
        await fetch("/api/employer/applications/dummy", { method: "DELETE" });
        await fetch("/api/employer/job-postings/dummy", { method: "DELETE" });
        await fetch("/api/employer/dummy-companies", { method: "DELETE" });
      } else {
        await fetch("/api/employer/job-postings/dummy", { method: "POST" });
        await fetch("/api/employer/applications/dummy", { method: "POST" });
        await fetch("/api/employer/dummy-companies", { method: "POST" });
      }
      window.dispatchEvent(new Event(COMPANIES_CHANGED_EVENT));
      router.refresh();
    } finally {
      setDummyBusy(false);
    }
  }
  const calendarInterviews = rows
    .filter((row) => row.application.interviewDetails)
    .map((row) => ({
      applicationId: row.application.id,
      applicantName: row.applicantName,
      jobPostingTitle: row.jobPostingTitle,
      status: row.application.status,
      details: row.application.interviewDetails as InterviewDetails,
    }));

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
        status === "interview" || status === "interviewed" || status === "evaluation" || status === "evaluated"
          ? prev.map((row) =>
              row.application.id === applicationId
                ? { ...row, application: { ...row.application, status, interviewDetails: interviewDetails ?? row.application.interviewDetails } }
                : row,
            )
          // Moving off interview/interviewed/evaluation/evaluated
          // (kiv/offer/hired/rejected) takes the applicant out of this
          // list, same as they'd leave any other status-filtered view.
          : prev.filter((row) => row.application.id !== applicationId),
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
            ? { ...row, application: { ...row.application, interviewResponseStatus, status: "interviewed" } }
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

  // Today / this week / this month counts for the at-a-glance tiles above
  // the calendar — all calendar-based windows (Mon-Sun, 1st-end of month),
  // not rolling 7/30-day windows.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - ((startOfToday.getDay() + 6) % 7) * 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  function countInterviewsBetween(start: Date, end: Date) {
    return calendarInterviews.filter((interview) => {
      const scheduledAt = new Date(interview.details.scheduledAt);
      return scheduledAt >= start && scheduledAt < end;
    }).length;
  }

  const interviewCounts = {
    today: countInterviewsBetween(startOfToday, endOfToday),
    thisWeek: countInterviewsBetween(startOfWeek, endOfWeek),
    thisMonth: countInterviewsBetween(startOfMonth, endOfMonth),
  };

  // Soonest interview first — this page is a schedule, not an applied-order feed.
  function bySoonest(a: ApplicationRow, b: ApplicationRow) {
    const aTime = a.application.interviewDetails ? new Date(a.application.interviewDetails.scheduledAt).getTime() : Infinity;
    const bTime = b.application.interviewDetails ? new Date(b.application.interviewDetails.scheduledAt).getTime() : Infinity;
    return aTime - bTime;
  }
  const scheduled = rows.filter((row) => row.application.status === "interview").sort(bySoonest);
  const interviewed = rows.filter((row) => row.application.status === "interviewed").sort(bySoonest);
  const inEvaluation = rows.filter((row) => row.application.status === "evaluation").sort(bySoonest);
  const evaluated = rows.filter((row) => row.application.status === "evaluated").sort(bySoonest);

  // Only narrows what List/Kanban render — tile counts and the calendar
  // stay based on the unfiltered arrays above, so searching for a name or
  // filtering by response status doesn't make "Today"/"This week" or the
  // calendar chips lie.
  const trimmedNameQuery = nameQuery.trim().toLowerCase();
  const hasActiveFilter = !!responseFilter || !!trimmedNameQuery;
  function matchesFilters(row: ApplicationRow) {
    return (
      (!trimmedNameQuery || row.applicantName.toLowerCase().includes(trimmedNameQuery)) &&
      (!responseFilter || row.application.interviewResponseStatus === responseFilter)
    );
  }
  const visibleScheduled = scheduled.filter(matchesFilters);
  const visibleInterviewed = interviewed.filter(matchesFilters);
  const visibleInEvaluation = inEvaluation.filter(matchesFilters);
  const visibleEvaluated = evaluated.filter(matchesFilters);

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="interviews"
      heading="Interviews"
      headerAction={
        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="flex h-[38px] items-center rounded-full border border-black/[0.1] p-[3px]">
            {(["list", "kanban", "calendar"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`flex h-[30px] items-center justify-center rounded-full px-[14px] text-sm capitalize transition-colors ${
                  view === v ? "bg-brand-teal-dark text-white" : "text-[#4B5468] hover:bg-black/[0.03]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPickerDate(null);
              setPickerJobPostingId(null);
              setPickerOpen(true);
            }}
            className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark px-[16px] text-sm text-white hover:opacity-90"
          >
            Schedule interview
          </button>
          <button
            type="button"
            disabled={dummyBusy}
            onClick={toggleDummyData}
            className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hasDummyData ? "Remove dummy data" : "Get dummy data"}
          </button>
        </div>
      }
      subheading="Everyone currently scheduled for an interview, across every job posting."
    >
      <div className={`${gradientFrameClass("teal")} mx-auto w-full max-w-[1440px]`}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <button
            type="button"
            onClick={() => setHowItWorksOpen((o) => !o)}
            aria-expanded={howItWorksOpen}
            className="flex w-full items-center gap-[8px] text-left"
          >
            <p className="text-sm text-[#141B2E]">How scheduling interviews works</p>
            <ChevronDownIcon
              className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${howItWorksOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {howItWorksOpen && (
            <div className="mt-[12px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: 1, title: "Pick a shortlisted applicant", detail: "\"Schedule interview\" → pick a job posting → pick who to interview." },
                { step: 2, title: "Or start from the calendar", detail: "Click \"+\" on a calendar day to schedule with that date already filled in." },
                { step: 3, title: "Set round, mode, date & time", detail: "Onsite, online, or phone — with location or meeting link as needed." },
                { step: 4, title: "Track through to evaluation", detail: "Mark attendance after the interview, then evaluate from the Applicants page." },
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

      <div className={`${gradientFrameClass("teal")} mx-auto mt-[20px] w-full max-w-[1440px]`}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="mb-[12px] text-sm text-[#141B2E]">Interview status</p>
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-6">
            {INTERVIEW_RESPONSE_STATUS_ORDER.map((responseStatus) => {
              const count = rows.filter((row) => row.application.interviewResponseStatus === responseStatus).length;
              const color = INTERVIEW_RESPONSE_STATUS_COLOR[responseStatus];
              const Icon = INTERVIEW_RESPONSE_STATUS_ICON[responseStatus];
              const gradient = INTERVIEW_RESPONSE_STATUS_GRADIENT[responseStatus];
              const isActive = responseFilter === responseStatus;
              return (
                <button
                  type="button"
                  key={responseStatus}
                  disabled={count === 0}
                  onClick={() => toggleResponseFilter(responseStatus)}
                  style={{ backgroundImage: `linear-gradient(to bottom, ${gradient}, white 90%)` }}
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
                    {INTERVIEW_RESPONSE_STATUS_LABEL[responseStatus]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {view !== "calendar" && (
        <div className="mx-auto mt-[20px] flex w-full max-w-[1440px] flex-wrap items-center gap-[8px]">
          <div className="flex h-[38px] flex-1 min-w-[200px] items-center gap-[6px] rounded-full border border-black/[0.1] bg-white px-[14px]">
            <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by applicant name..."
              className="w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setResponseFilter(null);
                setNameQuery("");
              }}
              className="shrink-0 text-sm text-brand-teal-dark hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      {view !== "calendar" && responseFilter && (
        <p className="mx-auto mt-[6px] w-full max-w-[1440px] text-xs text-[#9AA3B2]">
          Showing only{" "}
          <span className="text-[#4B5468]">{INTERVIEW_RESPONSE_STATUS_LABEL[responseFilter]}</span>{" "}
          interviews.
        </p>
      )}

      {view === "calendar" ? (
        <div className={`${gradientFrameClass("teal")} mx-auto mt-[20px] w-full max-w-[1440px]`}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <InterviewBigCalendar
              interviews={calendarInterviews}
              onSelectInterview={setViewingId}
              onScheduleDate={openPickerForDate}
            />
          </div>
        </div>
      ) : view === "kanban" ? (
        <div className="mx-auto mt-[12px] grid w-full max-w-[1440px] grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {statusError && (
            <p className="col-span-full text-xs text-red-500">{statusError}</p>
          )}
          {(
            [
              {
                key: "scheduled",
                statusKey: "interview",
                label: "Scheduled",
                pillBg: "bg-[#F1ECFB]",
                pillText: "text-[#7C5CD1]",
                rows: visibleScheduled,
                empty: hasActiveFilter
                  ? "No one matches that search."
                  : "No one’s scheduled for an interview right now — move an applicant to the Interview stage from the Applicants page to see them here.",
              },
              {
                key: "interviewed",
                statusKey: "interviewed",
                label: "Interviewed",
                pillBg: "bg-[#E8F1FF]",
                pillText: "text-[#2B6CB0]",
                rows: visibleInterviewed,
                empty: hasActiveFilter
                  ? "No one matches that search."
                  : "No one’s completed an interview yet — once you mark attendance, they’ll show up here awaiting evaluation.",
              },
              {
                key: "evaluation",
                statusKey: "evaluation",
                label: "Evaluation",
                pillBg: "bg-[#FFE9D6]",
                pillText: "text-[#B45309]",
                rows: visibleInEvaluation,
                empty: hasActiveFilter
                  ? "No one matches that search."
                  : "No one’s mid-evaluation right now — starting an evaluation from Interviewed will show them here.",
              },
              {
                key: "evaluated",
                statusKey: "evaluated",
                label: "Evaluated",
                pillBg: "bg-[#EDFBF4]",
                pillText: "text-[#0F9D6C]",
                rows: visibleEvaluated,
                empty: hasActiveFilter
                  ? "No one matches that search."
                  : "No one’s been evaluated yet — save an evaluation on an interviewed candidate to see them here, ready for an offer or reject decision.",
              },
            ] as const
          ).map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                setDragOverKey(col.key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverKey(null);
                const id = e.dataTransfer.getData("text/plain");
                const row = rows.find((r) => r.application.id === id);
                setDraggingId(null);
                if (!row || row.application.status === col.statusKey) return;
                // Every cross-column move needs a real action first —
                // marking attendance to reach Interviewed, or saving an
                // evaluation to reach Evaluated — so dropping here opens
                // that applicant's modal to complete it, rather than
                // silently flipping the status and skipping the step.
                setViewingId(id);
              }}
              className={`${gradientFrameClass("teal")} rounded-[20px] transition-shadow ${
                dragOverKey === col.key ? "ring-2 ring-brand-teal-dark ring-offset-2" : ""
              }`}
            >
              <div className="flex flex-col rounded-[19px] bg-white p-[18px]">
                <div className="flex items-center gap-[8px]">
                  <p className="text-sm text-[#141B2E]">{col.label}</p>
                  <span className={`rounded-full px-[10px] py-[3px] text-xs ${col.pillBg} ${col.pillText}`}>
                    {col.rows.length}
                  </span>
                </div>
                {col.rows.length === 0 ? (
                  <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">{col.empty}</p>
                ) : (
                  <div className="mt-[14px] flex max-h-[70vh] flex-col gap-[10px] overflow-y-auto">
                    {col.rows.map((applicant) => (
                      <InterviewRow
                        key={applicant.application.id}
                        applicant={applicant}
                        onView={setViewingId}
                        draggable
                        dragging={draggingId === applicant.application.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", applicant.application.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(applicant.application.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverKey(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="mx-auto mt-[12px] flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
      <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:flex-[1]">
        <div className={gradientFrameClass("teal")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <p className="mb-[12px] text-sm text-[#141B2E]">Calendar</p>
            <div className="flex flex-col gap-[12px]">
              <div className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <div className="flex items-start justify-between">
                  <span className="text-xl text-[#141B2E]">{interviewCounts.today}</span>
                  <CalendarIcon className="h-[16px] w-[16px] text-[#9AA3B2]" />
                </div>
                <span className="text-xs text-[#4B5468]">Today</span>
              </div>
              <div className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <div className="flex items-start justify-between">
                  <span className="text-xl text-[#141B2E]">{interviewCounts.thisWeek}</span>
                  <CalendarIcon className="h-[16px] w-[16px] text-[#9AA3B2]" />
                </div>
                <span className="text-xs text-[#4B5468]">This week</span>
              </div>
              <div className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <div className="flex items-start justify-between">
                  <span className="text-xl text-[#141B2E]">{interviewCounts.thisMonth}</span>
                  <CalendarIcon className="h-[16px] w-[16px] text-[#9AA3B2]" />
                </div>
                <span className="text-xs text-[#4B5468]">This month</span>
              </div>
            </div>
            <div className="mt-[16px] border-t border-black/[0.06] pt-[16px]">
              <InterviewCalendarCard interviews={calendarInterviews} onScheduleDate={openPickerForDate} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${gradientFrameClass("teal")} min-w-0 lg:flex-[3]`}>
        <div className="rounded-[19px] bg-white p-[22px]">
          {statusError && <p className="text-xs text-red-500">{statusError}</p>}

          <div className="flex items-center gap-[8px]">
            <p className="text-sm text-[#141B2E]">Scheduled</p>
            <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">
              {visibleScheduled.length}
            </span>
          </div>
          {visibleScheduled.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              {hasActiveFilter
                ? "No one matches that search."
                : "No one’s scheduled for an interview right now — move an applicant to the Interview stage from the Applicants page to see them here."}
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visibleScheduled.map((applicant) => (
                <InterviewRow key={applicant.application.id} applicant={applicant} onView={setViewingId} />
              ))}
            </div>
          )}

          <div className="mt-[24px] flex items-center gap-[8px] border-t border-black/[0.06] pt-[24px]">
            <p className="text-sm text-[#141B2E]">Interviewed</p>
            <span className="rounded-full bg-[#E8F1FF] px-[10px] py-[3px] text-xs text-[#2B6CB0]">
              {visibleInterviewed.length}
            </span>
          </div>
          {visibleInterviewed.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              {hasActiveFilter
                ? "No one matches that search."
                : "No one’s completed an interview yet — once you mark attendance, they’ll show up here awaiting evaluation."}
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visibleInterviewed.map((applicant) => (
                <InterviewRow key={applicant.application.id} applicant={applicant} onView={setViewingId} />
              ))}
            </div>
          )}

          <div className="mt-[24px] flex items-center gap-[8px] border-t border-black/[0.06] pt-[24px]">
            <p className="text-sm text-[#141B2E]">Evaluation</p>
            <span className="rounded-full bg-[#FFE9D6] px-[10px] py-[3px] text-xs text-[#B45309]">
              {visibleInEvaluation.length}
            </span>
          </div>
          {visibleInEvaluation.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              {hasActiveFilter
                ? "No one matches that search."
                : "No one’s mid-evaluation right now — starting an evaluation from Interviewed will show them here."}
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visibleInEvaluation.map((applicant) => (
                <InterviewRow key={applicant.application.id} applicant={applicant} onView={setViewingId} />
              ))}
            </div>
          )}

          <div className="mt-[24px] flex items-center gap-[8px] border-t border-black/[0.06] pt-[24px]">
            <p className="text-sm text-[#141B2E]">Evaluated</p>
            <span className="rounded-full bg-[#EDFBF4] px-[10px] py-[3px] text-xs text-[#0F9D6C]">
              {visibleEvaluated.length}
            </span>
          </div>
          {visibleEvaluated.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              {hasActiveFilter
                ? "No one matches that search."
                : "No one’s been evaluated yet — save an evaluation on an interviewed candidate to see them here, ready for an offer or reject decision."}
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visibleEvaluated.map((applicant) => (
                <InterviewRow key={applicant.application.id} applicant={applicant} onView={setViewingId} />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
      )}

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
          onClose={() => {
            setViewingId(null);
            setPickerDate(null);
            setOpenViaSchedulePicker(false);
          }}
          initialInterviewDate={pickerDate ?? undefined}
          autoOpenInterviewForm={openViaSchedulePicker}
        />
      )}

      {pickerOpen && !pickerJobPostingId && (
        <Modal onClose={() => setPickerOpen(false)} ariaLabel="Schedule an interview">
          <h2 className="text-lg font-semibold text-[#141B2E]">
            {pickerDate
              ? `Schedule an interview on ${new Date(`${pickerDate}T00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}`
              : "Schedule an interview"}
          </h2>
          <p className="mt-[4px] text-xs text-[#4B5468]">
            Pick a job posting to see its shortlisted applicants.
          </p>
          {shortlistedJobPostings.length === 0 ? (
            <p className="mt-[16px] rounded-[12px] bg-[#F8FAFB] p-[14px] text-xs text-[#9AA3B2]">
              No shortlisted applicants yet — shortlist someone from a job posting&rsquo;s Applicants tab first.
            </p>
          ) : (
            <div className="mt-[16px] flex max-h-[360px] flex-col gap-[8px] overflow-y-auto">
              {shortlistedJobPostings.map((posting) => (
                <button
                  key={posting.id}
                  type="button"
                  onClick={() => setPickerJobPostingId(posting.id)}
                  className="flex items-center justify-between gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] text-left transition-colors hover:bg-[#F1F4F8]"
                >
                  <span className="truncate text-xs text-[#141B2E]">{posting.title}</span>
                  <span className="shrink-0 rounded-full bg-[#F1ECFB] px-[9px] py-[2px] text-xs text-[#7C5CD1]">
                    {posting.count} shortlisted
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="mt-[16px] flex h-[36px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
          >
            Cancel
          </button>
        </Modal>
      )}

      {pickerOpen && pickerJobPostingId && (
        <Modal onClose={() => setPickerOpen(false)} ariaLabel="Pick a shortlisted applicant">
          <button
            type="button"
            onClick={() => setPickerJobPostingId(null)}
            className="text-sm text-[#4B5468] hover:text-[#141B2E]"
          >
            ← Back to job postings
          </button>
          <h2 className="mt-[10px] text-lg font-semibold text-[#141B2E]">
            {pickerApplicants[0]?.jobPostingTitle ?? "Shortlisted applicants"}
          </h2>
          <p className="mt-[4px] text-xs text-[#4B5468]">
            Pick an applicant to set up their interview — round, date, time, and mode.
          </p>
          <div className="mt-[16px] flex max-h-[360px] flex-col gap-[8px] overflow-y-auto">
            {pickerApplicants.map((applicant) => (
              <button
                key={applicant.application.id}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setOpenViaSchedulePicker(true);
                  setViewingId(applicant.application.id);
                }}
                className="flex items-center gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px] text-left transition-colors hover:bg-[#F1F4F8]"
              >
                <ApplicantAvatar url={applicant.applicantAvatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#141B2E]">{applicant.applicantName}</p>
                  <p className="mt-[1px] truncate text-xs text-[#4B5468]">{applicant.applicantTargetRole}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="mt-[16px] flex h-[36px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
          >
            Cancel
          </button>
        </Modal>
      )}
    </EmployerDashboardShell>
  );
}

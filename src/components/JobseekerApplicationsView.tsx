"use client";

import { useState } from "react";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import { gradientFrameClass } from "./formStyles";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  INTERVIEW_MODE_LABEL,
  INTERVIEW_RESPONSE_STATUS_COLOR,
  INTERVIEW_RESPONSE_STATUS_LABEL,
  relativeTimeAgo,
  type InterviewDetails,
  type InterviewResponseStatus,
} from "@/lib/applicationStatus";
import { CalendarIcon, UserIcon } from "./icons";
import { STATUS_ICON, STATUS_TILE_GRADIENT } from "./applicationStatusTiles";
import InterviewCountdown from "./InterviewCountdown";
import type { AuthUser } from "./AuthModal";
import ApplicationTracker from "./ApplicationTracker";
import type { ApplicationEvent, EmployerResponsiveness } from "@/lib/responsiveness";

type ApplicationRow = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
    interviewDetails: InterviewDetails | null;
    interviewResponseStatus: InterviewResponseStatus | null;
    jobseekerConfirmedAttendance: boolean;
  };
  posting: {
    id: string;
    title: string;
    location: string;
  };
  companyName: string;
  // Step-by-step history and the employer's typical reply time, for the tracker.
  events: ApplicationEvent[];
  responsiveness: EmployerResponsiveness | null;
};

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

export default function JobseekerApplicationsView({
  authUser,
  resume,
  applications,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  applications: ApplicationRow[];
}) {
  const [rows, setRows] = useState(applications);
  // Captured once — calling Date.now() during render is impure.
  const [now] = useState(() => Date.now());
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);

  async function respondToInterview(applicationId: string, response: "accepted" | "declined" | "reschedule_requested") {
    setResponseError(null);
    setRespondingId(applicationId);
    try {
      const res = await fetch(`/api/jobseeker/applications/${applicationId}/interview-response`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send your response.");
      setRows((prev) =>
        prev.map((row) =>
          row.application.id === applicationId
            ? { ...row, application: { ...row.application, interviewResponseStatus: response } }
            : row,
        ),
      );
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : "Couldn't send your response.");
    } finally {
      setRespondingId(null);
    }
  }

  async function confirmAttendance(applicationId: string) {
    setResponseError(null);
    setRespondingId(applicationId);
    try {
      const res = await fetch(`/api/jobseeker/applications/${applicationId}/attendance`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't confirm your attendance.");
      setRows((prev) =>
        prev.map((row) =>
          row.application.id === applicationId ? { ...row, application: { ...row.application, jobseekerConfirmedAttendance: true } } : row,
        ),
      );
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : "Couldn't confirm your attendance.");
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="applications"
      heading="My Applications"
      subheading="Every job you've applied to, and where things stand."
      resume={resume}
    >
      <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <p className="mb-[12px] text-sm text-[#141B2E]">Applications at a glance</p>
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-4 lg:grid-cols-5">
            {/* Same tile treatment as the employer's "Applicants at a glance". */}
            <div
              style={{ backgroundImage: "linear-gradient(to bottom, #C9CFDA, white 90%)" }}
              className={`gradient-noise relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] ${
                rows.length > 0 ? "" : "opacity-60"
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
              <span className="relative text-xs text-[#4B5468]">Total applications</span>
            </div>
            {STATUS_ORDER.map((status) => {
              const count = rows.filter((a) => a.application.status === status).length;
              const color = APPLICATION_STATUS_COLOR[status] ?? APPLICATION_STATUS_COLOR.applied;
              const Icon = STATUS_ICON[status];
              const gradient = STATUS_TILE_GRADIENT[status];
              return (
                <div
                  key={status}
                  style={{ backgroundImage: `linear-gradient(to bottom, ${gradient}, white 90%)` }}
                  className={`gradient-noise relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] ${
                    count > 0 ? "" : "opacity-60"
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
                </div>
              );
            })}
          </div>

          <div className="mt-[24px]">
            <p className="text-sm text-[#141B2E]">All applications</p>
            {responseError && <p className="mt-[6px] text-xs text-red-500">{responseError}</p>}

            {rows.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                You haven&rsquo;t applied to anything yet — jobs you apply to will show up here.
              </p>
            ) : (
              <div className="mt-[10px] flex flex-col gap-[10px]">
                {rows.map(({ application, posting, companyName, events, responsiveness }) => {
                  const color = APPLICATION_STATUS_COLOR[application.status] ?? APPLICATION_STATUS_COLOR.applied;
                  const details = application.interviewDetails;
                  const responseStatus = application.interviewResponseStatus;
                  const responseColor = responseStatus ? INTERVIEW_RESPONSE_STATUS_COLOR[responseStatus] : null;
                  const interviewTimeHasPassed = !!details && new Date(details.scheduledAt).getTime() <= now;
                  return (
                    <div
                      key={application.id}
                      className="flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]"
                    >
                      <div className="flex flex-col gap-[8px] sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[#141B2E]">{posting.title}</p>
                          <p className="mt-[2px] text-xs text-[#4B5468]">
                            {companyName} · {posting.location || "Location not set"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-[10px]">
                          <span className="text-xs text-[#9AA3B2]">
                            Applied {relativeTimeAgo(application.appliedAt)}
                          </span>
                          <span
                            className={`rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}
                          >
                            {APPLICATION_STATUS_LABEL[application.status] ?? application.status}
                          </span>
                        </div>
                      </div>

                      <ApplicationTracker
                        status={application.status}
                        appliedAt={application.appliedAt}
                        events={events}
                        companyName={companyName}
                        responsiveness={responsiveness}
                        now={now}
                      />

                      {(application.status === "interview" ||
                        application.status === "interviewed" ||
                        application.status === "evaluation" ||
                        application.status === "evaluated") &&
                        details && (
                        <div className="rounded-[12px] bg-[#F1ECFB] p-[12px]">
                          <div className="flex flex-wrap items-center justify-between gap-[6px]">
                            <p className="flex items-center gap-[6px] text-xs text-[#7C5CD1]">
                              <CalendarIcon className="h-[12px] w-[12px]" />
                              Round {details.round} · {INTERVIEW_MODE_LABEL[details.mode]}
                            </p>
                            {responseStatus && responseColor && (
                              <span
                                className={`rounded-full px-[9px] py-[2px] text-xs ${responseColor.bg} ${responseColor.text}`}
                              >
                                {INTERVIEW_RESPONSE_STATUS_LABEL[responseStatus]}
                              </span>
                            )}
                          </div>
                          <p className="mt-[4px] text-xs text-[#4B5468]">
                            {new Date(details.scheduledAt).toLocaleString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {details.durationMinutes ? ` · ${details.durationMinutes} min` : ""}
                          </p>
                          <InterviewCountdown scheduledAt={details.scheduledAt} className="mt-[4px] text-xs text-[#7C5CD1]" />
                          {details.mode === "onsite" && details.location && (
                            <p className="mt-[4px] text-xs text-[#4B5468]">📍 {details.location}</p>
                          )}
                          {details.mode === "online" && details.meetingLink && (
                            <p className="mt-[4px] truncate text-xs text-[#7C5CD1]">🔗 {details.meetingLink}</p>
                          )}
                          {details.notes && <p className="mt-[4px] text-xs text-[#4B5468]">{details.notes}</p>}

                          {responseStatus === "pending" && (
                            <div className="mt-[10px] flex flex-wrap gap-[6px]">
                              <button
                                type="button"
                                disabled={respondingId === application.id}
                                onClick={() => respondToInterview(application.id, "accepted")}
                                className="flex h-[30px] items-center justify-center rounded-full bg-brand-gold-dark px-[14px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Accept invite
                              </button>
                              <button
                                type="button"
                                disabled={respondingId === application.id}
                                onClick={() => respondToInterview(application.id, "reschedule_requested")}
                                className="flex h-[30px] items-center justify-center rounded-full border border-black/[0.1] px-[14px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Request reschedule
                              </button>
                              <button
                                type="button"
                                disabled={respondingId === application.id}
                                onClick={() => respondToInterview(application.id, "declined")}
                                className="flex h-[30px] items-center justify-center rounded-full border border-red-200 px-[14px] text-sm text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {responseStatus !== "declined" &&
                            responseStatus !== "reschedule_requested" &&
                            responseStatus !== "pending" &&
                            !application.jobseekerConfirmedAttendance && (
                              <div className="mt-[10px]">
                                {!interviewTimeHasPassed && (
                                  <p className="mb-[6px] text-xs text-[#4B5468]">
                                    This unlocks once your interview time arrives — come back and confirm you made it
                                    so the employer knows you showed up.
                                  </p>
                                )}
                                <button
                                  type="button"
                                  disabled={respondingId === application.id || !interviewTimeHasPassed}
                                  onClick={() => confirmAttendance(application.id)}
                                  className="flex h-[30px] items-center justify-center rounded-full bg-brand-gold-dark px-[14px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  I attended this interview
                                </button>
                              </div>
                            )}
                          {application.jobseekerConfirmedAttendance && (
                            <p className="mt-[10px] text-xs text-[#008990]">
                              ✓ You confirmed attendance
                            </p>
                          )}
                        </div>
                      )}
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

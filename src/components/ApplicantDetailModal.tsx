"use client";

import { useEffect, useState } from "react";
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
import { CheckIcon, FileIcon, UserIcon, XIcon } from "./icons";
import DatePicker from "./DatePicker";
import Dropdown from "./Dropdown";
import TimePicker from "./TimePicker";
import InterviewCountdown from "./InterviewCountdown";
import RichTextContent from "./RichTextContent";
import type { EmployerAddress } from "@/lib/employer-profile";
import type { JobseekerProfile } from "@/lib/jobseeker-profile";
import {
  EVALUATION_CRITERIA,
  EVALUATION_CRITERION_LABEL,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABEL,
  type EvaluationCriterion,
  type InterviewEvaluation,
  type InterviewRecommendation,
} from "@/lib/interviewEvaluation";

const PIPELINE_STATUSES = ["applied", "screened", "shortlisted", "interview", "interviewed", "evaluation", "evaluated", "offer", "hired"];
const INTERVIEW_MODES: InterviewDetails["mode"][] = ["onsite", "online", "phone"];
const RECOMMENDATIONS: InterviewRecommendation[] = ["strong_hire", "hire", "no_hire", "strong_no_hire"];

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};
const MARITAL_STATUS_LABEL: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
  prefer_not_to_say: "Prefer not to say",
};
const WORK_AUTHORIZATION_LABEL: Record<string, string> = {
  citizen: "Malaysian citizen",
  permanent_resident: "Permanent resident",
  work_pass_holder: "Work pass holder",
  needs_sponsorship: "Open to sponsorship",
};
const DRIVING_LICENSE_LABEL: Record<string, string> = {
  b2: "B2 (motorcycle)",
  b: "B (car)",
  d: "D (bus)",
  da: "DA (bus + trailer)",
  e: "E (lorry)",
};
const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
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

export type ApplicantDetail = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
    interviewDetails: InterviewDetails | null;
    interviewResponseStatus?: InterviewResponseStatus | null;
    jobseekerConfirmedAttendance?: boolean;
  };
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
  evaluation?: InterviewEvaluation | null;
};

const inputClass =
  "h-[34px] w-full rounded-[10px] border border-black/[0.1] px-[10px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark";

function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function ApplicantDetailModal({
  applicant,
  updating,
  onUpdateStatus,
  onSetAttendance,
  onSaveEvaluation,
  savingEvaluation,
  onClose,
  initialInterviewDate,
  autoOpenInterviewForm,
  addresses = [],
}: {
  applicant: ApplicantDetail;
  updating: boolean;
  onUpdateStatus: (status: string, interviewDetails?: InterviewDetails) => void;
  onSetAttendance?: (status: "attended" | "no_show") => void;
  onSaveEvaluation?: (
    scores: Partial<Record<EvaluationCriterion, number>>,
    recommendation: InterviewRecommendation,
    notes: string,
  ) => void;
  savingEvaluation?: boolean;
  onClose: () => void;
  // Set when this modal was opened by picking a date on the interview
  // calendar rather than from an applicant list — pre-fills and
  // auto-expands the scheduling form ("YYYY-MM-DD") instead of making the
  // employer click "Interview" and re-enter the date they just picked.
  initialInterviewDate?: string;
  // Set when this modal was opened straight from a "pick who to schedule"
  // flow (e.g. the Interviews page's "Schedule interview" picker) — auto-
  // expands the scheduling form even though there's no date to pre-fill,
  // since scheduling is the entire reason this applicant was picked.
  autoOpenInterviewForm?: boolean;
  // The employer's saved office addresses (Company Profile) — same list
  // "Post a job"'s own location field picks from, so an onsite interview
  // can reuse one instead of retyping it.
  addresses?: EmployerAddress[];
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showInterviewForm, setShowInterviewForm] = useState(!!initialInterviewDate || !!autoOpenInterviewForm);
  const [fullProfile, setFullProfile] = useState<JobseekerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [evaluationScores, setEvaluationScores] = useState<Partial<Record<EvaluationCriterion, number>>>(
    applicant.evaluation?.scores ?? {},
  );
  const [evaluationRecommendation, setEvaluationRecommendation] = useState<InterviewRecommendation | null>(
    applicant.evaluation?.recommendation ?? null,
  );
  const [evaluationNotes, setEvaluationNotes] = useState(applicant.evaluation?.notes ?? "");
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationLocked, setEvaluationLocked] = useState(!!applicant.evaluation);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`/api/employer/applications/${applicant.application.id}/profile`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load this applicant's profile.");
        if (!cancelled) setFullProfile(data.profile);
      } catch (err) {
        if (!cancelled) setProfileError(err instanceof Error ? err.message : "Couldn't load this applicant's profile.");
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicant.application.id]);

  const existing = applicant.application.interviewDetails;
  const isAtOrPastInterviewStage = !["applied", "screened", "shortlisted"].includes(applicant.application.status);
  // Evaluation only unlocks once the employer has explicitly marked
  // attendance — the scheduled time passing on its own isn't enough, since
  // the employer might not have gotten to marking it yet.
  const interviewHasHappened =
    !!existing &&
    isAtOrPastInterviewStage &&
    (applicant.application.interviewResponseStatus === "no_show" ||
      (applicant.application.interviewResponseStatus === "attended" &&
        applicant.application.jobseekerConfirmedAttendance === true));
  // Attendance is marked, but the employer hasn't explicitly moved into
  // "Evaluation" yet — this is the exact "don't let it get forgotten" gap:
  // show a hard-to-miss prompt instead of quietly waiting for them to
  // notice the pipeline stage list.
  const readyToStartEvaluation = interviewHasHappened && applicant.application.status === "interviewed";
  // The actual score form (or its saved-evaluation summary) only shows once
  // they're really in the Evaluation step — not just because attendance was
  // marked — so "Evaluated" can't be reached by anything other than
  // finishing the form that's gated behind that explicit step.
  const canEvaluate =
    interviewHasHappened &&
    (applicant.application.status === "evaluation" || applicant.application.status === "evaluated");
  const existingDateTime = splitDateTime(existing?.scheduledAt ?? null);
  const todayIsoDate = splitDateTime(new Date().toISOString()).date;
  const [round, setRound] = useState(existing ? existing.round : 1);
  const [mode, setMode] = useState<InterviewDetails["mode"]>(existing?.mode ?? "onsite");
  const [date, setDate] = useState(existingDateTime.date || initialInterviewDate || "");
  const [time, setTime] = useState(existingDateTime.time);
  const [durationMinutes, setDurationMinutes] = useState(existing?.durationMinutes ? String(existing.durationMinutes) : "60");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [meetingLink, setMeetingLink] = useState(existing?.meetingLink ?? "");
  const [interviewerName, setInterviewerName] = useState(existing?.interviewerName ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const currentIndex = PIPELINE_STATUSES.indexOf(applicant.application.status);
  const isTerminal = applicant.application.status === "rejected" || applicant.application.status === "withdrawn";
  const color = APPLICATION_STATUS_COLOR[applicant.application.status] ?? APPLICATION_STATUS_COLOR.applied;

  // Screened -> Shortlisted just needs a deliberate confirm (the point where
  // the employer commits to considering the candidate). Shortlisted ->
  // Interview needs real scheduling details, not just a status flip — that's
  // the whole point of this feature.
  function handleStageClick(status: string) {
    if (status === "shortlisted" && applicant.application.status === "screened") {
      setPendingStatus(status);
      return;
    }
    if (status === "interview") {
      setFormError(null);
      setShowInterviewForm(true);
      return;
    }
    // Same reasoning as needsAttendanceFirst/needsEvaluationFirst below —
    // Interviewed only comes from the Attendance buttons, and Evaluated only
    // comes from actually saving scores (the server rejects a direct update
    // into "evaluated" outright).
    if (status === "interviewed" && applicant.application.status === "interview") return;
    if (status === "evaluated" && applicant.application.status !== "evaluation") return;
    onUpdateStatus(status);
  }

  function confirmPendingStatus() {
    if (!pendingStatus) return;
    onUpdateStatus(pendingStatus);
    setPendingStatus(null);
  }

  function submitInterviewDetails() {
    if (!date || !time) {
      setFormError("Pick a date and time for the interview.");
      return;
    }
    const scheduledAt = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setFormError("That date and time isn't valid.");
      return;
    }
    if (mode === "onsite" && !location.trim()) {
      setFormError("Add the interview location.");
      return;
    }
    if (mode === "online" && !meetingLink.trim()) {
      setFormError("Add the meeting link.");
      return;
    }

    setFormError(null);
    const details: InterviewDetails = {
      round,
      mode,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: durationMinutes.trim() ? Number(durationMinutes) : null,
      location: mode === "onsite" ? location.trim() : location.trim() || null,
      meetingLink: mode === "online" ? meetingLink.trim() : meetingLink.trim() || null,
      interviewerName: interviewerName.trim() || null,
      notes: notes.trim() || null,
    };
    onUpdateStatus("interview", details);
    setShowInterviewForm(false);
  }

  function setScore(criterion: EvaluationCriterion, value: number) {
    setEvaluationScores((prev) => ({ ...prev, [criterion]: value }));
  }

  function submitEvaluation() {
    if (Object.keys(evaluationScores).length === 0) {
      setEvaluationError("Rate at least one criterion.");
      return;
    }
    if (!evaluationRecommendation) {
      setEvaluationError("Pick a recommendation.");
      return;
    }
    setEvaluationError(null);
    onSaveEvaluation?.(evaluationScores, evaluationRecommendation, evaluationNotes.trim());
    setEvaluationLocked(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${applicant.applicantName} — applicant details`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
      >
        <div className="flex items-start justify-between gap-[12px] border-b border-black/[0.06] px-[22px] py-[18px]">
          <div className="flex items-start gap-[12px]">
            {applicant.applicantAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={applicant.applicantAvatarUrl}
                alt=""
                className="h-[46px] w-[46px] shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
                <UserIcon className="h-[20px] w-[20px]" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-[#141B2E]">{applicant.applicantName}</h2>
              <p className="mt-[1px] text-xs text-[#4B5468]">{applicant.applicantTargetRole}</p>
              <p className="mt-[2px] text-xs text-[#9AA3B2]">
                Applied for {applicant.jobPostingTitle} · {relativeTimeAgo(applicant.application.appliedAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
          >
            <XIcon className="h-[12px] w-[12px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] pt-[18px] pb-[40px] sm:basis-2/3">
            <div>
              <p className="text-xs text-[#141B2E]">Candidate details</p>
              <div className="mt-[10px] grid grid-cols-1 gap-x-[16px] gap-y-[10px] sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#9AA3B2]">Location</p>
                  <p className="text-xs text-[#141B2E]">{applicant.applicantLocation || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9AA3B2]">Experience</p>
                  <p className="text-xs text-[#141B2E]">
                    {applicant.applicantYearsExperience} year{applicant.applicantYearsExperience === 1 ? "" : "s"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9AA3B2]">Employment type</p>
                  <p className="text-xs text-[#141B2E]">
                    {EMPLOYMENT_TYPE_LABEL[applicant.applicantEmploymentType] ?? applicant.applicantEmploymentType}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9AA3B2]">Work arrangement</p>
                  <p className="text-xs text-[#141B2E]">
                    {WORK_ARRANGEMENT_LABEL[applicant.applicantWorkArrangement] ?? applicant.applicantWorkArrangement}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9AA3B2]">Expected salary</p>
                  <p className="text-xs text-[#141B2E]">
                    RM{applicant.applicantExpectedSalaryMin.toLocaleString()}–
                    {applicant.applicantExpectedSalaryMax.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#9AA3B2]">Notice period</p>
                  <p className="text-xs text-[#141B2E]">
                    {NOTICE_PERIOD_LABEL[applicant.applicantNoticePeriod] ?? applicant.applicantNoticePeriod}
                  </p>
                </div>
              </div>

              {applicant.applicantSkills.length > 0 && (
                <div className="mt-[14px]">
                  <p className="text-xs text-[#9AA3B2]">Skills</p>
                  <div className="mt-[6px] flex flex-wrap gap-[6px]">
                    {applicant.applicantSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#E6F9FA] px-[10px] py-[4px] text-xs text-brand-teal-dark"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {profileLoading && (
              <p className="text-xs text-[#9AA3B2]">Loading full profile…</p>
            )}
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}

            {fullProfile && (
              <>
                {fullProfile.bio && (
                  <div>
                    <p className="text-xs text-[#141B2E]">About</p>
                    <RichTextContent html={fullProfile.bio} className="mt-[4px] text-xs text-[#4B5468]" />
                  </div>
                )}

                <div>
                  <p className="text-xs text-[#141B2E]">Contact & personal</p>
                  <div className="mt-[10px] grid grid-cols-1 gap-x-[16px] gap-y-[10px] sm:grid-cols-2">
                    {fullProfile.phone && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Phone</p>
                        <p className="text-xs text-[#141B2E]">{fullProfile.phone}</p>
                      </div>
                    )}
                    {fullProfile.dateOfBirth && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Date of birth</p>
                        <p className="text-xs text-[#141B2E]">{fullProfile.dateOfBirth}</p>
                      </div>
                    )}
                    {fullProfile.gender && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Gender</p>
                        <p className="text-xs text-[#141B2E]">
                          {GENDER_LABEL[fullProfile.gender] ?? fullProfile.gender}
                        </p>
                      </div>
                    )}
                    {fullProfile.maritalStatus && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Marital status</p>
                        <p className="text-xs text-[#141B2E]">
                          {MARITAL_STATUS_LABEL[fullProfile.maritalStatus] ?? fullProfile.maritalStatus}
                        </p>
                      </div>
                    )}
                    {fullProfile.nationality && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Nationality</p>
                        <p className="text-xs text-[#141B2E]">{fullProfile.nationality}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#9AA3B2]">Work authorization</p>
                      <p className="text-xs text-[#141B2E]">
                        {WORK_AUTHORIZATION_LABEL[fullProfile.workAuthorization] ?? fullProfile.workAuthorization}
                      </p>
                    </div>
                    {fullProfile.drivingLicense && (
                      <div>
                        <p className="text-xs text-[#9AA3B2]">Driving license</p>
                        <p className="text-xs text-[#141B2E]">
                          {DRIVING_LICENSE_LABEL[fullProfile.drivingLicense] ?? fullProfile.drivingLicense}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {(fullProfile.linkedinUrl || fullProfile.portfolioUrl || fullProfile.githubUrl) && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Links</p>
                    <div className="mt-[6px] flex flex-wrap gap-[8px] text-xs">
                      {fullProfile.linkedinUrl && (
                        <a
                          href={fullProfile.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal-dark hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                      {fullProfile.portfolioUrl && (
                        <a
                          href={fullProfile.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal-dark hover:underline"
                        >
                          Portfolio
                        </a>
                      )}
                      {fullProfile.githubUrl && (
                        <a
                          href={fullProfile.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-teal-dark hover:underline"
                        >
                          GitHub
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {fullProfile.softSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Soft skills</p>
                    <div className="mt-[6px] flex flex-wrap gap-[6px]">
                      {fullProfile.softSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-xs text-[#141B2E]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {fullProfile.workExperiences.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Work experience</p>
                    <div className="mt-[8px] flex flex-col gap-[10px]">
                      {fullProfile.workExperiences.map((exp) => (
                        <div key={exp.id} className="rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                          <p className="text-xs text-[#141B2E]">{exp.title}</p>
                          <p className="text-xs text-[#4B5468]">{exp.company}</p>
                          <p className="mt-[2px] text-xs text-[#9AA3B2]">
                            {exp.startDate} – {exp.isCurrent ? "Present" : exp.endDate}
                          </p>
                          {exp.achievements && (
                            <RichTextContent html={exp.achievements} className="mt-[4px] text-xs text-[#4B5468]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fullProfile.education.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Education</p>
                    <div className="mt-[8px] flex flex-col gap-[10px]">
                      {fullProfile.education.map((edu) => (
                        <div key={edu.id} className="rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                          <p className="text-xs text-[#141B2E]">
                            {edu.qualificationTier}
                            {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ""}
                          </p>
                          <p className="text-xs text-[#4B5468]">{edu.institution}</p>
                          <p className="mt-[2px] text-xs text-[#9AA3B2]">
                            {[edu.graduationYear, edu.cgpa ? `CGPA ${edu.cgpa}` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fullProfile.certifications.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Certifications</p>
                    <div className="mt-[8px] flex flex-col gap-[6px]">
                      {fullProfile.certifications.map((cert) => (
                        <p key={cert.id} className="text-xs text-[#141B2E]">
                          {cert.name}
                          {cert.issuer ? ` · ${cert.issuer}` : ""}
                          {cert.year ? ` · ${cert.year}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {fullProfile.languages.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">Languages</p>
                    <div className="mt-[6px] flex flex-wrap gap-[6px]">
                      {fullProfile.languages.map((lang) => (
                        <span
                          key={lang.id}
                          className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-xs text-[#141B2E]"
                        >
                          {lang.language} — {LANGUAGE_LEVEL_LABEL[lang.spokenLevel] ?? lang.spokenLevel} spoken /{" "}
                          {LANGUAGE_LEVEL_LABEL[lang.writtenLevel] ?? lang.writtenLevel} written
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {fullProfile.references.length > 0 && (
                  <div>
                    <p className="text-xs text-[#141B2E]">References</p>
                    <div className="mt-[8px] flex flex-col gap-[8px]">
                      {fullProfile.references.map((ref) => (
                        <div key={ref.id} className="text-xs text-[#141B2E]">
                          <p>
                            {ref.fullName}
                            {ref.jobTitle || ref.company
                              ? ` · ${[ref.jobTitle, ref.company].filter(Boolean).join(", ")}`
                              : ""}
                          </p>
                          {(ref.phone || ref.email) && (
                            <p className="text-[#4B5468]">{[ref.phone, ref.email].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          <div className="flex min-h-0 flex-col gap-[10px] overflow-y-auto border-t border-black/[0.06] bg-[#F8FAFB] px-[18px] pt-[18px] pb-[40px] sm:basis-1/3 sm:border-t-0 sm:border-l">
            {showInterviewForm ? (
              <div className="flex flex-col gap-[8px]">
                <p className="text-xs text-[#141B2E]">Set up the interview</p>

                <div>
                  <label className="text-xs text-[#9AA3B2]">Round</label>
                  <input
                    type="number"
                    min={1}
                    value={round}
                    onChange={(e) => setRound(Math.max(1, Number(e.target.value) || 1))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9AA3B2]">Format</label>
                  <div className="mt-[2px] grid grid-cols-3 gap-[4px]">
                    {INTERVIEW_MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`rounded-[8px] px-[6px] py-[6px] text-sm transition-colors ${
                          mode === m ? "bg-brand-teal-dark text-white" : "bg-white text-[#4B5468] hover:bg-black/[0.04]"
                        }`}
                      >
                        {INTERVIEW_MODE_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-[6px]">
                  <div>
                    <label className="text-xs text-[#9AA3B2]">Date</label>
                    <DatePicker value={date} onChange={setDate} min={todayIsoDate} placeholder="DD/MM/YYYY" />
                  </div>
                  <div>
                    <label className="text-xs text-[#9AA3B2]">Time</label>
                    <TimePicker value={time} onChange={setTime} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#9AA3B2]">Duration (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="60"
                    className={inputClass}
                  />
                </div>

                {mode === "onsite" && (
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-xs text-[#9AA3B2]">Location</label>
                    {addresses.length > 0 && (
                      <Dropdown
                        id="interviewLocationPicker"
                        label="Use a saved address"
                        value=""
                        options={[
                          { value: "" as const, label: "Use a saved address..." },
                          ...addresses.map((a) => ({ value: a.id, label: `${a.label} — ${a.city}, ${a.state}` })),
                        ]}
                        onChange={(value) => {
                          const picked = addresses.find((a) => a.id === value);
                          if (picked) setLocation(`${picked.addressLine1}, ${picked.city}, ${picked.state}`);
                        }}
                      />
                    )}
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Office address"
                      className={inputClass}
                    />
                  </div>
                )}

                {mode === "online" && (
                  <div>
                    <label className="text-xs text-[#9AA3B2]">Meeting link</label>
                    <input
                      type="text"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="https://..."
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#9AA3B2]">Interviewer (optional)</label>
                  <input
                    type="text"
                    value={interviewerName}
                    onChange={(e) => setInterviewerName(e.target.value)}
                    placeholder="Who's conducting it"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9AA3B2]">Notes for candidate (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="What to bring, parking, dress code…"
                    className={`${inputClass} h-auto py-[8px]`}
                  />
                </div>

                {formError && <p className="text-xs text-red-500">{formError}</p>}

                <div className="mt-[4px] flex gap-[6px]">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={submitInterviewDetails}
                    className="flex h-[32px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {existing ? "Save changes" : "Schedule interview"}
                  </button>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => setShowInterviewForm(false)}
                    className="flex h-[32px] items-center justify-center rounded-full border border-black/[0.1] px-[12px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {applicant.applicantResumeUrl && (
                  <a
                    href={applicant.applicantResumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-[6px] rounded-[10px] border border-black/[0.1] px-[12px] py-[8px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                  >
                    <FileIcon className="h-[13px] w-[13px] text-brand-teal-dark" />
                    View resume
                  </a>
                )}

                {existing &&
                  (applicant.application.status === "interview" ||
                    applicant.application.status === "interviewed" ||
                    applicant.application.status === "evaluation" ||
                    applicant.application.status === "evaluated" ||
                    showInterviewForm) && (
                  <div className="rounded-[14px] border border-[#E1D6F5] bg-[#F1ECFB] p-[14px]">
                    <div className="flex items-center justify-between gap-[8px]">
                      <p className="text-xs text-[#141B2E]">
                        Round {existing.round} interview · {INTERVIEW_MODE_LABEL[existing.mode]}
                      </p>
                      {applicant.application.interviewResponseStatus && (
                        <span
                          className={`shrink-0 rounded-full px-[9px] py-[2px] text-xs ${
                            INTERVIEW_RESPONSE_STATUS_COLOR[applicant.application.interviewResponseStatus].bg
                          } ${INTERVIEW_RESPONSE_STATUS_COLOR[applicant.application.interviewResponseStatus].text}`}
                        >
                          {INTERVIEW_RESPONSE_STATUS_LABEL[applicant.application.interviewResponseStatus]}
                        </span>
                      )}
                    </div>
                    <p className="mt-[2px] text-xs text-[#4B5468]">
                      {new Date(existing.scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {existing.durationMinutes ? ` · ${existing.durationMinutes} min` : ""}
                    </p>
                    <InterviewCountdown scheduledAt={existing.scheduledAt} />
                    {existing.mode === "onsite" && existing.location && (
                      <p className="mt-[4px] text-xs text-[#4B5468]">📍 {existing.location}</p>
                    )}
                    {existing.mode === "online" && existing.meetingLink && (
                      <p className="mt-[4px] truncate text-xs text-[#7C5CD1]">🔗 {existing.meetingLink}</p>
                    )}
                    {existing.interviewerName && (
                      <p className="mt-[4px] text-xs text-[#4B5468]">Interviewer: {existing.interviewerName}</p>
                    )}
                    {existing.notes && <p className="mt-[4px] text-xs text-[#4B5468]">{existing.notes}</p>}
                    {applicant.application.interviewResponseStatus === "attended" && (
                      <p className="mt-[4px] text-xs text-[#008990]">
                        {applicant.application.jobseekerConfirmedAttendance
                          ? "✓ Candidate confirmed attendance"
                          : "Candidate hasn't confirmed attendance yet"}
                      </p>
                    )}
                  </div>
                )}

                {existing && onSaveEvaluation && isAtOrPastInterviewStage && !interviewHasHappened && (
                  <div className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                    <p className="text-xs text-[#141B2E]">Interview evaluation</p>
                    <p className="mt-[4px] text-xs text-[#9AA3B2]">
                      {applicant.application.interviewResponseStatus === "attended"
                        ? "Waiting for the candidate to confirm their attendance too."
                        : `Mark the candidate as attended or no-show after the round ${existing.round} interview to unlock this.`}
                    </p>
                  </div>
                )}

                {readyToStartEvaluation && (
                  <div className="rounded-[14px] border border-[#FBD9B4] bg-[#FFE9D6] p-[14px]">
                    <p className="text-xs text-[#B45309]">Interview complete — evaluate now</p>
                    <p className="mt-[4px] text-xs text-[#B45309]">
                      Don&rsquo;t leave this candidate sitting as just &ldquo;Interviewed&rdquo; — start the
                      evaluation so it&rsquo;s not forgotten.
                    </p>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => onUpdateStatus("evaluation")}
                      className="mt-[10px] flex h-[32px] w-full items-center justify-center rounded-full bg-[#B45309] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Start evaluation
                    </button>
                  </div>
                )}

                {existing &&
                  onSaveEvaluation &&
                  canEvaluate &&
                  applicant.evaluation &&
                  evaluationLocked &&
                  (() => {
                    const savedEvaluation = applicant.evaluation!;
                    return (
                      <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-[14px]">
                        <div className="flex items-center justify-between gap-[8px]">
                          <p className="text-xs text-[#141B2E]">Interview evaluation</p>
                          <span
                            className={`shrink-0 rounded-full px-[9px] py-[2px] text-xs ${
                              RECOMMENDATION_COLOR[savedEvaluation.recommendation].bg
                            } ${RECOMMENDATION_COLOR[savedEvaluation.recommendation].text}`}
                          >
                            {RECOMMENDATION_LABEL[savedEvaluation.recommendation]}
                          </span>
                        </div>

                        <div className="mt-[10px] flex flex-col gap-[6px]">
                          {EVALUATION_CRITERIA.filter((criterion) => savedEvaluation.scores[criterion] !== undefined).map(
                            (criterion) => (
                              <div key={criterion} className="flex items-center justify-between gap-[8px]">
                                <span className="text-xs text-[#4B5468]">{EVALUATION_CRITERION_LABEL[criterion]}</span>
                                <span className="text-xs text-[#141B2E]">
                                  {savedEvaluation.scores[criterion]}/5
                                </span>
                              </div>
                            ),
                          )}
                        </div>

                        {savedEvaluation.notes && (
                          <p className="mt-[10px] whitespace-pre-line text-xs text-[#4B5468]">{savedEvaluation.notes}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => setEvaluationLocked(false)}
                          className="mt-[10px] flex h-[32px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                        >
                          Edit evaluation
                        </button>
                      </div>
                    );
                  })()}

                {existing && onSaveEvaluation && canEvaluate && !evaluationLocked && (
                  <div className="rounded-[14px] border border-[#EAEDF2] bg-white p-[14px]">
                    <p className="text-xs text-[#141B2E]">Interview evaluation</p>
                    <p className="mt-[1px] text-xs text-[#9AA3B2]">
                      Rate the candidate on round {existing.round} and give a recommendation.
                    </p>

                    <div className="mt-[10px] flex flex-col gap-[8px]">
                      {EVALUATION_CRITERIA.map((criterion) => (
                        <div key={criterion} className="flex items-center justify-between gap-[8px]">
                          <span className="text-xs text-[#4B5468]">{EVALUATION_CRITERION_LABEL[criterion]}</span>
                          <div className="flex gap-[3px]">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setScore(criterion, value)}
                                aria-label={`${EVALUATION_CRITERION_LABEL[criterion]}: ${value}`}
                                className={`flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-sm transition-colors ${
                                  evaluationScores[criterion] === value
                                    ? "bg-brand-teal-dark text-white"
                                    : "bg-[#F1F4F8] text-[#4B5468] hover:bg-black/[0.06]"
                                }`}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-[10px]">
                      <label className="text-xs text-[#9AA3B2]">Recommendation</label>
                      <div className="mt-[4px] grid grid-cols-2 gap-[4px]">
                        {RECOMMENDATIONS.map((rec) => (
                          <button
                            key={rec}
                            type="button"
                            onClick={() => setEvaluationRecommendation(rec)}
                            className={`rounded-[8px] px-[8px] py-[6px] text-sm transition-colors ${
                              evaluationRecommendation === rec
                                ? `${RECOMMENDATION_COLOR[rec].bg} ${RECOMMENDATION_COLOR[rec].text}`
                                : "bg-[#F1F4F8] text-[#4B5468] hover:bg-black/[0.06]"
                            }`}
                          >
                            {RECOMMENDATION_LABEL[rec]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-[10px]">
                      <label className="text-xs text-[#9AA3B2]">Notes (optional)</label>
                      <textarea
                        value={evaluationNotes}
                        onChange={(e) => setEvaluationNotes(e.target.value)}
                        rows={2}
                        placeholder="Strengths, concerns, anything worth flagging…"
                        className={`${inputClass} h-auto py-[8px]`}
                      />
                    </div>

                    {evaluationError && <p className="mt-[6px] text-xs text-red-500">{evaluationError}</p>}

                    <button
                      type="button"
                      disabled={savingEvaluation}
                      onClick={submitEvaluation}
                      className="mt-[10px] flex h-[32px] w-full items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applicant.evaluation ? "Save changes" : "Evaluate"}
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-xs text-[#141B2E]">Hiring stage</p>
                  <p className="mt-[1px] text-xs text-[#9AA3B2]">
                    Click a stage to move this applicant forward — or backward, if needed.
                  </p>
                </div>

                {(isTerminal || applicant.application.status === "kiv") && (
                  <p className={`inline-flex self-start rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}>
                    Currently: {APPLICATION_STATUS_LABEL[applicant.application.status]}
                  </p>
                )}

                <div className="flex flex-col gap-[6px]">
                  {PIPELINE_STATUSES.map((status, index) => {
                    const isCurrent = status === applicant.application.status;
                    const isPast = currentIndex >= 0 && index < currentIndex;
                    // Reaching Interviewed has to go through the Attendance
                    // buttons above (they also record attended/no-show),
                    // not a direct click here — otherwise Evaluate stays
                    // locked with no way back to unlock it from this list.
                    const needsAttendanceFirst = status === "interviewed" && applicant.application.status === "interview";
                    // Evaluation is only meaningful right after attendance —
                    // the server rejects it from anywhere else too (see
                    // api/employer/applications/[id]/route.ts).
                    const needsAttendanceBeforeEvaluation = status === "evaluation" && applicant.application.status === "interview";
                    // Evaluated only comes from actually saving scores via
                    // onSaveEvaluation while in "Evaluation" — the server's
                    // own SETTABLE_STATUSES rejects a direct update into
                    // "evaluated", so a raw click here would always 400.
                    const needsEvaluationFirst =
                      status === "evaluated" && !isCurrent && !isPast && applicant.application.status !== "evaluation";
                    const disabledReason = needsAttendanceFirst
                      ? "Mark attendance above first"
                      : needsAttendanceBeforeEvaluation
                        ? "Mark attendance above first"
                        : needsEvaluationFirst
                          ? "Rate the candidate below first"
                          : undefined;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={updating || needsAttendanceFirst || needsAttendanceBeforeEvaluation || needsEvaluationFirst}
                        title={disabledReason}
                        onClick={() => handleStageClick(status)}
                        className={`flex items-center gap-[6px] rounded-[10px] px-[12px] py-[8px] text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isCurrent
                            ? "bg-brand-teal-dark text-white"
                            : isPast
                              ? "bg-[#E6F9FA] text-brand-teal-dark hover:opacity-80"
                              : "bg-white text-[#4B5468] hover:bg-black/[0.04]"
                        }`}
                      >
                        {isPast ? <CheckIcon className="h-[10px] w-[10px] shrink-0" /> : null}
                        {APPLICATION_STATUS_LABEL[status] ?? status}
                      </button>
                    );
                  })}
                </div>

                {(applicant.application.status === "interview" ||
                  applicant.application.status === "interviewed" ||
                  applicant.application.status === "evaluation" ||
                  applicant.application.status === "evaluated") && (
                  <div className="flex flex-col gap-[8px]">
                    {onSetAttendance && applicant.application.status === "interview" && (
                      <div className="flex flex-col gap-[6px]">
                        <p className="text-xs text-[#141B2E]">Attendance</p>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => onSetAttendance("attended")}
                          className="flex h-[30px] w-full items-center justify-center rounded-full border border-black/[0.1] px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark as attended
                        </button>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => onSetAttendance("no_show")}
                          className="flex h-[30px] w-full items-center justify-center rounded-full border border-black/[0.1] px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark as no-show
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setShowInterviewForm(true);
                      }}
                      className="self-start text-left text-sm text-brand-teal-dark hover:underline"
                    >
                      {applicant.application.status === "interview" ? "Reschedule interview" : "Schedule next round"}
                    </button>
                  </div>
                )}

                {(applicant.application.status === "interview" ||
                  applicant.application.status === "interviewed" ||
                  applicant.application.status === "evaluation" ||
                  applicant.application.status === "evaluated" ||
                  applicant.application.status === "kiv") && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => onUpdateStatus(applicant.application.status === "kiv" ? "evaluated" : "kiv")}
                    className={`flex w-full items-center justify-center rounded-[10px] px-[12px] py-[8px] text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      applicant.application.status === "kiv"
                        ? "bg-[#3B5BDB] text-white"
                        : "bg-[#EAF0FE] text-[#3B5BDB] hover:opacity-80"
                    }`}
                  >
                    {applicant.application.status === "kiv" ? "Move back to Evaluated" : "Keep in view (KIV)"}
                  </button>
                )}

                {pendingStatus && (
                  <div className="rounded-[10px] border border-[#FBE7B3] bg-[#FFF3D6] p-[10px]">
                    <p className="text-xs text-[#141B2E]">Shortlist this candidate?</p>
                    <p className="mt-[1px] text-xs text-[#4B5468]">
                      This tells your team they&rsquo;re a serious contender for the role.
                    </p>
                    <div className="mt-[8px] flex gap-[6px]">
                      <button
                        type="button"
                        disabled={updating}
                        onClick={confirmPendingStatus}
                        className="flex h-[30px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => setPendingStatus(null)}
                        className="flex h-[30px] items-center justify-center rounded-full border border-black/[0.1] px-[12px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-[4px] border-t border-black/[0.06] pt-[10px]">
                  <p className="text-xs text-[#9AA3B2]">Not moving forward</p>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => onUpdateStatus("rejected")}
                    className={`mt-[6px] flex w-full items-center justify-center rounded-[10px] px-[12px] py-[8px] text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      applicant.application.status === "rejected"
                        ? "bg-red-500 text-white"
                        : "bg-red-50 text-red-500 hover:bg-red-100"
                    }`}
                  >
                    Reject
                  </button>
                  {applicant.application.status === "withdrawn" && (
                    <p className="mt-[6px] rounded-[10px] bg-black/[0.06] px-[10px] py-[6px] text-center text-xs text-[#9AA3B2]">
                      Withdrawn by candidate
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

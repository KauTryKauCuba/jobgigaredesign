"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AiInterviewComposer from "./AiInterviewComposer";
import { CheckIcon, XIcon } from "./icons";
import {
  AI_INTERVIEW_DEADLINE_DAYS,
  AI_INTERVIEW_DEFAULT_DEADLINE_DAYS,
  AI_INTERVIEW_LEVEL_LABEL,
  AI_INTERVIEW_QUESTION_COUNT,
  AI_INTERVIEW_RECOMMENDATION_LABEL,
  AI_INTERVIEW_STATUS_LABEL,
  type AiInterviewLevel,
  type EmployerAiInterview,
  type EmployerAiInterviewQuestion,
} from "@/lib/ai-interview-shared";

const LEVEL_STYLE: Record<AiInterviewLevel, string> = {
  strong: "bg-[#E8F7EE] text-[#2F9E56]",
  partial: "bg-brand-gold-soft text-brand-gold-dark",
  weak: "bg-[#FDECEC] text-red-500",
};

function scoreStyle(score: number) {
  if (score >= 4) return "bg-[#E8F7EE] text-[#2F9E56]";
  if (score === 3) return "bg-brand-gold-soft text-brand-gold-dark";
  return "bg-[#FDECEC] text-red-500";
}

const RECOMMENDATION_STYLE: Record<string, string> = {
  interview: "bg-[#E8F7EE] text-[#2F9E56]",
  maybe: "bg-brand-gold-soft text-brand-gold-dark",
  pass: "bg-[#F1F4F8] text-[#4B5468]",
};

// "3 / 5 / 7 more days" as the same pill switch used across the app.
function DaysPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div role="group" aria-label="New deadline" className="flex items-center rounded-full bg-white p-[3px] text-xs ring-1 ring-black/[0.08]">
      {AI_INTERVIEW_DEADLINE_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={`rounded-full px-[10px] py-[4px] whitespace-nowrap transition-colors ${
            value === d ? "bg-brand-teal-soft text-brand-teal-dark" : "text-[#4B5468] hover:text-[#141B2E]"
          }`}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function QuestionResult({
  interviewId,
  question,
  open,
  onToggle,
}: {
  interviewId: string;
  question: EmployerAiInterviewQuestion;
  open: boolean;
  onToggle: () => void;
}) {
  const evaluation = question.evaluation;
  const [showTranscript, setShowTranscript] = useState(false);
  const mediaUrl = `/api/employer/ai-interviews/${interviewId}/media/${question.id}`;
  return (
    <div className="rounded-[12px] border border-[#EAEDF2] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-[10px] p-[12px] text-left">
        <span
          className={`flex h-[26px] min-w-[34px] shrink-0 items-center justify-center rounded-full px-[8px] text-xs ${
            question.score !== null ? scoreStyle(question.score) : "bg-[#F1F4F8] text-[#9AA3B2]"
          }`}
        >
          {question.score !== null ? `${question.score}/5` : "–"}
        </span>
        <span className="min-w-0 flex-1 text-xs text-[#141B2E]">
          <span className="text-[#9AA3B2]">Q{question.position}</span> {question.question}
        </span>
        <span className="shrink-0 text-xs text-[#9AA3B2]">{open ? "Hide" : "Details"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-[12px] border-t border-[#EAEDF2] p-[12px]">
          {evaluation && <p className="text-xs leading-[18px] text-[#4B5468]">{evaluation.summary}</p>}

          <div className="grid gap-[12px] sm:grid-cols-2">
            <div>
              <p className="text-xs text-[#9AA3B2]">Covered</p>
              <ul className="mt-[4px] flex flex-col gap-[4px]">
                {(evaluation?.covered ?? []).length === 0 && <li className="text-xs text-[#9AA3B2]">Nothing from the key points.</li>}
                {(evaluation?.covered ?? []).map((point) => (
                  <li key={point} className="flex items-start gap-[6px] text-xs text-[#141B2E]">
                    <CheckIcon className="mt-[3px] h-[9px] w-[9px] shrink-0 text-[#2F9E56]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-[#9AA3B2]">Not mentioned</p>
              <ul className="mt-[4px] flex flex-col gap-[4px]">
                {(evaluation?.missed ?? []).length === 0 && <li className="text-xs text-[#9AA3B2]">Nothing missed.</li>}
                {(evaluation?.missed ?? []).map((point) => (
                  <li key={point} className="flex items-start gap-[6px] text-xs text-[#4B5468]">
                    <XIcon className="mt-[3px] h-[9px] w-[9px] shrink-0 text-[#9AA3B2]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {evaluation?.quote && (
            <p className="border-l-2 border-brand-teal-dark pl-[10px] text-xs italic leading-[18px] text-[#4B5468]">
              &ldquo;{evaluation.quote}&rdquo;
            </p>
          )}

          {question.hasRecording ? (
            question.mediaKind === "video" ? (
              <video src={mediaUrl} controls preload="none" playsInline className="aspect-video w-full max-w-[360px] rounded-[12px] bg-black" />
            ) : (
              <audio src={mediaUrl} controls preload="none" className="w-full max-w-[360px]" />
            )
          ) : (
            question.answered && <p className="text-xs text-[#9AA3B2]">The recording has been deleted. The transcript and scores are kept.</p>
          )}

          {question.transcript !== null && (
            <div>
              <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-xs text-brand-teal-dark hover:underline">
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </button>
              {showTranscript && (
                <p className="mt-[6px] rounded-[10px] bg-[#F8FAFB] p-[10px] text-xs leading-[18px] text-[#4B5468]">
                  {question.transcript.trim() ? question.transcript : "No speech was detected."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The AI interview on an applicant's detail screen. For a shortlisted
 * applicant with none sent it offers "Send AI interview"; once sent it
 * tracks progress, and when the answers are scored it shows the report —
 * advice for the employer, never a decision.
 */
export default function AiInterviewPanel({
  applicationId,
  applicantName,
  jobTitle,
  applicationStatus,
  canManage: canManageProp,
}: {
  applicationId: string;
  applicantName: string;
  jobTitle: string;
  applicationStatus: string;
  canManage: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [interview, setInterview] = useState<EmployerAiInterview | null>(null);
  const [canManage, setCanManage] = useState(canManageProp);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [extendDays, setExtendDays] = useState<number>(AI_INTERVIEW_DEFAULT_DEADLINE_DAYS);
  // Their first name for the sentences below ("" when there's no name).
  const firstName = applicantName.split(" ")[0] ?? "";

  // A failed first load shows an error with "Try again" — never the empty
  // "Send AI interview" state, which could offer a second interview to
  // someone who already has one. A failed check-back while processing just
  // keeps what's on screen; the next one tries again.
  const [loadFailed, setLoadFailed] = useState(false);
  const loadedOnce = useRef(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/employer/ai-interviews?applicationId=${applicationId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't load the AI interview.");
      setInterview(data.interview ?? null);
      setCanManage(data.canManage === true);
      loadedOnce.current = true;
      setLoadFailed(false);
    } catch {
      if (!loadedOnce.current) setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [applicationId]);

  useEffect(() => {
    // Load this applicant's AI interview when the panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // While the answers are being analysed, check back until the report is ready.
  const processing = interview?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [processing, load]);

  async function act(action: "cancel" | "extend" | "retry") {
    if (!interview) return;
    if (action === "cancel" && !window.confirm(`Cancel this AI interview? ${firstName || "The applicant"} won't be able to answer it.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/ai-interviews/${interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "extend" ? { deadlineDays: extendDays } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the AI interview.");
      setInterview(data.interview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the AI interview.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  if (loadFailed) {
    return (
      <div className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
        <p className="text-xs text-red-500">Couldn&rsquo;t load the AI interview for this applicant.</p>
        <button
          type="button"
          onClick={() => {
            setLoaded(false);
            void load();
          }}
          className="mt-[8px] text-xs text-brand-teal-dark hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const composer = composerOpen && (
    <AiInterviewComposer
      applicationId={applicationId}
      applicantName={applicantName}
      jobTitle={jobTitle}
      onClose={() => setComposerOpen(false)}
      onSent={(sent) => {
        setInterview(sent);
        setComposerOpen(false);
      }}
    />
  );

  const canSend = canManage && applicationStatus === "shortlisted";

  // Nothing sent yet.
  if (!interview) {
    if (!canSend) return null;
    return (
      <div className="rounded-[14px] border border-[#BFEAEC] bg-[#F2FCFC] p-[14px]">
        <p className="text-xs text-[#141B2E]">AI interview</p>
        <p className="mt-[4px] text-xs leading-[18px] text-[#4B5468]">
          See whether {firstName || "this applicant"} knows the job before you schedule an interview. AI
          writes five questions about the role; they answer by a short recording; AI scores the answers for you.
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="mt-[10px] flex h-[36px] items-center justify-center rounded-full bg-brand-teal-dark px-[18px] text-xs text-white transition-opacity hover:opacity-90"
        >
          Send AI interview
        </button>
        {composer}
      </div>
    );
  }

  const answeredCount = interview.questions.filter((q) => q.answered).length;
  const report = interview.report;
  const open = interview.status === "invited" || interview.status === "in_progress";
  const statusTone =
    interview.status === "completed"
      ? "bg-[#E8F7EE] text-[#2F9E56]"
      : interview.status === "failed" || interview.status === "expired" || interview.status === "cancelled"
        ? "bg-[#F1F4F8] text-[#4B5468]"
        : "bg-brand-teal-soft text-brand-teal-dark";

  return (
    <div className="rounded-[14px] border border-[#BFEAEC] bg-[#F2FCFC] p-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <p className="text-xs text-[#141B2E]">AI interview</p>
        <span className={`rounded-full px-[10px] py-[2px] text-xs ${statusTone}`}>{AI_INTERVIEW_STATUS_LABEL[interview.status]}</span>
      </div>

      {open && (
        <>
          <p className="mt-[6px] text-xs leading-[18px] text-[#4B5468]">
            Sent {shortDate(interview.inviteSentAt)}. {firstName || "They"} can answer until {shortDate(interview.deadlineAt)}
            {interview.status === "in_progress" ? ` — ${answeredCount} of ${AI_INTERVIEW_QUESTION_COUNT} answered so far.` : ". They haven't started yet."}
          </p>
          {canManage && (
            <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
              <DaysPicker value={extendDays} onChange={setExtendDays} />
              <button type="button" disabled={busy} onClick={() => act("extend")} className="h-[32px] rounded-full border border-black/[0.1] bg-white px-[14px] text-xs text-[#141B2E] hover:bg-black/[0.03] disabled:opacity-40">
                Extend by {extendDays} days
              </button>
              <button type="button" disabled={busy} onClick={() => act("cancel")} className="h-[32px] rounded-full px-[10px] text-xs text-red-500 hover:bg-red-50 disabled:opacity-40">
                Cancel interview
              </button>
            </div>
          )}
        </>
      )}

      {interview.status === "processing" && (
        <p className="mt-[8px] flex items-center gap-[8px] text-xs text-[#4B5468]">
          <span className="h-[12px] w-[12px] animate-spin rounded-full border-2 border-brand-teal-dark border-t-transparent" />
          {firstName || "They"} finished. AI is writing the answers down and scoring them — this takes about a minute.
        </p>
      )}

      {interview.status === "failed" && (
        <>
          <p className="mt-[8px] text-xs leading-[18px] text-[#4B5468]" title={interview.failureReason ?? undefined}>
            {interview.failureReason?.includes("transcribe")
              ? "We couldn't reach the speech-to-text service, so the analysis didn't finish."
              : "We couldn't reach the AI service, so the analysis didn't finish."}{" "}
            {firstName ? `${firstName}’s answers` : "Their answers"} are safe — try again in a moment.
          </p>
          {canManage && (
            <button type="button" disabled={busy} onClick={() => act("retry")} className="mt-[10px] h-[34px] rounded-full bg-brand-teal-dark px-[18px] text-xs text-white hover:opacity-90 disabled:opacity-40">
              {busy ? "Starting…" : "Try again"}
            </button>
          )}
        </>
      )}

      {(interview.status === "expired" || interview.status === "cancelled") && (
        <>
          <p className="mt-[8px] text-xs leading-[18px] text-[#4B5468]">
            {interview.status === "expired"
              ? `The deadline passed on ${shortDate(interview.deadlineAt)}${answeredCount > 0 ? ` after ${answeredCount} of ${AI_INTERVIEW_QUESTION_COUNT} answers` : " without any answers"}.`
              : "You cancelled this AI interview."}
          </p>
          {canManage && (
            <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
              {interview.status === "expired" && (
                <>
                  <DaysPicker value={extendDays} onChange={setExtendDays} />
                  <button type="button" disabled={busy} onClick={() => act("extend")} className="h-[32px] rounded-full bg-brand-teal-dark px-[14px] text-xs text-white hover:opacity-90 disabled:opacity-40">
                    Give {extendDays} more days
                  </button>
                </>
              )}
              {canSend && (
                <button type="button" onClick={() => setComposerOpen(true)} className="h-[32px] rounded-full border border-black/[0.1] bg-white px-[14px] text-xs text-[#141B2E] hover:bg-black/[0.03]">
                  Send a new one
                </button>
              )}
            </div>
          )}
        </>
      )}

      {interview.status === "completed" && report && (
        <div className="mt-[10px] flex flex-col gap-[12px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className={`rounded-full px-[12px] py-[4px] text-xs ${LEVEL_STYLE[report.level]}`}>{AI_INTERVIEW_LEVEL_LABEL[report.level]}</span>
            <span className="rounded-full bg-white px-[12px] py-[4px] text-xs text-[#141B2E]">Average {report.averageScore.toFixed(1)} / 5</span>
            <span className={`rounded-full px-[12px] py-[4px] text-xs ${RECOMMENDATION_STYLE[report.recommendation]}`}>
              AI suggests: {AI_INTERVIEW_RECOMMENDATION_LABEL[report.recommendation]}
            </span>
          </div>
          <p className="text-xs leading-[18px] text-[#4B5468]">{report.summary}</p>

          {report.gaps.length > 0 && (
            <div>
              <p className="text-xs text-[#9AA3B2]">Biggest gaps</p>
              <div className="mt-[4px] flex flex-wrap gap-[6px]">
                {report.gaps.map((gap) => (
                  <span key={gap} className="rounded-full bg-white px-[10px] py-[3px] text-xs text-[#4B5468]">
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.followUps.length > 0 && (
            <div>
              <p className="text-xs text-[#9AA3B2]">Worth asking in the live interview</p>
              <ul className="mt-[4px] flex flex-col gap-[4px]">
                {report.followUps.map((q) => (
                  <li key={q} className="text-xs leading-[18px] text-[#141B2E]">
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-[6px]">
            <p className="text-xs text-[#9AA3B2]">Answer by answer</p>
            {interview.questions.map((q) => (
              <QuestionResult
                key={q.id}
                interviewId={interview.id}
                question={q}
                open={openIds.has(q.id)}
                onToggle={() =>
                  setOpenIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(q.id)) next.delete(q.id);
                    else next.add(q.id);
                    return next;
                  })
                }
              />
            ))}
          </div>

          <p className="text-xs leading-[18px] text-[#9AA3B2]">
            This is advice from AI, based only on what {firstName || "they"} said — you decide. Scored by{" "}
            {report.model ?? "AI"} from the transcripts.{" "}
            {interview.recordingsDeleted
              ? "The recordings have been deleted."
              : interview.recordingsExpireAt
                ? `Recordings are deleted on ${shortDate(interview.recordingsExpireAt)}.`
                : ""}
          </p>
        </div>
      )}

      {error && <p className="mt-[8px] text-xs text-red-500">{error}</p>}
      {composer}
    </div>
  );
}

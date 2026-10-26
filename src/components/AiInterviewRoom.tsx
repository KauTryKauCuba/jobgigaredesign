"use client";

import Link from "next/link";
import { useState } from "react";
import AiAnswerRecorder from "./AiAnswerRecorder";
import { gradientFrameClass } from "./formStyles";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import { CheckIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import {
  AI_INTERVIEW_MAX_ATTEMPTS,
  AI_INTERVIEW_PRACTICE_QUESTION,
  AI_INTERVIEW_QUESTION_COUNT,
  AI_INTERVIEW_RETENTION_DAYS,
  type JobseekerAiInterview,
} from "@/lib/ai-interview-shared";

type Step = "intro" | "practice" | "question" | "review";

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">{children}</div>
    </div>
  );
}

const primaryButton =
  "flex h-[42px] items-center justify-center rounded-full bg-brand-gold px-[22px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[18px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The applicant's side of an AI interview: an intro with consent, a practice
 * question, the five recorded answers, then a review before submitting.
 */
export default function AiInterviewRoom({
  authUser,
  resume,
  initialInterview,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  initialInterview: JobseekerAiInterview;
}) {
  const [interview, setInterview] = useState(initialInterview);
  const total = AI_INTERVIEW_QUESTION_COUNT;

  const firstUnanswered = initialInterview.questions.findIndex((q) => !q.answered);
  const [step, setStep] = useState<Step>(() => {
    if (!initialInterview.consented) return "intro";
    return firstUnanswered === -1 ? "review" : "question";
  });
  const [index, setIndex] = useState(() => (firstUnanswered === -1 ? 0 : firstUnanswered));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A take counts when an answer is saved — the same rule the server
  // enforces — so a recording that's thrown away (or left behind by moving
  // to another question) never uses one up.
  const takesUsed = (q: JobseekerAiInterview["questions"][number]) => AI_INTERVIEW_MAX_ATTEMPTS - q.attemptsLeft;
  const answeredCount = interview.questions.filter((q) => q.answered).length;
  const question = interview.questions[index];

  async function call(url: string, init?: RequestInit): Promise<JobseekerAiInterview | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
      setInterview(data.interview);
      return data.interview as JobseekerAiInterview;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    const result = await call(`/api/jobseeker/ai-interviews/${interview.id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    if (result) setStep("practice");
  }

  async function saveAnswer(blob: Blob, isVideo: boolean) {
    const form = new FormData();
    form.append("media", blob, isVideo ? "answer.webm" : "answer.webm");
    form.append("video", isVideo ? "1" : "0");
    const result = await call(`/api/jobseeker/ai-interviews/${interview.id}/answers/${question.id}`, {
      method: "POST",
      body: form,
    });
    if (!result) return;
    const next = result.questions.findIndex((q, i) => i > index && !q.answered);
    const anyLeft = result.questions.findIndex((q) => !q.answered);
    if (next !== -1) {
      setIndex(next);
    } else if (anyLeft !== -1) {
      setIndex(anyLeft);
    } else {
      setStep("review");
    }
  }

  async function submit() {
    await call(`/api/jobseeker/ai-interviews/${interview.id}/submit`, { method: "POST" });
  }

  const heading = "AI interview";
  const subheading = `${interview.jobTitle} · ${interview.companyName}`;
  const shell = (children: React.ReactNode) => (
    <JobseekerDashboardShell authUser={authUser} active="applications" heading={heading} subheading={subheading} resume={resume}>
      {children}
    </JobseekerDashboardShell>
  );

  // ── Not open (anymore) ──
  if (interview.status === "expired") {
    return shell(
      <Card>
        <p className="text-sm text-[#141B2E]">The deadline has passed</p>
        <p className="mt-[6px] text-xs leading-[18px] text-[#4B5468]">
          This AI interview closed on {formatDeadline(interview.deadlineAt)}. If you&rsquo;re still interested in the role,
          contact {interview.companyName} and ask whether they can give you more time.
        </p>
        <Link href="/jobseeker/applications" className={`${secondaryButton} mt-[14px] w-fit`}>
          Back to my applications
        </Link>
      </Card>,
    );
  }
  if (interview.status === "cancelled") {
    return shell(
      <Card>
        <p className="text-sm text-[#141B2E]">This AI interview was cancelled</p>
        <p className="mt-[6px] text-xs leading-[18px] text-[#4B5468]">
          {interview.companyName} cancelled it, so there&rsquo;s nothing you need to do.
        </p>
        <Link href="/jobseeker/applications" className={`${secondaryButton} mt-[14px] w-fit`}>
          Back to my applications
        </Link>
      </Card>,
    );
  }
  if (interview.status === "processing" || interview.status === "completed" || interview.status === "failed") {
    return shell(
      <Card>
        <div className="flex items-start gap-[12px]">
          <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-brand-gold-soft text-brand-gold-dark">
            <CheckIcon className="h-[14px] w-[14px]" />
          </span>
          <div>
            <p className="text-sm text-[#141B2E]">Thank you — your answers are in</p>
            <p className="mt-[6px] text-xs leading-[18px] text-[#4B5468]">
              {interview.companyName} will look at your interview and get back to you about the next step. You don&rsquo;t
              need to do anything else.
            </p>
            <Link href="/jobseeker/applications" className={`${primaryButton} mt-[14px] w-fit`}>
              Back to my applications
            </Link>
          </div>
        </div>
      </Card>,
    );
  }

  // ── Intro and consent ──
  if (step === "intro") {
    return shell(
      <Card>
        <p className="text-base text-[#141B2E]">
          {interview.companyName} would like to see how well you know the {interview.jobTitle} job
        </p>
        <p className="mt-[4px] text-xs text-[#4B5468]">Please finish by {formatDeadline(interview.deadlineAt)}.</p>
        <div className="mt-[14px] grid grid-cols-3 gap-[8px]">
          {[
            { value: String(total), label: "questions about the job" },
            { value: `${interview.answerSeconds}s`, label: "per answer, video or audio" },
            { value: "~10 min", label: "in total" },
          ].map((tile) => (
            <div key={tile.label} className="rounded-[14px] bg-brand-gold-soft p-[12px]">
              <p className="text-lg text-brand-gold-dark">{tile.value}</p>
              <p className="mt-[2px] text-xs leading-[16px] text-[#4B5468]">{tile.label}</p>
            </div>
          ))}
        </div>
        <ul className="mt-[12px] flex flex-col gap-[6px] text-xs leading-[18px] text-[#4B5468]">
          <li className="flex gap-[8px]">
            <CheckIcon className="mt-[4px] h-[9px] w-[9px] shrink-0 text-brand-gold-dark" />
            One question at a time, with a practice question first.
          </li>
          <li className="flex gap-[8px]">
            <CheckIcon className="mt-[4px] h-[9px] w-[9px] shrink-0 text-brand-gold-dark" />
            Record each answer up to {AI_INTERVIEW_MAX_ATTEMPTS} times and keep the best one.
          </li>
          <li className="flex gap-[8px]">
            <CheckIcon className="mt-[4px] h-[9px] w-[9px] shrink-0 text-brand-gold-dark" />
            You can stop and come back later before the deadline — your answers are saved.
          </li>
        </ul>
        <div className="mt-[14px] rounded-[14px] bg-[#FFFBF0] p-[14px] text-xs leading-[18px] text-[#4B5468]">
          <p className="text-[#141B2E]">How your answers are used</p>
          <ul className="mt-[6px] flex flex-col gap-[4px]">
            <li>• Your recordings are shared only with {interview.companyName}&rsquo;s hiring team for this job.</li>
            <li>
              • AI turns your speech into text and scores what you say about the job. It does not judge how you look,
              sound or speak.
            </li>
            <li>• A person at {interview.companyName} decides what happens next — the AI only helps.</li>
            <li>• Recordings are deleted {AI_INTERVIEW_RETENTION_DAYS} days after your interview is reviewed.</li>
            <li>• The AI services we use may process your recording and its text on servers outside Malaysia.</li>
          </ul>
        </div>
        <label className="mt-[14px] flex items-start gap-[8px] text-sm text-[#141B2E]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-brand-gold-dark"
          />
          I understand, and I agree to be recorded and to AI helping evaluate my answers.
        </label>
        {error && <p className="mt-[10px] text-xs text-red-500">{error}</p>}
        <div className="mt-[14px] flex flex-col gap-[8px] sm:flex-row">
          <button type="button" disabled={!consent || busy} onClick={begin} className={primaryButton}>
            {busy ? "Starting…" : "I agree — start"}
          </button>
          <Link href="/jobseeker/applications" className={secondaryButton}>
            Not now
          </Link>
        </div>
      </Card>,
    );
  }

  // ── Practice ──
  if (step === "practice") {
    return shell(
      <Card>
        <p className="text-xs text-[#9AA3B2]">Practice — this one isn&rsquo;t saved or scored</p>
        <p className="mt-[6px] text-base text-[#141B2E]">{AI_INTERVIEW_PRACTICE_QUESTION.replace("Practice: ", "")}</p>
        <div className="mt-[14px]">
          <AiAnswerRecorder
            seconds={interview.answerSeconds}
            takesLeft="unlimited"
            onUse={() => {
              setError(null);
              const firstOpen = interview.questions.findIndex((q) => !q.answered);
              setIndex(firstOpen === -1 ? 0 : firstOpen);
              setStep(firstOpen === -1 ? "review" : "question");
            }}
            useLabel="Looks good — start question 1"
            busy={false}
            error={null}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const firstOpen = interview.questions.findIndex((q) => !q.answered);
            setIndex(firstOpen === -1 ? 0 : firstOpen);
            setStep(firstOpen === -1 ? "review" : "question");
          }}
          className="mt-[12px] text-xs text-brand-gold-dark hover:underline"
        >
          Skip practice
        </button>
      </Card>,
    );
  }

  // ── Review and submit ──
  if (step === "review") {
    const allAnswered = answeredCount === total;
    return shell(
      <Card>
        <p className="text-sm text-[#141B2E]">Review your answers</p>
        <p className="mt-[4px] text-xs text-[#4B5468]">
          {allAnswered
            ? "All five are recorded. Once you submit, you can't change them."
            : "Answer every question before you submit."}
        </p>
        <div className="mt-[12px] flex flex-col gap-[8px]">
          {interview.questions.map((q, i) => {
            const canRerecord = takesUsed(q) < AI_INTERVIEW_MAX_ATTEMPTS;
            return (
              <div key={q.id} className="flex items-center gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs ${
                    q.answered ? "bg-brand-gold-dark text-white" : "bg-[#E4E7EC] text-[#4B5468]"
                  }`}
                >
                  {q.answered ? <CheckIcon className="h-[10px] w-[10px]" /> : i + 1}
                </span>
                <p className="min-w-0 flex-1 text-xs text-[#141B2E]">{q.question}</p>
                <button
                  type="button"
                  disabled={busy || (q.answered && !canRerecord)}
                  onClick={() => {
                    setIndex(i);
                    setStep("question");
                  }}
                  className="shrink-0 text-xs text-brand-gold-dark hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                >
                  {q.answered ? "Record again" : "Answer"}
                </button>
              </div>
            );
          })}
        </div>
        {error && <p className="mt-[10px] text-xs text-red-500">{error}</p>}
        <div className="mt-[14px] flex flex-col gap-[8px] sm:flex-row">
          <button type="button" disabled={!allAnswered || busy} onClick={submit} className={primaryButton}>
            {busy ? "Submitting…" : "Submit my interview"}
          </button>
        </div>
      </Card>,
    );
  }

  // ── A question ──
  const left = Math.max(0, AI_INTERVIEW_MAX_ATTEMPTS - takesUsed(question));
  return shell(
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-center gap-[6px]" aria-label={`Question ${index + 1} of ${total}`}>
        {interview.questions.map((q, i) => (
          <span
            key={q.id}
            className={`h-[6px] flex-1 rounded-full ${
              i === index ? "bg-brand-gold-dark" : q.answered ? "bg-brand-gold" : "bg-[#E4E7EC]"
            }`}
          />
        ))}
      </div>
      <Card>
        <p className="text-xs text-[#9AA3B2]">
          Question {index + 1} of {total}
        </p>
        <p className="mt-[6px] text-base leading-[24px] text-[#141B2E]">{question.question}</p>
        {question.answered && (
          <p className="mt-[8px] rounded-[10px] bg-brand-gold-soft px-[10px] py-[6px] text-xs text-brand-gold-dark">
            You&rsquo;ve already answered this one. Recording again replaces your answer.
          </p>
        )}
        <div className="mt-[14px]">
          <AiAnswerRecorder
            key={`${question.id}-${question.attemptsLeft}`}
            seconds={interview.answerSeconds}
            takesLeft={left}
            onUse={saveAnswer}
            useLabel={index === total - 1 ? "Use this answer" : "Use this answer — next question"}
            busy={busy}
            error={error}
          />
        </div>
        <div className="mt-[14px] flex items-center justify-between gap-[10px] border-t border-black/[0.06] pt-[12px]">
          <button
            type="button"
            disabled={busy || index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="text-xs text-[#4B5468] hover:text-[#141B2E] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("review")}
            className="text-xs text-brand-gold-dark hover:underline disabled:opacity-40"
          >
            Review all answers
          </button>
        </div>
      </Card>
    </div>,
  );
}

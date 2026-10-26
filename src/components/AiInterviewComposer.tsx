"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { inputClass as formInputClass, textareaClass as formTextareaClass } from "./formStyles";
import { PlusIcon, XIcon } from "./icons";
import {
  AI_INTERVIEW_ANSWER_SECONDS,
  AI_INTERVIEW_DEADLINE_DAYS,
  AI_INTERVIEW_DEFAULT_ANSWER_SECONDS,
  AI_INTERVIEW_DEFAULT_DEADLINE_DAYS,
  AI_INTERVIEW_MAX_KEY_POINTS,
  AI_INTERVIEW_MAX_KEY_POINT_LENGTH,
  AI_INTERVIEW_MAX_QUESTION_LENGTH,
  AI_INTERVIEW_QUESTION_COUNT,
  type AiInterviewDraftQuestion,
  type EmployerAiInterview,
} from "@/lib/ai-interview-shared";

const inputClass = formInputClass("teal");
const textareaClass = formTextareaClass("teal");

function Segmented<T extends number>({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs text-[#4B5468]">{label}</p>
      <div role="group" aria-label={label} className="mt-[4px] flex w-fit items-center rounded-full bg-[#F1F4F8] p-[3px] text-sm">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-full px-[14px] py-[5px] transition-colors ${
              value === option ? "bg-white text-brand-teal-dark shadow-sm" : "text-[#4B5468] hover:text-[#141B2E]"
            }`}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The employer's "Send AI interview" flow: AI drafts five job-knowledge
 * questions with the key points a good answer covers, the employer edits
 * anything, picks the answer length and deadline, and sends. Nothing goes to
 * the applicant until they press Send.
 */
export default function AiInterviewComposer({
  applicationId,
  applicantName,
  jobTitle,
  onClose,
  onSent,
}: {
  applicationId: string;
  applicantName: string;
  jobTitle: string;
  onClose: () => void;
  onSent: (interview: EmployerAiInterview) => void;
}) {
  const [drafting, setDrafting] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AiInterviewDraftQuestion[]>([]);
  const [answerSeconds, setAnswerSeconds] = useState<number>(AI_INTERVIEW_DEFAULT_ANSWER_SECONDS);
  const [deadlineDays, setDeadlineDays] = useState<number>(AI_INTERVIEW_DEFAULT_DEADLINE_DAYS);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);

  const draft = useCallback(async () => {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/employer/ai-interviews/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't draft the questions.");
      setQuestions(data.questions);
      setEdited(false);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Couldn't draft the questions.");
    } finally {
      setDrafting(false);
    }
  }, [applicationId]);

  useEffect(() => {
    // Kick off the first draft as soon as the dialog opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void draft();
  }, [draft]);

  function update(index: number, patch: Partial<AiInterviewDraftQuestion>) {
    setEdited(true);
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  const problems = questions.map((q) => {
    if (!q.question.trim()) return "Write the question.";
    if (q.question.trim().length > AI_INTERVIEW_MAX_QUESTION_LENGTH) return `Keep the question under ${AI_INTERVIEW_MAX_QUESTION_LENGTH} characters.`;
    if (q.keyPoints.filter((p) => p.trim()).length === 0) return "Add at least one key point.";
    return null;
  });
  const valid = questions.length === AI_INTERVIEW_QUESTION_COUNT && problems.every((p) => p === null);

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/employer/ai-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          answerSeconds,
          deadlineDays,
          questions: questions.map((q) => ({
            question: q.question.trim(),
            keyPoints: q.keyPoints.map((p) => p.trim()).filter(Boolean),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the AI interview.");
      onSent(data.interview);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send the AI interview.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal large ariaLabel="Send AI interview" onClose={sending ? undefined : onClose}>
      <h2 className="text-lg font-semibold text-[#141B2E]">Send AI interview to {applicantName}</h2>
      <p className="mt-[6px] text-xs leading-[18px] text-[#4B5468]">
        Five questions about the <strong className="font-medium text-[#141B2E]">{jobTitle}</strong> job, answered by a short
        recording. AI scores each answer against the key points you approve here — so edit anything that isn&rsquo;t right.
      </p>

      {drafting && (
        <div className="mt-[18px] flex items-center gap-[10px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#4B5468]">
          <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-brand-teal-dark border-t-transparent" />
          Writing questions for {jobTitle}…
        </div>
      )}

      {!drafting && draftError && (
        <div className="mt-[18px] rounded-[14px] bg-[#FDECEC] p-[14px]">
          <p className="text-xs text-red-500">
            {draftError}
            {questions.length > 0 && " Your current questions are still below."}
          </p>
          <button
            type="button"
            onClick={draft}
            className="mt-[10px] flex h-[34px] items-center justify-center rounded-full bg-brand-teal-dark px-[18px] text-xs text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}

      {/* A failed redraft keeps the questions (and any edits) on screen. */}
      {!drafting && questions.length > 0 && (
        <>
          <div className="mt-[16px] flex flex-col gap-[14px]">
            {questions.map((q, i) => (
              <div key={i} className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <label htmlFor={`aiq-${i}`} className="text-xs text-[#4B5468]">
                  Question {i + 1}
                </label>
                <textarea
                  id={`aiq-${i}`}
                  value={q.question}
                  onChange={(e) => update(i, { question: e.target.value })}
                  rows={2}
                  maxLength={AI_INTERVIEW_MAX_QUESTION_LENGTH + 40}
                  className={`${textareaClass} mt-[4px] bg-white`}
                />
                <p className="mt-[10px] text-xs text-[#4B5468]">A good answer covers</p>
                <div className="mt-[4px] flex flex-col gap-[6px]">
                  {q.keyPoints.map((point, p) => (
                    <div key={p} className="flex items-center gap-[6px]">
                      <input
                        type="text"
                        value={point}
                        aria-label={`Question ${i + 1}, key point ${p + 1}`}
                        maxLength={AI_INTERVIEW_MAX_KEY_POINT_LENGTH}
                        onChange={(e) => update(i, { keyPoints: q.keyPoints.map((k, ki) => (ki === p ? e.target.value : k)) })}
                        className={`${inputClass} bg-white`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove key point ${p + 1} from question ${i + 1}`}
                        onClick={() => update(i, { keyPoints: q.keyPoints.filter((_, ki) => ki !== p) })}
                        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
                      >
                        <XIcon className="h-[10px] w-[10px]" />
                      </button>
                    </div>
                  ))}
                  {q.keyPoints.length < AI_INTERVIEW_MAX_KEY_POINTS && (
                    <button
                      type="button"
                      onClick={() => update(i, { keyPoints: [...q.keyPoints, ""] })}
                      className="flex w-fit items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[5px] pl-[12px] pr-[10px] text-xs text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
                    >
                      Add a key point
                      <PlusIcon className="h-[8px] w-[8px]" />
                    </button>
                  )}
                </div>
                {problems[i] && <p className="mt-[8px] text-xs text-red-500">{problems[i]}</p>}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!edited || window.confirm("Write five new questions? This replaces your edits.")) void draft();
            }}
            className="mt-[10px] text-xs text-brand-teal-dark hover:underline"
          >
            Write five new questions
          </button>

          <div className="mt-[16px] flex flex-wrap gap-x-[28px] gap-y-[12px] border-t border-black/[0.06] pt-[14px]">
            <Segmented
              label="Time for each answer"
              value={answerSeconds}
              options={AI_INTERVIEW_ANSWER_SECONDS}
              format={(v) => `${v} seconds`}
              onChange={setAnswerSeconds}
            />
            <Segmented
              label="Finish within"
              value={deadlineDays}
              options={AI_INTERVIEW_DEADLINE_DAYS}
              format={(v) => `${v} days`}
              onChange={setDeadlineDays}
            />
          </div>
          <p className="mt-[10px] text-xs leading-[18px] text-[#9AA3B2]">
            {applicantName} gets a notification and an email. They answer by video or audio, can record each answer up to
            3 times, and agree to AI-assisted evaluation first. The AI only reads what they say — never how they look or
            sound — and you decide what happens next.
          </p>

          {sendError && <p className="mt-[10px] text-xs text-red-500">{sendError}</p>}
          <div className="mt-[14px] flex flex-col gap-[8px] sm:flex-row">
            <button
              type="button"
              disabled={!valid || sending}
              onClick={send}
              className="flex h-[42px] items-center justify-center rounded-full bg-brand-teal-dark px-[22px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : `Send to ${applicantName.split(" ")[0] || "applicant"}`}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              className="flex h-[42px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

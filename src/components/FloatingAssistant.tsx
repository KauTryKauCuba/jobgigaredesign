"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { splitAttachments } from "@/lib/assistant-types";
import type {
  AssistantAction,
  AssistantConversationSummary,
  AssistantMessage,
  AssistantMessageStats,
  SimpleActionType,
  StageChangeResolution,
} from "@/lib/assistant-types";
import { APPLICATION_STATUS_COLOR, INTERVIEW_MODE_LABEL } from "@/lib/applicationStatus";
import { EVALUATION_CRITERION_LABEL, RECOMMENDATION_COLOR, RECOMMENDATION_LABEL } from "@/lib/interviewEvaluation";
import { plainTextToHtml } from "@/lib/richText";
import ApplicantModalHost, { fetchApplicantCards, type ApplicantViewer } from "./ApplicantModalHost";
import ChatApplicantCard, { summarize, type ApplicantSummary } from "./ChatApplicantCard";
import { downloadApplicantsExport } from "./ExportApplicantsButton";
import {
  ArrowUp,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  MicIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import SiriOrb from "./SiriOrb";

type Message = AssistantMessage | { id: string; role: "error"; text: string };

type Audience = "employer" | "jobseeker" | "visitor";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
  temporary: "Temporary",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

const SUGGESTIONS: Record<Audience, string[]> = {
  employer: [
    "How are my job postings doing?",
    "Any interviews this week?",
    "Who's my top applicant?",
    "Post a job for a sales executive",
  ],
  jobseeker: ["What's the status of my applications?", "Do I have any interviews?", "Tips for my next interview"],
  visitor: ["What does JobGiga do?", "How long does it take to set up?", "How does AI screening work?"],
};

function audienceFor(pathname: string | null): Audience {
  if (pathname?.startsWith("/employer/")) return "employer";
  if (pathname?.startsWith("/jobseeker/")) return "jobseeker";
  return "visitor";
}

// Each dashboard page renders its own shell (and so its own copy of this
// widget), so the open chat is mirrored here to survive navigation —
// including navigation the assistant itself triggers. For signed-in users
// this is only a cache of the current chat; the saved history lives in the
// database.
const STORAGE_PREFIX = "jobgiga-assistant:";

type StoredState = { messages: Message[]; open: boolean; conversationId: string | null };

function loadState(audience: Audience): StoredState {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + audience);
    if (raw) return { conversationId: null, ...JSON.parse(raw) };
  } catch {}
  return { messages: [], open: false, conversationId: null };
}

function saveState(audience: Audience, state: StoredState) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + audience, JSON.stringify({ ...state, messages: state.messages.slice(-40) }));
  } catch {}
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * MediaRecorder only ever encodes Opus (in a webm or mp4 box, depending on
 * browser) — MiMo's parser doesn't accept Opus in either container, only
 * true WAV/MP3/FLAC/AAC. Decoding via Web Audio and re-muxing to a plain
 * WAV file sidesteps the codec mismatch entirely.
 */
async function toWavBlob(blob: Blob): Promise<Blob> {
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  try {
    return encodeWav(await audioCtx.decodeAudioData(await blob.arrayBuffer()));
  } finally {
    await audioCtx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const blockAlign = numChannels * 2;
  const dataSize = buffer.length * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

// Replies are plain text by instruction, but may contain "- " bullet lines
// and paragraph breaks — render those as real structure instead of a wall
// of text with literal dashes.
// react-markdown never renders raw HTML. Images are dropped so that a reply
// can't make the browser call an outside address by itself.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <p className="font-medium text-[1.1em]">{children}</p>,
  h2: ({ children }) => <p className="font-medium text-[1.05em]">{children}</p>,
  h3: ({ children }) => <p className="font-medium">{children}</p>,
  strong: ({ children }) => <strong className="font-medium">{children}</strong>,
  ul: ({ children }) => <ul className="flex flex-col gap-[3px] pl-[16px]">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-[3px] pl-[18px] marker:text-[#9AA3B2]">{children}</ol>,
  li: ({ children }) => <li className="list-disc marker:text-[#9AA3B2] [ol>&]:list-decimal">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-teal-dark underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="border-l-2 border-black/[0.15] pl-[10px] text-[#4B5468]">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-black/[0.06] px-[4px] py-[1px] font-mono text-[0.92em]">{children}</code>,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-[10px] bg-[#F1F4F8] p-[10px] font-mono text-[0.92em] [&_code]:bg-transparent [&_code]:p-0">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-black/[0.12] px-[8px] py-[4px] font-medium whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="border-b border-black/[0.06] px-[8px] py-[4px] align-top">{children}</td>,
  hr: () => <hr className="border-black/[0.08]" />,
  img: () => null,
};

// A Markdown table: these get the chat's full width, where text keeps to reading width.
const TABLE_ROW = /^\s*\|.*\|\s*$/m;

function FormattedReply({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[8px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** What Chat mode's left rail (the dashboard sidebar) needs from the chat. */
export type ChatRailActions = {
  newChat: () => void;
  pastChatsOpen: boolean;
  togglePastChats: () => void;
  // Saved history only exists for signed-in dashboards.
  canShowPastChats: boolean;
};

// Gemini-style rows under the big composer — one icon per employer suggestion.
const SUGGESTION_ICONS: ((props: { className?: string }) => React.ReactNode)[] = [
  BriefcaseIcon,
  CalendarIcon,
  StarIcon,
  PencilIcon,
];

// How long a confirmed stage-change card offers Undo.
const UNDO_SECONDS = 10;

/**
 * A proposed stage move, waiting on the user: who moves, from where, what
 * was left out and why — then Confirm / Cancel, and afterwards how each move
 * went. Only the latest reply's card can still be answered.
 */
function StageChangeCard({
  action,
  canAnswer,
  moving,
  onAnswer,
  onUndo,
  onOpenProfile,
}: {
  action: Extract<AssistantAction, { type: "change_stage" }>;
  canAnswer: boolean;
  moving: boolean;
  onAnswer: (confirm: boolean) => void;
  // Set for a few seconds after Confirm: takes the moves back.
  onUndo?: () => void;
  onOpenProfile?: (applicationId: string) => void;
}) {
  const color = APPLICATION_STATUS_COLOR[action.to] ?? { bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
  const results = action.results ?? {};
  const moved = action.items.filter((i) => results[i.applicationId] === "ok").length;
  const undone = action.items.filter((i) => results[i.applicationId] === "undone").length;
  const count = action.items.length;
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-white p-[12px] text-xs text-[#141B2E]">
      <p className="flex flex-wrap items-center gap-[6px]">
        Move {count} applicant{count === 1 ? "" : "s"} to
        <span className={`rounded-full px-[8px] py-[2px] ${color.bg} ${color.text}`}>{action.toLabel}</span>
      </p>
      <ul className="flex max-h-[220px] flex-col gap-[2px] overflow-y-auto">
        {action.items.map((item) => {
          const result = results[item.applicationId];
          return (
            <li key={item.applicationId} className="flex items-start gap-[8px] rounded-[8px] px-[6px] py-[5px] hover:bg-[#F8FAFB]">
              <div className="min-w-0 flex-1">
                {onOpenProfile ? (
                  <button
                    type="button"
                    onClick={() => onOpenProfile(item.applicationId)}
                    className="truncate text-left text-[#141B2E] hover:text-brand-teal-dark hover:underline"
                  >
                    {item.name}
                  </button>
                ) : (
                  <span className="truncate">{item.name}</span>
                )}
                <p className="truncate text-[11px] text-[#9AA3B2]">
                  {item.posting} · {item.fromLabel} → {action.toLabel}
                </p>
                {result && result !== "ok" && result !== "undone" && <p className="text-[11px] text-red-500">{result}</p>}
              </div>
              {result === "ok" && <span className="shrink-0 text-[11px] text-[#2F7D4F]">✓ Moved</span>}
              {result === "undone" && <span className="shrink-0 text-[11px] text-[#9AA3B2]">↩ Undone</span>}
            </li>
          );
        })}
      </ul>
      {action.skipped.length > 0 && (
        <div className="rounded-[10px] bg-[#F8FAFB] px-[10px] py-[8px] text-[11px] text-[#4B5468]">
          <p className="text-[#9AA3B2]">Not included</p>
          <ul className="mt-[2px] flex flex-col gap-[2px]">
            {action.skipped.slice(0, 8).map((s) => (
              <li key={`${s.name}-${s.reason}`}>
                {s.name} — {s.reason}
              </li>
            ))}
            {action.skipped.length > 8 && <li>…and {action.skipped.length - 8} more</li>}
          </ul>
        </div>
      )}

      {!action.resolution && action.notes?.map((note) => (
        <p key={note} className="rounded-[10px] bg-[#FFF8E6] px-[10px] py-[8px] text-[11px] text-[#8A6A00]">
          {note}
        </p>
      ))}

      {action.resolution === "done" ? (
        <div className="flex flex-wrap items-center justify-between gap-[8px]">
          <p className={`text-[11px] ${moved === count ? "text-[#2F7D4F]" : "text-[#4B5468]"}`}>
            {moved === count ? `✓ Done — moved ${count} to ${action.toLabel}.` : `Moved ${moved} of ${count}; the rest are marked above.`}
          </p>
          {onUndo && (
            <button
              type="button"
              disabled={moving}
              onClick={onUndo}
              className="rounded-full border border-black/[0.1] px-[12px] py-[4px] text-[11px] text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:opacity-50"
            >
              {moving ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      ) : action.resolution === "undone" ? (
        <p className="text-[11px] text-[#4B5468]">
          {undone === moved + undone
            ? "↩ Undone — everyone is back where they were."
            : `↩ Undid ${undone} of ${moved + undone}; the rest are marked above.`}
        </p>
      ) : action.resolution === "cancelled" ? (
        <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
      ) : canAnswer ? (
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            disabled={moving}
            onClick={() => onAnswer(true)}
            className={`rounded-full px-[14px] py-[6px] text-[11px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
              action.to === "rejected" ? "bg-red-500" : "bg-brand-teal-dark"
            }`}
          >
            {moving ? "Moving…" : `Confirm${count > 1 ? ` (${count})` : ""}`}
          </button>
          <button
            type="button"
            disabled={moving}
            onClick={() => onAnswer(false)}
            className="rounded-full border border-black/[0.1] px-[14px] py-[6px] text-[11px] text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[#9AA3B2]">Not confirmed — nothing changed.</p>
      )}
    </div>
  );
}

// Shared chrome for the three single-applicant interview cards below — same
// width/padding/radius as StageChangeCard, Confirm/Cancel in the same place.
function InterviewActionCard({
  heading,
  body,
  resolved,
  doneContent,
  error,
  canAnswer,
  busy,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  destructive?: boolean;
  heading: React.ReactNode;
  body: React.ReactNode;
  // Set once the user has answered — shows doneContent instead of the buttons.
  resolved: boolean;
  doneContent: React.ReactNode;
  // A failed Confirm attempt, shown inline; the card stays answerable so they can retry.
  error: string | null;
  canAnswer: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-white p-[12px] text-xs text-[#141B2E]">
      {heading}
      {body}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {resolved ? (
        doneContent
      ) : canAnswer ? (
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-full px-[14px] py-[6px] text-[11px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${destructive ? "bg-red-500" : "bg-brand-teal-dark"}`}
          >
            {busy ? "Working…" : error ? "Try again" : "Confirm"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-full border border-black/[0.1] px-[14px] py-[6px] text-[11px] text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[#9AA3B2]">Not confirmed — nothing changed.</p>
      )}
    </div>
  );
}

function ScheduleInterviewCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
  onOpenProfile,
}: {
  action: Extract<AssistantAction, { type: "schedule_interview" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
  onOpenProfile?: (applicationId: string) => void;
}) {
  const when = new Date(action.scheduledAt).toLocaleString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[6px]">
          {action.isReschedule ? "Reschedule" : "Schedule"} round {action.round} interview with{" "}
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(action.applicationId)}
              className="font-medium text-brand-teal-dark hover:underline"
            >
              {action.name}
            </button>
          ) : (
            <span className="font-medium">{action.name}</span>
          )}
        </p>
      }
      body={
        <ul className="flex flex-col gap-[3px] text-[11px] text-[#4B5468]">
          <li>{action.posting}</li>
          <li>
            {when} · {INTERVIEW_MODE_LABEL[action.mode]}
            {action.durationMinutes ? ` · ${action.durationMinutes} min` : ""}
          </li>
          {action.mode === "onsite" && action.location && <li>{action.location}</li>}
          {action.mode === "online" && action.meetingLink && <li className="truncate">{action.meetingLink}</li>}
          {action.interviewerNames.length > 0 && <li>Interviewer{action.interviewerNames.length > 1 ? "s" : ""}: {action.interviewerNames.join(", ")}</li>}
          {action.notes && <li className="italic">&ldquo;{action.notes}&rdquo;</li>}
        </ul>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ {action.isReschedule ? "Rescheduled" : "Scheduled"} — the candidate has been notified.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function CancelInterviewCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
  onOpenProfile,
}: {
  action: Extract<AssistantAction, { type: "cancel_interview" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
  onOpenProfile?: (applicationId: string) => void;
}) {
  const when = new Date(action.scheduledAt).toLocaleString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[6px]">
          Cancel the interview with{" "}
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(action.applicationId)}
              className="font-medium text-brand-teal-dark hover:underline"
            >
              {action.name}
            </button>
          ) : (
            <span className="font-medium">{action.name}</span>
          )}
          ?
        </p>
      }
      body={
        <ul className="flex flex-col gap-[3px] text-[11px] text-[#4B5468]">
          <li>{action.posting}</li>
          <li>Scheduled for {when}</li>
          <li>
            Moves to <span className="rounded-full bg-[#F1F4F8] px-[6px] py-[1px]">{action.toLabel}</span>
          </li>
        </ul>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ Cancelled — moved to {action.toLabel}.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Kept — the interview is still on.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function RecordEvaluationCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
  onOpenProfile,
}: {
  action: Extract<AssistantAction, { type: "record_evaluation" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
  onOpenProfile?: (applicationId: string) => void;
}) {
  const rec = RECOMMENDATION_COLOR[action.recommendation] ?? { bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[6px]">
          Submit your scorecard for{" "}
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(action.applicationId)}
              className="font-medium text-brand-teal-dark hover:underline"
            >
              {action.name}
            </button>
          ) : (
            <span className="font-medium">{action.name}</span>
          )}
        </p>
      }
      body={
        <div className="flex flex-col gap-[6px] text-[11px] text-[#4B5468]">
          <p>{action.posting} · Round {action.round}</p>
          <ul className="flex flex-col gap-[2px]">
            {Object.entries(action.scores).map(([criterion, score]) => (
              <li key={criterion} className="flex items-center justify-between">
                <span>{EVALUATION_CRITERION_LABEL[criterion as keyof typeof EVALUATION_CRITERION_LABEL] ?? criterion}</span>
                <span className="text-[#141B2E]">{score}/5</span>
              </li>
            ))}
          </ul>
          <span className={`w-fit rounded-full px-[8px] py-[2px] ${rec.bg} ${rec.text}`}>
            {RECOMMENDATION_LABEL[action.recommendation]}
          </span>
          {action.notes && <p className="italic">&ldquo;{action.notes}&rdquo;</p>}
        </div>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ Scorecard submitted.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing submitted.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function ClosePostingCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
}: {
  action: Extract<AssistantAction, { type: "close_posting" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
}) {
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[6px]">
          Close <span className="font-medium">{action.title}</span>?
        </p>
      }
      body={<p className="text-[11px] text-[#4B5468]">It&rsquo;ll stop accepting new applications. Applicants already in the pipeline aren&rsquo;t affected.</p>}
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ Closed — it won&rsquo;t accept new applications.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Kept open — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function TeamChangeCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
}: {
  action: Extract<AssistantAction, { type: "team_change" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
}) {
  const who = <span className="font-medium">{action.memberLabel}</span>;
  const heading = {
    invite: <>Invite {who} as {action.roleLabel}?</>,
    role: <>Change {who} to {action.roleLabel}?</>,
    remove: <>Remove {who} from the team?</>,
    resend: <>Re-send {who}&rsquo;s invite?</>,
    jobs: <>Update {who}&rsquo;s jobs?</>,
  }[action.kind];
  const done = {
    invite: "✓ Invited. If the email doesn't arrive, ask me to re-send it.",
    role: `✓ Done. They're now ${action.roleLabel}.`,
    remove: "✓ Removed from the team.",
    resend: "✓ Invite re-sent, with a fresh 7-day link.",
    jobs: "✓ Jobs updated.",
  }[action.kind];
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={<p className="flex flex-wrap items-center gap-[4px]">{heading}</p>}
      body={
        <ul className="flex flex-col gap-[3px] text-[11px] text-[#4B5468]">
          {action.memberLabel !== action.email && <li>{action.email}</li>}
          {action.fromRoleLabel && action.kind === "role" && <li>{action.fromRoleLabel} → {action.roleLabel}</li>}
          {action.fromRoleLabel && action.kind === "remove" && <li>{action.fromRoleLabel}</li>}
          {action.position && <li>{action.position}</li>}
          {(action.kind === "jobs" || action.jobTitles.length > 0) && (
            <li>Jobs: {action.jobTitles.length ? action.jobTitles.join(", ") : "none"}</li>
          )}
          {!action.resolution && action.warning && <li className="mt-[4px] rounded-[10px] bg-[#FFF8E6] px-[10px] py-[8px] text-[#8A6A00]">{action.warning}</li>}
        </ul>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">{done}</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function ChangeList({ changes }: { changes: { label: string; from: string; to: string }[] }) {
  return (
    <ul className="flex flex-col gap-[6px] text-[11px] text-[#4B5468]">
      {changes.map((change) => (
        <li key={change.label} className="min-w-0 break-words">
          <span className="text-[#141B2E]">{change.label}</span>
          <br />
          <span className="text-[#9AA3B2]">{change.from}</span> → {change.to}
        </li>
      ))}
    </ul>
  );
}

function PostingEditCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
}: {
  action: Extract<AssistantAction, { type: "posting_edit" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
}) {
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p>
          Update <span className="font-medium">{action.title}</span>?
        </p>
      }
      body={<ChangeList changes={action.changes} />}
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ Posting updated.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function InterviewProgressCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
  onOpenProfile,
}: {
  action: Extract<AssistantAction, { type: "interview_progress" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
  onOpenProfile?: (applicationId: string) => void;
}) {
  const verb = { attended: "Mark as attended:", no_show: "Mark as a no-show:", start_evaluation: "Start the evaluation for" }[action.kind];
  const done = { attended: "✓ Marked as attended.", no_show: "✓ Marked as a no-show.", start_evaluation: "✓ Evaluation started. The panel has been asked for scorecards." }[action.kind];
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[4px]">
          {verb}
          {onOpenProfile ? (
            <button type="button" onClick={() => onOpenProfile(action.applicationId)} className="font-medium text-brand-teal-dark hover:underline">
              {action.name}
            </button>
          ) : (
            <span className="font-medium">{action.name}</span>
          )}
        </p>
      }
      body={<p className="text-[11px] text-[#4B5468]">{action.posting}</p>}
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">{done}</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Sends a card's request the way its file needs. Only ever to this app's own API.
async function sendConfirmAction(action: Extract<AssistantAction, { type: "confirm_action" }>, file: File | null) {
  const { method, url } = action.request;
  if (!url.startsWith("/api/")) throw new Error("That action isn't allowed.");
  const body: Record<string, unknown> = { ...(action.request.body ?? {}) };
  const spec = action.file;
  let init: RequestInit = { method };
  if (spec?.send === "multipart") {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) form.append(key, String(value));
    if (file) form.append(spec.field, file);
    init = { method, body: form };
  } else {
    if (spec && file) {
      if (spec.send === "dataUrl") {
        body[spec.field] = await readAsDataUrl(file);
      } else if (spec.uploadUrl) {
        const form = new FormData();
        for (const [key, value] of Object.entries(spec.uploadFields ?? {})) form.append(key, value);
        form.append("image", file);
        const uploaded = await fetch(spec.uploadUrl, { method: "POST", body: form });
        const result = await uploaded.json().catch(() => ({}));
        if (!uploaded.ok) throw new Error(result.error ?? "Couldn't upload that file.");
        body[spec.field] = result.url;
      }
    }
    if (action.request.body !== null) {
      init = { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    }
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't go through. Try again.");
}

function ConfirmActionCard({
  action,
  canAnswer,
  busy,
  error,
  posterUrl,
  posterWaiting,
  onAnswer,
  onGo,
}: {
  action: Extract<AssistantAction, { type: "confirm_action" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  posterUrl?: string;
  posterWaiting: boolean;
  onAnswer: (confirm: boolean, file: File | null) => void;
  onGo: (path: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [missing, setMissing] = useState(false);
  const pickFile = action.file && canAnswer && !action.resolution;
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error ?? (missing ? `Choose the ${action.file?.label.toLowerCase()} first.` : null)}
      resolved={!!action.resolution}
      destructive={action.destructive}
      heading={<p className="font-medium">{action.title}</p>}
      body={
        <div className="flex flex-col gap-[8px] text-[11px] text-[#4B5468]">
          {action.lines.length > 0 && (
            <ul className="flex flex-col gap-[4px]">
              {action.lines.map((line) => (
                <li key={line.label} className="min-w-0 break-words">
                  <span className="text-[#9AA3B2]">{line.label}:</span> {line.value}
                </li>
              ))}
            </ul>
          )}
          {!action.resolution && action.warning && (
            <p className={`rounded-[10px] px-[10px] py-[8px] ${action.destructive ? "bg-red-50 text-red-700" : "bg-[#FFF8E6] text-[#8A6A00]"}`}>{action.warning}</p>
          )}
          {pickFile && (
            <label className="flex cursor-pointer items-center gap-[8px] rounded-[10px] border border-dashed border-black/[0.15] px-[10px] py-[8px] hover:bg-black/[0.02]">
              <PaperclipIcon className="h-[12px] w-[12px] shrink-0 text-brand-teal-dark" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : `Choose ${action.file!.label.toLowerCase()}${action.file!.required ? "" : " (optional)"}`}</span>
              <input
                type="file"
                accept={action.file!.accept}
                aria-label={action.file!.label}
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setMissing(false);
                }}
              />
            </label>
          )}
          {posterWaiting && <p className="text-[#9AA3B2]">Generating your poster. This takes a minute or two…</p>}
          {posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- generated poster, shown as stored
            <a href={posterUrl} target="_blank" rel="noopener noreferrer"><img src={posterUrl} alt="Generated poster" className="max-h-[320px] rounded-[10px]" /></a>
          )}
        </div>
      }
      doneContent={
        action.resolution === "done" ? (
          <div className="flex flex-wrap items-center gap-[8px] text-[11px]">
            <p className="text-[#2F7D4F]">{action.doneText}</p>
            {action.link && (
              <button type="button" onClick={() => onGo(action.link!.path)} className="text-brand-teal-dark hover:underline">
                {action.link.label} →
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => {
        if (action.file?.required && !file) {
          setMissing(true);
          return;
        }
        onAnswer(true, file);
      }}
      onCancel={() => onAnswer(false, null)}
    />
  );
}

function CompanyEditCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
}: {
  action: Extract<AssistantAction, { type: "company_edit" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
}) {
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={<p>Update your company details?</p>}
      body={
        <div className="flex flex-col gap-[8px]">
          <ChangeList changes={action.changes} />
          {!action.resolution && action.warning && (
            <p className="rounded-[10px] bg-[#FFF8E6] px-[10px] py-[8px] text-[11px] text-[#8A6A00]">{action.warning}</p>
          )}
        </div>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="text-[11px] text-[#2F7D4F]">✓ Saved to your company profile.</p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing changed.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

function CreateJobPostingCard({
  action,
  canAnswer,
  busy,
  error,
  onAnswer,
  onGo,
}: {
  action: Extract<AssistantAction, { type: "create_job_posting" }>;
  canAnswer: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (confirm: boolean) => void;
  onGo: (path: string) => void;
}) {
  const salary = action.salaryMin || action.salaryMax ? `RM ${action.salaryMin ?? "?"}–${action.salaryMax ?? "?"} a month` : null;
  const [showFull, setShowFull] = useState(false);
  return (
    <InterviewActionCard
      canAnswer={canAnswer}
      busy={busy}
      error={error}
      resolved={!!action.resolution}
      heading={
        <p className="flex flex-wrap items-center gap-[6px]">
          Save <span className="font-medium">{action.title}</span> as a draft?
        </p>
      }
      body={
        <ul className="flex flex-col gap-[3px] text-[11px] text-[#4B5468]">
          <li>{EMPLOYMENT_TYPE_LABEL[action.employmentType] ?? action.employmentType} · {WORK_ARRANGEMENT_LABEL[action.workArrangement] ?? action.workArrangement}</li>
          {action.location && <li>{action.location}</li>}
          {salary && <li>{salary}</li>}
          {action.skills.length > 0 && <li>{action.skills.slice(0, 6).join(", ")}</li>}
          {action.description && <li className={showFull ? "whitespace-pre-line" : "line-clamp-2"}>{action.description}</li>}
          {showFull && action.responsibilities && <li className="mt-[6px] whitespace-pre-line">{action.responsibilities}</li>}
          {(action.description || action.responsibilities) && (
            <li>
              <button type="button" onClick={() => setShowFull((v) => !v)} className="text-brand-teal-dark hover:underline">
                {showFull ? "Show less" : "See full posting"}
              </button>
            </li>
          )}
        </ul>
      }
      doneContent={
        action.resolution === "done" ? (
          <p className="flex flex-col items-start gap-[4px] text-[11px] text-[#2F7D4F]">
            ✓ Saved as a draft.
            {action.postingId && (
              <button
                type="button"
                onClick={() => onGo(`/employer/jobs/postajob?id=${action.postingId}`)}
                className="text-brand-teal-dark hover:underline"
              >
                Review and submit it →
              </button>
            )}
          </p>
        ) : (
          <p className="text-[11px] text-[#9AA3B2]">Cancelled — nothing created.</p>
        )
      }
      onConfirm={() => onAnswer(true)}
      onCancel={() => onAnswer(false)}
    />
  );
}

// Several cards side by side, scrolling sideways past three — our teal-dot
// pagination (same style as AdCarousel) instead of a native scrollbar. With
// several cards visible at once, a dot per screenful (not per card) is what
// actually matches what moves as you scroll.
function CardRow({ people, children }: { people: { applicationId: string }[]; children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = () => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const n = maxScroll > 4 ? Math.round(track.scrollWidth / track.clientWidth) : 1;
    setPages(Math.max(1, n));
    setActive(maxScroll > 0 ? Math.round((track.scrollLeft / maxScroll) * (Math.max(1, n) - 1)) : 0);
  };

  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [people.length]);

  const goTo = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: pages > 1 ? (maxScroll * page) / (pages - 1) : 0, behavior: "smooth" });
  };

  return (
    <div>
      <div ref={trackRef} onScroll={measure} className="scrollbar-hide flex snap-x gap-[8px] overflow-x-auto pb-[4px]">
        {children}
      </div>
      {pages > 1 && (
        <div className="mt-[8px] flex items-center justify-center gap-[6px]">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show cards, page ${i + 1} of ${pages}`}
              aria-current={i === active}
              className={`h-[7px] rounded-full transition-all ${
                i === active ? "w-[22px] bg-brand-teal-dark" : "w-[7px] bg-black/[0.15] hover:bg-black/[0.3]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FloatingAssistant({
  layout = "floating",
  leaving = false,
  entering = false,
  greetingName,
  rail,
  onNavigate,
  viewer,
  modeSwitch,
}: {
  // Employer dashboards: the Dashboard / Chat switch, shown under the
  // "AI can make mistakes" note in both layouts.
  modeSwitch?: React.ReactNode;
  // Employer dashboards: the signed-in teammate, so an applicant's profile
  // window can open right here in the chat.
  viewer?: ApplicantViewer;
  // "floating": the bar at the bottom of the dashboard. "full": the employer
  // dashboard's Chat mode, where the assistant takes over the whole page.
  // Same component either way, so a chat carries straight across a switch.
  layout?: "floating" | "full";
  // The view is animating out (a mode switch is under way).
  leaving?: boolean;
  // Just switched to this layout — fade it in (not on a plain page load).
  entering?: boolean;
  greetingName?: string | null;
  // Full layout: the left rail — the dashboard's own sidebar, given the
  // chat's New chat / Past chats controls.
  rail?: (actions: ChatRailActions) => React.ReactNode;
  // Full layout: how to leave for a dashboard page (switches back to
  // Dashboard mode first, so the page actually shows).
  onNavigate?: (href: string) => void;
} = {}) {
  const router = useRouter();
  const go = (path: string) => (onNavigate ? onNavigate(path) : router.push(path));
  const full = layout === "full";
  const pathname = usePathname();
  const audience = audienceFor(pathname);
  // Dashboards are always signed in, so their chats are saved to the
  // account; the public landing pages only keep a chat for the tab.
  const saved = audience !== "visitor";
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<AssistantConversationSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<{ id: string; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyReply = (id: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
      })
      .catch(() => {});
  };
  // Applicants whose full profile is open, oldest first — Chat mode can hold
  // several at once — and per-applicant counters that reload a profile after
  // a change made from the chat itself.
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [versions, setVersions] = useState<Record<string, number>>({});
  // A profile just opened in the conversation, to bring into view.
  const [scrollToProfile, setScrollToProfile] = useState<string | null>(null);
  // Profile cards' details, fetched once per applicant and kept live.
  const [summaries, setSummaries] = useState<Record<string, ApplicantSummary>>({});
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({});
  const requestedSummaries = useRef(new Set<string>());
  // The message whose card shows each applicant — their latest card.
  const cardMessageFor: Record<string, string> = {};
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    if (m.action?.type === "open_applicant") cardMessageFor[m.action.applicationId] = m.id;
    if (m.action?.type === "open_applicants") for (const p of m.action.people) cardMessageFor[p.applicationId] = m.id;
  }
  // Chat mode opens a profile right in the conversation, under its card. One
  // without a card in the chat (e.g. opened from a stage-change card's name),
  // or anything in the floating bar, opens as the usual pop-up — one at a time.
  const openInChat = (id: string) => full && !!viewer && !!cardMessageFor[id];
  const popupId = [...openIds].reverse().find((id) => !openInChat(id)) ?? null;
  // The stage-change card being carried out right now, and the confirmed
  // cards whose Undo is still on offer.
  const [movingId, setMovingId] = useState<string | null>(null);
  const [undoable, setUndoable] = useState<Record<string, boolean>>({});
  // schedule_interview / cancel_interview / record_evaluation cards: which
  // one is mid-Confirm, and the last attempt's error (if any), by message id.
  const [interviewActionBusyId, setInterviewActionBusyId] = useState<string | null>(null);
  const [interviewActionErrors, setInterviewActionErrors] = useState<Record<string, string>>({});
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The reply as it's being written, and what the assistant is doing meanwhile.
  const [streamText, setStreamText] = useState("");
  const [statusText, setStatusText] = useState("");
  const stopRequestedRef = useRef(false);
  // A file read and waiting to go with the next message.
  const [attachment, setAttachment] = useState<{ name: string; text: string; truncated: boolean } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Set while the box holds an edit of the last message: any file it was sent with.
  const [editing, setEditing] = useState<{ prefix: string } | null>(null);
  // Posters being generated from a card, by message.
  const [posters, setPosters] = useState<Record<string, { waiting: boolean; url?: string }>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  // Voice input resolves asynchronously (record, then transcribe) — these
  // let it send against the chat as it is by then, not as it was when
  // recording started.
  const inputValueRef = useRef(input);
  const messagesRef = useRef(messages);
  const conversationIdRef = useRef(conversationId);
  const thinkingRef = useRef(thinking);

  useEffect(() => {
    const stored = loadState(audience);
    // Restoring from sessionStorage has to happen after mount — reading it
    // during render would mismatch the server-rendered (empty) markup.
    setMessages(stored.messages);
    setConversationId(saved ? stored.conversationId : null);
    setOpen(stored.open && stored.messages.length > 0);
    setHydrated(true);
  }, [audience, saved]);

  useEffect(() => {
    if (hydrated) saveState(audience, { messages, open, conversationId });
  }, [audience, messages, open, conversationId, hydrated]);

  useEffect(() => {
    inputValueRef.current = input;
    messagesRef.current = messages;
    conversationIdRef.current = conversationId;
    thinkingRef.current = thinking;
  }, [input, messages, conversationId, thinking]);

  useEffect(() => {
    // Chat mode keeps the conversation on screen while past chats are open.
    if (view === "chat" || full) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open, view, full]);

  // Follows a reply as it's written, unless they've scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [streamText, statusText]);

  // The message box grows with what's typed, then scrolls.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // A profile opening in the conversation is tall — bring its top into view
  // (after the scroll-to-latest above has run), not its end.
  useEffect(() => {
    if (!full || !scrollToProfile) return;
    const timer = setTimeout(() => {
      document.getElementById(`chat-profile-${scrollToProfile}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToProfile(null);
    }, 150);
    return () => clearTimeout(timer);
  }, [full, scrollToProfile]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      // Releases the mic if the widget unmounts mid-recording — otherwise the
      // browser's mic-in-use indicator stays lit.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorder.stop();
      }
    },
    [],
  );

  // `replacing`: the id of the answer this one replaces (Regenerate / Edit).
  async function requestReply(text: string, previous: Message[], replacing?: string) {
    setThinking(true);
    setStreamText("");
    setStatusText("");
    stopRequestedRef.current = false;
    const controller = new AbortController();
    requestRef.current = controller;
    let partial = "";
    try {
      const body = saved
        ? { message: text, conversationId: conversationIdRef.current, pathname, stream: true, regenerate: replacing }
        : {
            pathname,
            stream: true,
            messages: [...previous, { role: "user", text }]
              .filter((m) => m.role !== "error")
              .map((m) => ({ role: m.role, content: m.text })),
          };
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const failed = await res.json().catch(() => ({}));
        throw new Error(failed.error ?? "Something went wrong. Try again.");
      }

      // One JSON event per line, ending with the finished reply.
      let data: Record<string, unknown> | null = null;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; text?: string; error?: string } & Record<string, unknown>;
          if (event.type === "delta") {
            partial += event.text ?? "";
            setStreamText(partial);
            setStatusText("");
          } else if (event.type === "status") {
            setStatusText(event.text ?? "");
          } else if (event.type === "reset") {
            partial = "";
            setStreamText("");
          } else if (event.type === "error") {
            throw new Error(event.error ?? "Something went wrong. Try again.");
          } else if (event.type === "done") {
            data = event;
          }
        }
      }
      if (!data) throw new Error("The reply was cut off. Try again.");

      const action = (data.action ?? null) as AssistantAction | null;
      const stats = (data.stats ?? null) as AssistantMessageStats | null;
      const savedConversationId = data.conversationId as string | null;
      if (savedConversationId) {
        if (savedConversationId !== conversationIdRef.current) setConversations(null);
        setConversationId(savedConversationId);
      }
      const replyId = (data.messageId as string | null) ?? newId();
      const replyText = data.reply as string;
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", text: replyText, action, stats }]);

      if (action?.type === "navigate" && action.openNow) {
        setTimeout(() => go(action.path), 600);
      } else if (action?.type === "open_applicant" && viewer) {
        openProfiles([action.applicationId]);
      } else if (action?.type === "open_applicants" && viewer && full) {
        // A row of cards, with the first person's full profile open under it
        // (the floating bar just shows the cards).
        openProfiles([action.people[0].applicationId]);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Stopped by the user: keep what was written. (Leaving the chat aborts too, and shows nothing.)
        if (stopRequestedRef.current) {
          setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: partial.trim() ? `${partial.trim()}\n\n*Stopped.*` : "*Stopped.*" }]);
        }
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "error", text: err instanceof Error ? err.message : "Something went wrong. Try again." },
      ]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setStreamText("");
        setStatusText("");
      }
      setThinking(false);
    }
  }

  function stopReply() {
    stopRequestedRef.current = true;
    requestRef.current?.abort();
  }

  function sendMessage(text: string) {
    const typed = text.trim();
    if ((!typed && !attachment && !editing) || thinkingRef.current) return;
    if (editing) {
      if (!typed && !editing.prefix) return;
      setEditing(null);
      setInput("");
      redo(`${editing.prefix}${typed}`);
      return;
    }
    const message = attachment
      ? `<attachment name="${attachment.name}">${attachment.text.replace(/<\/attachment>/g, "")}</attachment>\n\n${typed}`
      : typed;
    const previous = messagesRef.current.filter((m) => m.role !== "error");
    setMessages([...previous, { id: newId(), role: "user", text: message }]);
    setInput("");
    setAttachment(null);
    setAttachError(null);
    setOpen(true);
    setView("chat");
    requestReply(message, previous);
  }

  // Asks the last question again (changed, for Edit), replacing its answer.
  function redo(text: string) {
    const current = messagesRef.current.filter((m) => m.role !== "error");
    const lastUser = current.map((m) => m.role).lastIndexOf("user");
    if (lastUser < 0) return;
    const previous = current.slice(0, lastUser);
    const answer = current[lastUser + 1];
    setMessages([...previous, { id: newId(), role: "user", text }]);
    // The server only replaces it if it's the chat's saved latest answer (a
    // stopped reply never was), so this holds across a reload too.
    requestReply(text, previous, answer?.id);
  }

  // The latest answer can be redone unless its card was already answered:
  // that's a record of something that happened.
  const lastMessage = messages[messages.length - 1];
  const canRedo =
    !thinking &&
    lastMessage?.role === "assistant" &&
    !(lastMessage.action && "resolution" in lastMessage.action && lastMessage.action.resolution);

  function startEditing(text: string) {
    const { typed } = splitAttachments(text);
    setEditing({ prefix: text.slice(0, text.length - typed.length) });
    setInput(typed);
    inputRef.current?.focus();
  }

  async function attachFile(file: File) {
    setAttachError(null);
    setAttaching(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assistant/attachment", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that file.");
      setAttachment({ name: data.name, text: data.text, truncated: data.truncated === true });
      inputRef.current?.focus();
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setAttaching(false);
    }
  }

  // A failed message was never saved (the server only stores a question
  // once it has an answer), so retrying just re-asks the last question.
  function retry() {
    const withoutErrors = messagesRef.current.filter((m) => m.role !== "error");
    const last = withoutErrors[withoutErrors.length - 1];
    if (!last || last.role !== "user") return;
    setMessages(withoutErrors);
    requestReply(last.text, withoutErrors.slice(0, -1));
  }

  async function resolveClosePosting(
    messageId: string,
    action: Extract<AssistantAction, { type: "close_posting" }>,
    confirm: boolean,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "close_posting", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(`/api/employer/job-postings/${action.postingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't close that posting.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "close_posting", "done");
      router.refresh();
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't close that posting." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveCreateJobPosting(
    messageId: string,
    action: Extract<AssistantAction, { type: "create_job_posting" }>,
    confirm: boolean,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "create_job_posting", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch("/api/employer/job-postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "draft",
          title: action.title,
          // The AI writes plain text; these are rich-text fields, as with the form's "AI fill".
          description: action.description && plainTextToHtml(action.description),
          responsibilities: action.responsibilities && plainTextToHtml(action.responsibilities),
          industry: action.industry,
          employmentType: action.employmentType,
          workArrangement: action.workArrangement,
          location: action.location,
          salaryMin: action.salaryMin,
          salaryMax: action.salaryMax,
          skills: action.skills,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't create that posting.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "create_job_posting", "done", { postingId: data.posting.id });
      router.refresh();
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't create that posting." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  // Every card in a row asks as it mounts; waiting a tick lets one request cover them all.
  const summaryQueue = useRef<string[]>([]);
  const needSummary = useCallback((applicationId: string) => {
    if (requestedSummaries.current.has(applicationId)) return;
    requestedSummaries.current.add(applicationId);
    summaryQueue.current.push(applicationId);
    if (summaryQueue.current.length > 1) return;
    setTimeout(() => {
      const ids = summaryQueue.current;
      summaryQueue.current = [];
      const failAll = (ids: string[], message: string) =>
        setSummaryErrors((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, message])) }));
      fetchApplicantCards(ids)
        .then((found) => {
          setSummaries((prev) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(found).map(([id, data]) => [id, summarize(data.applicant, data.fit)])),
          }));
          const missing = ids.filter((id) => !found[id]);
          if (missing.length) failAll(missing, "That applicant isn't available any more.");
        })
        .catch((err) => failAll(ids, err instanceof Error ? err.message : "Couldn't load this profile."));
    }, 0);
  }, []);

  // Coming back to the chat (another tab, another app) refreshes the profile
  // cards, so a stage a teammate changed meanwhile shows. Open full profiles
  // are left alone — they may hold a half-filled form.
  const summariesRef = useRef(summaries);
  useEffect(() => {
    summariesRef.current = summaries;
  }, [summaries]);
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5000) return;
      last = Date.now();
      const ids = Object.keys(summariesRef.current);
      if (!ids.length) return;
      fetchApplicantCards(ids)
        .then((found) =>
          setSummaries((prev) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(found).map(([id, data]) => [id, summarize(data.applicant, data.fit)])),
          })),
        )
        .catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Everyone sharing a row of cards (one reply showing several people) with this applicant.
  function rowOf(applicationId: string): string[] {
    const message = messages.find((m) => m.id === cardMessageFor[applicationId]);
    return message?.role === "assistant" && message.action?.type === "open_applicants"
      ? message.action.people.map((p) => p.applicationId)
      : [];
  }

  function openProfiles(applicationIds: string[]) {
    if (!applicationIds.length) return;
    // The floating bar's pop-up shows one at a time. Chat mode keeps several
    // open — but one per row of cards, shown under that row.
    if (!full) {
      setOpenIds([applicationIds[0]]);
      return;
    }
    const row = rowOf(applicationIds[0]);
    setOpenIds((prev) => [...prev.filter((id) => !applicationIds.includes(id) && !row.includes(id)), ...applicationIds]);
    setScrollToProfile(applicationIds[0]);
  }

  const openProfile = (applicationId: string) => openProfiles([applicationId]);
  const closeProfile = (applicationId: string) => setOpenIds((prev) => prev.filter((id) => id !== applicationId));

  // A stage-change card's Confirm / Cancel. Each move goes through the same
  // API as the dashboard's own buttons (permissions, notifications and all),
  // a few at a time; the card then shows how each one went, and that's saved
  // on the message so it never offers its buttons twice.
  // Each applicant on a card moved (or moved back) through the dashboard's
  // own API, three at a time. Returns, per applicant, `success` or why not.
  async function runMoves(
    items: { applicationId: string; status: string }[],
    success: string,
    undo: boolean,
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const queue = [...items];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const res = await fetch(`/api/employer/applications/${item.applicationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(undo ? { status: item.status, undo: true } : { status: item.status }),
          });
          const data = await res.json().catch(() => ({}));
          results[item.applicationId] = res.ok ? success : (data.error ?? "Couldn't move this applicant.");
        } catch {
          results[item.applicationId] = "Couldn't reach the server.";
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return results;
  }

  // Profile cards and open profiles show a stage change straight away.
  function showStages(stages: Record<string, string>) {
    const ids = Object.keys(stages);
    if (!ids.length) return;
    router.refresh();
    setSummaries((prev) => {
      const next = { ...prev };
      for (const id of ids) if (next[id]) next[id] = { ...next[id], status: stages[id] };
      return next;
    });
    const reload = ids.filter((id) => openIds.includes(id));
    if (reload.length) {
      setVersions((prev) => {
        const next = { ...prev };
        for (const id of reload) next[id] = (next[id] ?? 0) + 1;
        return next;
      });
    }
  }

  function saveStageCard(
    messageId: string,
    resolution: StageChangeResolution,
    results: Record<string, string>,
  ) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.role === "assistant" && m.action?.type === "change_stage"
          ? { ...m, action: { ...m.action, resolution, results } }
          : m,
      ),
    );
    if (saved) {
      fetch(`/api/assistant/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, results }),
      }).catch(() => {});
    }
  }

  async function resolveStageChange(messageId: string, action: Extract<AssistantAction, { type: "change_stage" }>, confirm: boolean) {
    if (!confirm) {
      saveStageCard(messageId, "cancelled", {});
      return;
    }
    setMovingId(messageId);
    const results = await runMoves(
      action.items.map((i) => ({ applicationId: i.applicationId, status: action.to })),
      "ok",
      false,
    );
    setMovingId(null);
    showStages(Object.fromEntries(action.items.filter((i) => results[i.applicationId] === "ok").map((i) => [i.applicationId, action.to])));
    saveStageCard(messageId, "done", results);
    // Undo stays on offer for UNDO_SECONDS.
    if (action.items.some((i) => results[i.applicationId] === "ok" && i.fromStatus)) {
      setUndoable((prev) => ({ ...prev, [messageId]: true }));
      setTimeout(() => setUndoable((prev) => ({ ...prev, [messageId]: false })), UNDO_SECONDS * 1000);
    }
  }

  // Takes a just-confirmed card back: everyone it moved goes back where they
  // were, as if it never happened (see the applications API's undo).
  async function undoStageChange(messageId: string, action: Extract<AssistantAction, { type: "change_stage" }>) {
    const moved = action.items.filter((i) => action.results?.[i.applicationId] === "ok" && i.fromStatus);
    setUndoable((prev) => ({ ...prev, [messageId]: false }));
    setMovingId(messageId);
    const undone = await runMoves(
      moved.map((i) => ({ applicationId: i.applicationId, status: i.fromStatus! })),
      "undone",
      true,
    );
    setMovingId(null);
    showStages(Object.fromEntries(moved.filter((i) => undone[i.applicationId] === "undone").map((i) => [i.applicationId, i.fromStatus!])));
    saveStageCard(messageId, "undone", { ...action.results, ...undone });
  }

  // Shared by the card-with-Confirm/Cancel actions below: records the
  // user's answer on the message itself (same idea as saveStageCard), so it
  // never offers its buttons twice once actually resolved. `extra` carries
  // back a field the card needs saved alongside the resolution (e.g.
  // create_job_posting's new postingId, for the "review it" link to survive
  // reopening the chat).
  function saveSimpleActionResolution(
    messageId: string,
    actionType: SimpleActionType,
    resolution: "done" | "cancelled",
    extra?: Record<string, unknown>,
  ) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.role === "assistant" && m.action?.type === actionType
          ? { ...m, action: { ...m.action, ...extra, resolution } }
          : m,
      ),
    );
    if (saved) {
      fetch(`/api/assistant/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, actionType, ...extra }),
      }).catch(() => {});
    }
  }

  async function resolveScheduleInterview(
    messageId: string,
    action: Extract<AssistantAction, { type: "schedule_interview" }>,
    confirm: boolean,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "schedule_interview", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(`/api/employer/applications/${action.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "interview",
          interviewDetails: {
            round: action.round,
            mode: action.mode,
            scheduledAt: action.scheduledAt,
            durationMinutes: action.durationMinutes,
            location: action.location,
            meetingLink: action.meetingLink,
            interviewerUserIds: action.interviewerUserIds,
            notes: action.notes,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't schedule the interview.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      showStages({ [action.applicationId]: "interview" });
      saveSimpleActionResolution(messageId, "schedule_interview", "done");
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveCancelInterview(
    messageId: string,
    action: Extract<AssistantAction, { type: "cancel_interview" }>,
    confirm: boolean,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "cancel_interview", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(`/api/employer/applications/${action.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.toStatus, interviewDetails: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't cancel the interview.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      showStages({ [action.applicationId]: action.toStatus });
      saveSimpleActionResolution(messageId, "cancel_interview", "done");
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveRecordEvaluation(
    messageId: string,
    action: Extract<AssistantAction, { type: "record_evaluation" }>,
    confirm: boolean,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "record_evaluation", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(`/api/employer/applications/${action.applicationId}/evaluation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: action.scores, recommendation: action.recommendation, notes: action.notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit your scorecard.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      if (typeof data.status === "string") showStages({ [action.applicationId]: data.status });
      saveSimpleActionResolution(messageId, "record_evaluation", "done");
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveTeamChange(messageId: string, action: Extract<AssistantAction, { type: "team_change" }>, confirm: boolean) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "team_change", "cancelled");
      return;
    }
    const member = `/api/employer/team/${action.memberId}`;
    const request = {
      invite: {
        url: "/api/employer/team",
        method: "POST",
        body: { email: action.email, role: action.role, position: action.position, jobPostingIds: action.jobPostingIds },
      },
      role: { url: member, method: "PATCH", body: { role: action.role } },
      remove: { url: member, method: "DELETE", body: null },
      resend: { url: `${member}/resend`, method: "POST", body: null },
      jobs: { url: `${member}/jobs`, method: "PUT", body: { jobPostingIds: action.jobPostingIds } },
    }[action.kind];
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(request.url, {
        method: request.method,
        ...(request.body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the team.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "team_change", "done");
      router.refresh();
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveCompanyEdit(messageId: string, action: Extract<AssistantAction, { type: "company_edit" }>, confirm: boolean) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "company_edit", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch("/api/employer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save those details.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "company_edit", "done");
      router.refresh();
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveConfirmAction(
    messageId: string,
    action: Extract<AssistantAction, { type: "confirm_action" }>,
    confirm: boolean,
    file: File | null,
  ) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "confirm_action", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      await sendConfirmAction(action, file);
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "confirm_action", "done");
      if (action.reloadAfter) {
        window.location.assign("/employer/dashboard");
        return;
      }
      router.refresh();
      if (action.pollPosterUrl) watchPoster(messageId, action.pollPosterUrl);
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  // A poster takes a minute or two: the card shows it once it's ready.
  function watchPoster(messageId: string, url: string) {
    setPosters((prev) => ({ ...prev, [messageId]: { waiting: true } }));
    const deadline = Date.now() + 5 * 60 * 1000;
    const check = async () => {
      try {
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (data.posterUrl) {
          setPosters((prev) => ({ ...prev, [messageId]: { waiting: false, url: data.posterUrl } }));
          return;
        }
        if (!res.ok || (!data.generating && !data.posterUrl)) {
          setPosters((prev) => ({ ...prev, [messageId]: { waiting: false } }));
          setInterviewActionErrors((prev) => ({ ...prev, [messageId]: data.error ?? "The poster didn't finish. Try again from the poster page." }));
          return;
        }
      } catch {
        // A blip while polling: the next check tries again.
      }
      if (Date.now() < deadline) setTimeout(check, 4000);
      else setPosters((prev) => ({ ...prev, [messageId]: { waiting: false } }));
    };
    setTimeout(check, 4000);
  }

  async function resolvePostingEdit(messageId: string, action: Extract<AssistantAction, { type: "posting_edit" }>, confirm: boolean) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "posting_edit", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const res = await fetch(`/api/employer/job-postings/${action.postingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update that posting.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      saveSimpleActionResolution(messageId, "posting_edit", "done");
      router.refresh();
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function resolveInterviewProgress(messageId: string, action: Extract<AssistantAction, { type: "interview_progress" }>, confirm: boolean) {
    if (!confirm) {
      saveSimpleActionResolution(messageId, "interview_progress", "cancelled");
      return;
    }
    setInterviewActionBusyId(messageId);
    try {
      const body = action.kind === "start_evaluation" ? { status: "evaluation" } : { status: "interview", interviewResponseStatus: action.kind };
      const res = await fetch(`/api/employer/applications/${action.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update this applicant.");
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: "" }));
      showStages({ [action.applicationId]: action.kind === "start_evaluation" ? "evaluation" : "interviewed" });
      saveSimpleActionResolution(messageId, "interview_progress", "done");
    } catch (err) {
      setInterviewActionErrors((prev) => ({ ...prev, [messageId]: err instanceof Error ? err.message : "Couldn't reach the server." }));
    } finally {
      setInterviewActionBusyId(null);
    }
  }

  async function openHistory() {
    setView("history");
    setHistoryError(null);
    try {
      const res = await fetch("/api/assistant/conversations");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your chats.");
      setConversations(data.conversations);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Couldn't load your chats.");
    }
  }

  async function openConversation(id: string) {
    if (id === conversationId) {
      setView("chat");
      return;
    }
    requestRef.current?.abort();
    setThinking(false);
    cancelEditing();
    setLoadingChat(true);
    setView("chat");
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't open that chat.");
      setConversationId(id);
      setMessages(data.messages);
    } catch (err) {
      setMessages([{ id: newId(), role: "error", text: err instanceof Error ? err.message : "Couldn't open that chat." }]);
      setConversationId(null);
    } finally {
      setLoadingChat(false);
    }
  }

  async function removeConversation(id: string) {
    setConversations((prev) => prev?.filter((c) => c.id !== id) ?? null);
    if (id === conversationId) {
      setConversationId(null);
      setMessages([]);
      cancelEditing();
    }
    await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: await blobToDataUri(blob) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      const transcript = (data.transcript as string) ?? "";
      const combined = (inputValueRef.current ? `${inputValueRef.current} ${transcript}` : transcript).trim();
      if (combined) sendMessage(combined);
      else setVoiceError("Didn't catch anything — try again.");
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleMicClick() {
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (transcribing || thinking) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        stream.getTracks().forEach((track) => track.stop());
        throw err;
      }
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setTranscribing(true);
        toWavBlob(new Blob(audioChunksRef.current, { type: recorder.mimeType }))
          .then(transcribe)
          .catch(() => {
            setTranscribing(false);
            setVoiceError("Couldn't process that recording.");
          });
      };
      mediaRecorderRef.current = recorder;
      setVoiceError(null);
      setListening(true);
      recorder.start();
    } catch {
      setVoiceError("Couldn't access the microphone.");
    }
  }

  // An edit belongs to the chat it was started in.
  function cancelEditing() {
    if (!editing) return;
    setEditing(null);
    setInput("");
  }

  function handleNewChat() {
    requestRef.current?.abort();
    setThinking(false);
    cancelEditing();
    setMessages([]);
    setConversationId(null);
    setView("chat");
    inputRef.current?.focus();
  }

  function handleCollapse() {
    setOpen(false);
    setFocused(false);
    setView("chat");
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setFocused(false);
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const showSuggestions = focused && messages.length === 0 && !thinking;
  const headerButton =
    "flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#9AA3B2] transition-colors hover:bg-black/[0.05] hover:text-[#141B2E] disabled:opacity-40 disabled:hover:bg-transparent";
  const chipButton =
    "w-fit rounded-full border border-brand-teal/40 bg-[#F0FCFD] px-[12px] py-[5px] text-[11px] text-brand-teal-dark transition-colors hover:bg-brand-teal-soft";
  // Chat mode has room for bigger text; the floating panel stays compact.
  const text = full ? "text-sm leading-[21px]" : "text-xs leading-[19px]";
  const bubble = `px-[12px] py-[8px] ${text}`;
  // Chat mode's column is wide (768px, like ChatGPT) for cards and profiles,
  // but text stays at a comfortable reading width (~75 characters a line).
  const readingWidth = full ? "max-w-[min(85%,560px)]" : "max-w-[85%]";
  const replyBackground = full ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "bg-[#F1F4F8]";

  const historyList = historyError ? (
    <p className="px-[8px] py-[10px] text-xs text-red-500">{historyError}</p>
  ) : conversations === null ? (
    <p className="px-[8px] py-[10px] text-xs text-[#9AA3B2]">Loading your chats…</p>
  ) : conversations.length === 0 ? (
    <p className="px-[8px] py-[10px] text-xs text-[#9AA3B2]">No saved chats yet — start one and it&rsquo;ll show up here.</p>
  ) : (
    conversations.map((c) => (
      <div
        key={c.id}
        className={`group flex items-center gap-[6px] rounded-[10px] pr-[4px] transition-colors hover:bg-[#F1F4F8] ${
          c.id === conversationId ? "bg-[#F1F4F8]" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => openConversation(c.id)}
          className="flex min-w-0 flex-1 flex-col items-start gap-[2px] px-[10px] py-[8px] text-left"
        >
          <span className="w-full truncate text-xs text-[#141B2E]">{c.title}</span>
          <span className="text-[10px] text-[#9AA3B2]">{relativeTime(c.updatedAt)}</span>
        </button>
        <button
          type="button"
          onClick={() => removeConversation(c.id)}
          aria-label={`Delete chat "${c.title}"`}
          title="Delete chat"
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] opacity-0 transition hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
        >
          <TrashIcon className="h-[12px] w-[12px]" />
        </button>
      </div>
    ))
  );

  // An applicant's full profile: in the conversation under its card in Chat
  // mode ("panel"), or the pop-up window (profileWindow, below).
  const renderProfile = (applicationId: string, variant: "panel" | "modal") =>
    viewer ? (
      <ApplicantModalHost
        key={`${applicationId}:${versions[applicationId] ?? 0}`}
        applicationId={applicationId}
        viewer={viewer}
        variant={variant}
        onClose={() => closeProfile(applicationId)}
        onChange={(applicant, fit) =>
          setSummaries((prev) => ({ ...prev, [applicant.application.id]: summarize(applicant, fit) }))
        }
      />
    ) : null;

  // This applicant's full profile is open under their card in this message.
  const openHere = (applicationId: string, messageId: string) =>
    openIds.includes(applicationId) && openInChat(applicationId) && cardMessageFor[applicationId] === messageId;

  // Several people in one reply: slim cards side by side (scrolling sideways
  // past three), with the open one's full profile underneath.
  const applicantRow = (people: { applicationId: string; name: string }[], messageId: string) => {
    const open = people.find((p) => openHere(p.applicationId, messageId));
    return (
      <>
        <CardRow people={people}>
          {people.map((p) => (
            <ChatApplicantCard
              key={p.applicationId}
              compact
              name={p.name}
              summary={summaries[p.applicationId]}
              error={summaryErrors[p.applicationId]}
              onNeed={() => needSummary(p.applicationId)}
              active={open?.applicationId === p.applicationId}
              onOpen={() => openProfile(p.applicationId)}
              onHide={() => closeProfile(p.applicationId)}
            />
          ))}
        </CardRow>
        {open && (
          <div
            id={`chat-profile-${open.applicationId}`}
            className="animate-fade-in-up flex h-[min(640px,72vh)] w-full scroll-mt-[16px]"
          >
            {renderProfile(open.applicationId, "panel")}
          </div>
        )}
      </>
    );
  };

  // One applicant's card in the conversation; open, it becomes their full profile.
  const applicantCard = (person: { applicationId: string; name: string }, messageId: string) => {
    const expanded = openHere(person.applicationId, messageId);
    return (
      <div key={person.applicationId} id={`chat-profile-${person.applicationId}`} className="w-full scroll-mt-[16px]">
        <ChatApplicantCard
          name={person.name}
          summary={summaries[person.applicationId]}
          error={summaryErrors[person.applicationId]}
          onNeed={() => needSummary(person.applicationId)}
          expanded={expanded}
          onOpen={() => openProfile(person.applicationId)}
        >
          {expanded ? renderProfile(person.applicationId, "panel") : null}
        </ChatApplicantCard>
      </div>
    );
  };

  const messageList = messages.map((m) => {
    if (m.role === "user") {
      return (
        <div key={m.id} className={`${readingWidth} flex flex-col items-end gap-[4px] self-end`}>
          <div className={`max-w-full whitespace-pre-wrap break-words rounded-[14px] rounded-br-[4px] bg-brand-ink text-white ${bubble}`}>
            {splitAttachments(m.text).files.map((name) => (
              <p key={name} className="mb-[4px] flex items-center gap-[6px] text-[11px] text-white/80 last:mb-0">
                <FileIcon className="h-[12px] w-[12px] shrink-0" />
                <span className="truncate">{name}</span>
              </p>
            ))}
            {splitAttachments(m.text).typed}
          </div>
          {canRedo && m.id === messages.findLast((x) => x.role === "user")?.id && (
            <button
              type="button"
              onClick={() => startEditing(m.text)}
              aria-label="Edit this message"
              className="flex items-center gap-[4px] rounded-full px-[6px] py-[2px] text-[10px] text-[#9AA3B2] hover:bg-black/[0.04] hover:text-[#141B2E]"
            >
              <PencilIcon className="h-[10px] w-[10px]" />
              Edit
            </button>
          )}
        </div>
      );
    }
    if (m.role === "error") {
      return (
        <div
          key={m.id}
          className={`flex max-w-[85%] items-center gap-[10px] self-start rounded-[14px] rounded-bl-[4px] border border-red-100 bg-red-50 text-red-600 ${bubble}`}
        >
          <span>{m.text}</span>
          {messages[messages.length - 2]?.role === "user" && (
            <button
              type="button"
              onClick={retry}
              disabled={thinking}
              className="shrink-0 rounded-full bg-white px-[10px] py-[3px] text-[11px] text-red-600 shadow-sm hover:bg-red-100 disabled:opacity-50"
            >
              Try again
            </button>
          )}
        </div>
      );
    }

    const action = m.action;
    // A reply holding an open profile takes the chat column's full width.
    const people =
      action?.type === "open_applicant" ? [action] : action?.type === "open_applicants" ? action.people : [];
    // So does a row of several people's cards.
    const hasTable = TABLE_ROW.test(m.text);
    const wide = people.length > 1 || people.some((p) => openHere(p.applicationId, m.id)) || (full && hasTable);
    return (
      <div key={m.id} className={`flex flex-col gap-[6px] self-start ${wide ? "w-full" : readingWidth}`}>
        <div className={`w-fit max-w-full break-words rounded-[14px] rounded-bl-[4px] text-[#141B2E] ${replyBackground} ${bubble} ${full && !hasTable ? "md:max-w-[560px]" : ""}`}>
          <FormattedReply text={m.text} />
        </div>

        <div className="flex items-center gap-[8px] px-[2px] text-[10px] text-[#9AA3B2]">
          <button
            type="button"
            onClick={() => copyReply(m.id, m.text)}
            aria-label="Copy reply"
            className="flex items-center gap-[4px] rounded-full px-[4px] py-[2px] hover:bg-black/[0.04] hover:text-[#141B2E]"
          >
            {copiedId === m.id ? (
              <>
                <CheckIcon className="h-[10px] w-[10px] text-[#2F7D4F]" />
                <span className="text-[#2F7D4F]">Copied</span>
              </>
            ) : (
              <CopyIcon className="h-[10px] w-[10px]" />
            )}
          </button>
          {canRedo && m.id === lastMessage?.id && (
            <button
              type="button"
              onClick={() => redo(messages.findLast((x) => x.role === "user")?.text ?? "")}
              aria-label="Regenerate this reply"
              className="flex items-center gap-[4px] rounded-full px-[4px] py-[2px] hover:bg-black/[0.04] hover:text-[#141B2E]"
            >
              <RefreshIcon className="h-[10px] w-[10px]" />
            </button>
          )}
          {m.stats && (
            <span>
              {m.stats.firstTokenMs !== undefined && <>TTFT: {formatDuration(m.stats.firstTokenMs)} · </>}
              Total time: {formatDuration(m.stats.durationMs)} · Input: {m.stats.promptTokens} tokens · Output: {m.stats.completionTokens} tokens
            </span>
          )}
        </div>

        {action?.type === "navigate" && (
          <button type="button" onClick={() => go(action.path)} className={chipButton}>
            {action.label} →
          </button>
        )}

        {action?.type === "export_applicants" && (
          <span className="flex flex-col gap-[4px]">
            <button
              type="button"
              disabled={exportingId === m.id}
              onClick={async () => {
                setExportingId(m.id);
                setExportError(null);
                const error = await downloadApplicantsExport({ filters: action.filters, title: action.title });
                setExportError(error ? { id: m.id, text: error } : null);
                setExportingId(null);
              }}
              className={`${chipButton} inline-flex items-center gap-[6px] disabled:opacity-50`}
            >
              <DownloadIcon className="h-[12px] w-[12px]" />
              {exportingId === m.id ? "Preparing file…" : action.label}
            </button>
            {exportError?.id === m.id && <span className="text-[11px] text-red-500">{exportError.text}</span>}
          </span>
        )}

        {viewer && people.length === 1 && applicantCard(people[0], m.id)}
        {viewer && people.length > 1 && applicantRow(people, m.id)}

        {action?.type === "change_stage" && (
          <StageChangeCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            moving={movingId === m.id}
            onAnswer={(confirm) => resolveStageChange(m.id, action, confirm)}
            onUndo={undoable[m.id] ? () => undoStageChange(m.id, action) : undefined}
            onOpenProfile={viewer ? openProfile : undefined}
          />
        )}

        {action?.type === "schedule_interview" && (
          <ScheduleInterviewCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveScheduleInterview(m.id, action, confirm)}
            onOpenProfile={viewer ? openProfile : undefined}
          />
        )}

        {action?.type === "cancel_interview" && (
          <CancelInterviewCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveCancelInterview(m.id, action, confirm)}
            onOpenProfile={viewer ? openProfile : undefined}
          />
        )}

        {action?.type === "record_evaluation" && (
          <RecordEvaluationCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveRecordEvaluation(m.id, action, confirm)}
            onOpenProfile={viewer ? openProfile : undefined}
          />
        )}

        {action?.type === "close_posting" && (
          <ClosePostingCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveClosePosting(m.id, action, confirm)}
          />
        )}

        {action?.type === "confirm_action" && (
          <ConfirmActionCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            posterUrl={posters[m.id]?.url}
            posterWaiting={!!posters[m.id]?.waiting}
            onAnswer={(confirm, file) => resolveConfirmAction(m.id, action, confirm, file)}
            onGo={go}
          />
        )}

        {action?.type === "posting_edit" && (
          <PostingEditCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolvePostingEdit(m.id, action, confirm)}
          />
        )}

        {action?.type === "interview_progress" && (
          <InterviewProgressCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveInterviewProgress(m.id, action, confirm)}
            onOpenProfile={viewer ? openProfile : undefined}
          />
        )}

        {action?.type === "team_change" && (
          <TeamChangeCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveTeamChange(m.id, action, confirm)}
          />
        )}

        {action?.type === "company_edit" && (
          <CompanyEditCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveCompanyEdit(m.id, action, confirm)}
          />
        )}

        {action?.type === "create_job_posting" && (
          <CreateJobPostingCard
            action={action}
            canAnswer={m.id === lastAssistantId}
            busy={interviewActionBusyId === m.id}
            error={interviewActionErrors[m.id] || null}
            onAnswer={(confirm) => resolveCreateJobPosting(m.id, action, confirm)}
            onGo={go}
          />
        )}
      </div>
    );
  });

  const thinkingDots = thinking &&
    (streamText ? (
      <div
        data-testid="thinking-indicator"
        className={`flex flex-col self-start ${full && TABLE_ROW.test(streamText) ? "w-full" : readingWidth}`}
        aria-live="off"
      >
        <div className={`w-fit max-w-full break-words rounded-[14px] rounded-bl-[4px] text-[#141B2E] ${replyBackground} ${bubble}`}>
          <FormattedReply text={streamText} />
        </div>
      </div>
    ) : (
      <div
        data-testid="thinking-indicator"
        className={`flex w-fit items-center gap-[4px] self-start rounded-[14px] rounded-bl-[4px] px-[14px] py-[10px] ${replyBackground}`}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] animate-bounce rounded-full bg-[#9AA3B2]"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
        {statusText && <span className="ml-[6px] text-[11px] text-[#9AA3B2]">{statusText}</span>}
      </div>
    ));

  // Same size in both layouts, so Chat mode feels like the bar it came from.
  const roundButton = "h-[30px] w-[30px]";
  const composer = (
    <>
    {(editing || attachment || attaching || attachError) && (
      <div className="mb-[6px] flex flex-col gap-[4px] px-[4px] text-[11px]">
        {editing && (
          <p className="flex items-center justify-between gap-[8px] text-[#4B5468]">
            Editing your last message
            <button
              type="button"
              onClick={cancelEditing}
              className="text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Cancel
            </button>
          </p>
        )}
        {attaching && <p className="text-[#9AA3B2]">Reading the file…</p>}
        {attachment && (
          <p className="flex min-w-0 items-center gap-[6px] rounded-[10px] bg-[#F1F4F8] px-[8px] py-[5px] text-[#141B2E]">
            <FileIcon className="h-[12px] w-[12px] shrink-0 text-brand-teal-dark" />
            <span className="min-w-0 flex-1 truncate">
              {attachment.name}
              {attachment.truncated && <span className="text-[#9AA3B2]"> · only the first part will be read</span>}
            </span>
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove file" className="shrink-0 text-[#9AA3B2] hover:text-[#141B2E]">
              <XIcon className="h-[10px] w-[10px]" />
            </button>
          </p>
        )}
        {attachError && <p className="text-red-500">{attachError}</p>}
      </div>
    )}
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendMessage(input);
      }}
      className={`flex min-h-[38px] min-w-0 items-end gap-[10px] px-[4px] ${
        !full && open ? "border-t border-black/[0.06] pt-[8px]" : "py-[4px]"
      }`}
    >
      <SiriOrb className="h-[30px] w-[30px]" active={input.trim().length > 0 || thinking} />
      {listening ? (
        <div className="flex min-w-0 flex-1 items-center gap-[3px]" role="status" aria-label="Listening">
          {[0.5, 0.85, 0.6, 1, 0.7, 0.4].map((delay, i) => (
            <span
              key={i}
              className="voice-wave-bar h-[16px] w-[3px] rounded-full bg-red-500"
              style={{ animationDelay: `${delay * 0.2}s` }}
            />
          ))}
          <span className="ml-[8px] text-xs text-[#9AA3B2]">Listening… tap the mic to stop</span>
        </div>
      ) : transcribing ? (
        <div className="flex min-w-0 flex-1 items-center gap-[4px]" role="status" aria-label="Transcribing">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[6px] w-[6px] animate-bounce rounded-full bg-[#9AA3B2]"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
          <span className="ml-[4px] text-xs text-[#9AA3B2]">Transcribing…</span>
        </div>
      ) : (
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter starts a new line (and Enter picks a word while typing in an IME).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder={messages.length > 0 ? "Reply…" : "Ask me anything..."}
          aria-label="Ask the AI assistant"
          maxLength={12000}
          className="min-h-[30px] min-w-0 flex-1 resize-none bg-transparent py-[5px] text-sm leading-[20px] text-[#141B2E] placeholder:text-[#9AA3B2] outline-none"
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) attachFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={attaching || thinking || !!editing}
        aria-label="Attach a file"
        title="Attach a PDF, Word or text file"
        className={`flex shrink-0 items-center justify-center rounded-full bg-[#F1F4F8] text-[#9AA3B2] transition-colors hover:bg-black/[0.08] hover:text-[#141B2E] disabled:opacity-40 ${roundButton}`}
      >
        <PaperclipIcon className="h-[14px] w-[14px]" />
      </button>
      <button
        type="button"
        onClick={handleMicClick}
        disabled={transcribing || thinking}
        aria-label={listening ? "Stop voice input" : "Use voice input"}
        aria-pressed={listening}
        className={`flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${roundButton} ${
          listening ? "bg-red-500 text-white" : "bg-[#F1F4F8] text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
        }`}
      >
        <MicIcon className="h-[14px] w-[14px]" />
      </button>
      {thinking ? (
        <button
          type="button"
          onClick={stopReply}
          aria-label="Stop"
          className={`flex shrink-0 items-center justify-center rounded-full bg-brand-ink text-white hover:opacity-85 ${roundButton}`}
        >
          <span className="h-[10px] w-[10px] rounded-[2px] bg-white" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim() && !attachment && !(editing && editing.prefix)}
          className={`flex shrink-0 items-center justify-center rounded-full bg-brand-ink text-white hover:opacity-85 disabled:opacity-40 ${roundButton}`}
        >
          <ArrowUp className="h-[13px] w-[13px]" />
        </button>
      )}
    </form>
    </>
  );

  // The same white, gold-sweep-edged card the floating bar uses.
  const sweepEdge = (
    <div className="absolute inset-0 overflow-hidden rounded-[26px]">
      <div
        aria-hidden
        className="gold-sweep absolute -inset-[75%]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, transparent 60deg, #FFE9A6 85deg, #ffffff 90deg, #FFE9A6 95deg, transparent 120deg, transparent 360deg)",
        }}
      />
    </div>
  );
  // Chat mode's composer: the floating bar's exact card and width.
  const composerCard = (
    <div className="relative mx-auto w-full max-w-[480px] min-w-0">
      {sweepEdge}
      <div className="relative m-px rounded-[25px] bg-white p-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.12)]">
        {composer}
      </div>
    </div>
  );

  // Under the message box in both layouts, in the same spot: the note, then
  // the Dashboard / Chat switch (employers).
  // One row under the box, as wide as it: the note on the left, the switch
  // on the right (the note alone sits centred).
  const footer = (
    <div
      className={`-mt-[4px] flex w-full max-w-[480px] flex-wrap items-center gap-[6px] px-[4px] ${
        modeSwitch ? "justify-between" : "justify-center"
      }`}
    >
      {/* On a soft frosted pill — on the dashboard it floats over whatever's beneath. */}
      <p className="rounded-full bg-white/80 px-[10px] py-[2px] text-[11px] text-[#9AA3B2] backdrop-blur-sm">
        AI can make mistakes
        {/* Shortened on phones so the switch still fits on the same row. */}
        <span className={modeSwitch ? "hidden sm:inline" : undefined}> — double-check key details</span>
      </p>
      {modeSwitch && <div className="pointer-events-auto">{modeSwitch}</div>}
    </div>
  );

  // As a pop-up it renders beside the chat, never inside it: both layouts
  // animate with transforms (which would trap a fixed window inside them),
  // and the floating bar's container lets clicks through.
  const profileWindow = popupId ? renderProfile(popupId, "modal") : null;

  if (full) {
    const firstName = greetingName?.trim().split(/\s+/)[0];
    const empty = messages.length === 0 && !loadingChat && !thinking;
    return (
      <>
      <div
        className={`relative flex min-h-0 flex-1 ${leaving ? "animate-mode-out" : "animate-mode-in"}`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && view === "history") setView("chat");
        }}
      >
        {/* A soft teal glow behind the conversation, Gemini-style. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(52% 58% at 52% 44%, rgba(7,188,202,0.17) 0%, rgba(7,188,202,0.07) 42%, rgba(7,188,202,0) 72%)",
          }}
        />

        {/* The rail runs down the left edge, full height; the chat fills the rest. */}
        {/* min-w-0: the phone-width pill row scrolls inside rather than widening the page. */}
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
        {rail?.({
          newChat: handleNewChat,
          pastChatsOpen: view === "history",
          togglePastChats: () => (view === "history" ? setView("chat") : openHistory()),
          canShowPastChats: saved,
        })}
        {/* 10px from the rail — the same gap as between the rail's own cards. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[16px] px-4 pt-[16px] xl:flex-row xl:gap-[24px] xl:pl-[10px] xl:pr-[24px]">

        {view === "history" && (
          <aside className="animate-fade-in-up flex max-h-[40vh] shrink-0 flex-col rounded-[14px] border border-[#EAEDF2] bg-white xl:mb-[16px] xl:max-h-none xl:w-[260px]">
            <div className="flex h-[56px] shrink-0 items-center justify-between px-[16px]">
              <div className="flex flex-col leading-none">
                <span className="text-sm text-[#141B2E]">Your chats</span>
                <span className="mt-[4px] text-[10px] text-[#9AA3B2]">Saved to your account for 90 days</span>
              </div>
              <button type="button" onClick={() => setView("chat")} aria-label="Hide past chats" title="Close" className={headerButton}>
                <XIcon className="h-[12px] w-[12px]" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[8px] pb-[12px]">{historyList}</div>
          </aside>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[10vh]">
              {/* Same type as the dashboard's page headings. */}
              <h2
                className="animate-fade-in-up text-center text-xl font-semibold text-[#141B2E]"
                style={{ lineHeight: 1.15, letterSpacing: "-0.02em", animationDelay: "80ms" }}
              >
                {firstName ? `Hi ${firstName}, where should we start?` : "Where should we start?"}
              </h2>
              <div className="animate-fade-in-up mt-[20px] w-full max-w-[480px]" style={{ animationDelay: "160ms" }}>
                {composerCard}
                {voiceError && <p className="mt-[8px] px-[12px] text-xs text-red-500">{voiceError}</p>}
              </div>
              <ul className="mt-[14px] flex w-full max-w-[480px] flex-col gap-[2px] px-[6px]">
                {SUGGESTIONS[audience].map((s, i) => {
                  const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
                  return (
                    <li key={s} className="animate-fade-in-up" style={{ animationDelay: `${240 + i * 60}ms` }}>
                      <button
                        type="button"
                        onClick={() => sendMessage(s)}
                        className="flex w-full items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] text-left text-sm text-[#141B2E] transition-colors hover:bg-white/70"
                      >
                        <Icon className="h-[14px] w-[14px] shrink-0 text-brand-teal-dark" />
                        {s}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {empty ? (
            // The note and switch stay at the bottom, same spot as mid-chat.
            <div className="flex flex-col items-center gap-[10px] px-4 pb-[12px] pt-[10px]">{footer}</div>
          ) : (
            <>
              <div ref={scrollRef} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-[768px] flex-col gap-[14px] px-4 py-[28px]">
                  {loadingChat ? <p className="self-center text-sm text-[#9AA3B2]">Opening chat…</p> : messageList}
                  {thinkingDots}
                </div>
              </div>
              {/* Same spacing and note as the floating bar, so switching modes doesn't shift it. */}
              <div className="mx-auto flex w-full max-w-[768px] flex-col items-center gap-[10px] px-4 pb-[12px] pt-[6px]">
                {composerCard}
                {voiceError && <p className="px-[12px] text-xs text-red-500">{voiceError}</p>}
                {footer}
              </div>
            </>
          )}
        </div>

        </div>
        </div>
      </div>
      {profileWindow}
      </>
    );
  }

  return (
    <>
    <div
      id="assistant-floating-bar"
      className={`pointer-events-none fixed inset-x-0 bottom-[12px] z-30 flex flex-col items-center gap-[10px] px-4 ${
        leaving ? "animate-mode-out" : entering ? "animate-mode-in" : ""
      }`}
    >
      <div
        ref={containerRef}
        onFocus={() => {
          setFocused(true);
          if (messages.length > 0) setOpen(true);
        }}
        onBlur={handleContainerBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleCollapse();
        }}
        className="pointer-events-auto relative w-full max-w-[480px] min-w-0"
      >
        {sweepEdge}

        <div className="relative m-px flex flex-col gap-[10px] overflow-hidden rounded-[25px] bg-white p-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.12)]">
          {open && (
            <div className="flex flex-col">
              <div className="flex h-[40px] shrink-0 items-center justify-between px-[4px]">
                <div className="flex min-w-0 items-center gap-[8px]">
                  <SiriOrb className="h-[20px] w-[20px] shrink-0" active={thinking} />
                  <div className="flex min-w-0 flex-col leading-none">
                    <span className="text-xs text-[#141B2E]">{view === "history" ? "Your chats" : "JobGiga Assistant"}</span>
                    {/* The chat's "AI can make mistakes" line sits under the bar instead. */}
                    {view === "history" && (
                      <span className="mt-[3px] truncate text-[10px] text-[#9AA3B2]">Saved to your account for 90 days</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-[2px]">
                  {saved && (
                    <button
                      type="button"
                      onClick={() => (view === "history" ? setView("chat") : openHistory())}
                      aria-label={view === "history" ? "Back to chat" : "Show past chats"}
                      aria-pressed={view === "history"}
                      title={view === "history" ? "Back to chat" : "Past chats"}
                      className={`${headerButton} ${view === "history" ? "bg-black/[0.05] text-[#141B2E]" : ""}`}
                    >
                      <ClockIcon className="h-[14px] w-[14px]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNewChat}
                    disabled={messages.length === 0 && view === "chat"}
                    aria-label="Start a new chat"
                    title="New chat"
                    className={headerButton}
                  >
                    <PlusIcon className="h-[13px] w-[13px]" />
                  </button>
                  <button type="button" onClick={handleCollapse} aria-label="Minimize chat" title="Minimize" className={headerButton}>
                    <XIcon className="h-[12px] w-[12px]" />
                  </button>
                </div>
              </div>

              {view === "history" ? (
                <div className="flex max-h-[min(420px,55vh)] min-h-[140px] flex-col gap-[2px] overflow-y-auto border-t border-black/[0.06] px-[2px] py-[8px]">
                  {historyList}
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  aria-live="polite"
                  className="flex max-h-[min(420px,55vh)] min-h-[140px] flex-col gap-[10px] overflow-y-auto border-t border-black/[0.06] px-[4px] py-[14px]"
                >
                  {loadingChat && <p className="self-center text-xs text-[#9AA3B2]">Opening chat…</p>}

                  {!loadingChat && messages.length === 0 && !thinking && (
                    <div className="flex flex-col gap-[8px] self-start">
                      <p className="text-xs text-[#4B5468]">Hi! Ask me anything, or try one of these:</p>
                      <div className="flex flex-wrap gap-[6px]">
                        {SUGGESTIONS[audience].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => sendMessage(s)}
                            className="rounded-full border border-black/[0.08] px-[12px] py-[6px] text-xs text-[#141B2E] transition-colors hover:bg-black/[0.03]"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!loadingChat && messageList}

                  {thinkingDots}
                </div>
              )}
            </div>
          )}

          {showSuggestions && !open && (
            <div className="flex flex-wrap gap-[8px] px-[4px]">
              {SUGGESTIONS[audience].slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-black/[0.08] px-[14px] py-[8px] text-sm leading-[16px] text-[#141B2E] transition-colors hover:bg-black/[0.03]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {composer}

          {voiceError && <p className="px-[8px] text-xs text-red-500">{voiceError}</p>}
        </div>
      </div>
      {footer}
    </div>
    {profileWindow}
    </>
  );
}

export type AssistantAction =
  | { type: "navigate"; path: string; label: string; openNow: boolean }
  // A proposed posting close: nothing happens until the user presses Confirm.
  | ({ type: "close_posting" } & ClosePostingRequest)
  // A proposed new job posting, AI-drafted: nothing is created until Confirm.
  | ({ type: "create_job_posting" } & DraftJobPostingRequest)
  // A find_applicants search's filters; the button downloads that list as Excel (no AI).
  | { type: "export_applicants"; label: string; filters: Record<string, unknown>; title?: string }
  // An applicant's profile card (and full profile) in the chat.
  | { type: "open_applicant"; applicationId: string; name: string; posting: string }
  // Several at once — a card each.
  | { type: "open_applicants"; people: { applicationId: string; name: string; posting: string }[] }
  // A proposed stage move: nothing changes until the user presses Confirm,
  // which runs each move through the same API the dashboard uses.
  | {
      type: "change_stage";
      to: string;
      toLabel: string;
      items: StageChangeItem[];
      skipped: { name: string; reason: string }[];
      // Worth knowing before confirming: over-filling a job, an offer being taken back.
      notes?: string[];
      resolution?: StageChangeResolution;
      // Per application id: "ok", or why that one move failed.
      results?: Record<string, string>;
    }
  // A proposed interview schedule/reschedule: nothing happens (and the
  // candidate isn't notified) until the user presses Confirm.
  | ({ type: "schedule_interview" } & ScheduleInterviewRequest)
  // A proposed interview cancellation.
  | ({ type: "cancel_interview" } & CancelInterviewRequest)
  // The caller's own interview scorecard, staged for Confirm.
  | ({ type: "record_evaluation" } & RecordEvaluationRequest)
  // A change to the team (invite, role, removal, resent invite, a Hiring
  // manager's jobs), staged for Confirm.
  | ({ type: "team_change" } & TeamChangeRequest)
  // Edits to the company's details, staged for Confirm.
  | ({ type: "company_edit" } & CompanyEditRequest)
  // Edits to a job posting, staged for Confirm.
  | ({ type: "posting_edit" } & PostingEditRequest)
  // Attendance, or starting the evaluation, staged for Confirm.
  | ({ type: "interview_progress" } & InterviewProgressRequest)
  // Any other action: a summary, then one real API request on Confirm.
  | ({ type: "confirm_action" } & ConfirmActionRequest);

// fromStatus is what Undo moves them back to (cards saved before it existed have none).
export type StageChangeItem = { applicationId: string; name: string; posting: string; fromLabel: string; fromStatus?: string };
// "undone": confirmed, then taken back with Undo.
export type StageChangeResolution = "done" | "cancelled" | "undone";

// "done": Confirm went through. "cancelled": the user pressed Cancel. No
// Undo for these three — see FloatingAssistant.tsx for why.
export type SimpleActionResolution = "done" | "cancelled";

export type ScheduleInterviewRequest = {
  applicationId: string;
  name: string;
  posting: string;
  round: number;
  mode: "onsite" | "online" | "phone";
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingLink: string | null;
  interviewerUserIds: string[];
  interviewerNames: string[];
  notes: string | null;
  isReschedule: boolean;
  resolution?: SimpleActionResolution;
};

export type CancelInterviewRequest = {
  applicationId: string;
  name: string;
  posting: string;
  scheduledAt: string;
  toStatus: string;
  toLabel: string;
  resolution?: SimpleActionResolution;
};

export type RecordEvaluationRequest = {
  applicationId: string;
  name: string;
  posting: string;
  round: number;
  scores: Partial<Record<string, number>>;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  notes: string | null;
  resolution?: SimpleActionResolution;
};

// "done": the posting closed. "cancelled": the user pressed Cancel.
export type ClosePostingRequest = {
  postingId: string;
  title: string;
  resolution?: SimpleActionResolution;
};

export type DraftJobPostingRequest = {
  title: string;
  description: string | null;
  responsibilities: string | null;
  industry: string | null;
  employmentType: string;
  workArrangement: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  resolution?: SimpleActionResolution;
  // Set once Confirm succeeds — the saved draft's id and page, for a "review it" link.
  postingId?: string;
};

export type TeamChangeRequest = {
  kind: "invite" | "role" | "remove" | "resend" | "jobs";
  // Null for an invite: they aren't on the team yet.
  memberId: string | null;
  // Their name, or email if they haven't joined.
  memberLabel: string;
  email: string;
  role: string | null;
  roleLabel: string | null;
  fromRoleLabel: string | null;
  position: string | null;
  // The jobs a Hiring manager ends up with.
  jobPostingIds: string[];
  jobTitles: string[];
  // A side effect worth reading before confirming.
  warning: string | null;
  resolution?: SimpleActionResolution;
};

export type CompanyEditRequest = {
  // What's sent on Confirm, as PATCH /api/employer/profile takes it.
  values: Record<string, unknown>;
  // What the card shows.
  changes: { label: string; from: string; to: string }[];
  warning?: string | null;
  resolution?: SimpleActionResolution;
};

export type ConfirmActionRequest = {
  title: string;
  lines: { label: string; value: string }[];
  warning: string | null;
  // Red Confirm button, for what can't be undone.
  destructive?: boolean;
  request: { method: "POST" | "PATCH" | "PUT" | "DELETE"; url: string; body: Record<string, unknown> | null };
  // A file picked on the card, sent with the request.
  file?: {
    label: string;
    accept: string;
    required: boolean;
    field: string;
    // multipart: a form with the file. dataUrl: inlined into the JSON body.
    // upload: sent to `uploadUrl` first, then its returned url goes in the body.
    send: "multipart" | "dataUrl" | "upload";
    uploadUrl?: string;
    uploadFields?: Record<string, string>;
  };
  doneText: string;
  // Polled after Confirm until it reports `posterUrl`, shown on the card.
  pollPosterUrl?: string;
  // A page to carry on from once it's done.
  link?: { path: string; label: string };
  // The whole page belongs to the old state (switching company).
  reloadAfter?: boolean;
  resolution?: SimpleActionResolution;
};

export type PostingEditRequest = {
  postingId: string;
  title: string;
  // What's sent on Confirm, as PATCH /api/employer/job-postings/[id] takes it.
  values: Record<string, unknown>;
  changes: { label: string; from: string; to: string }[];
  resolution?: SimpleActionResolution;
};

export type InterviewProgressRequest = {
  applicationId: string;
  name: string;
  posting: string;
  kind: "attended" | "no_show" | "start_evaluation";
  resolution?: SimpleActionResolution;
};

// How long the reply took and what it cost — real numbers from the request
// that produced it, shown as a small footnote under the reply. firstTokenMs:
// until its first word appeared (replies saved before streaming have none).
export type AssistantMessageStats = { durationMs: number; promptTokens: number; completionTokens: number; firstTokenMs?: number };

// The single-card actions answered once, with Confirm or Cancel. (A stage
// change is the other confirmation card: it also keeps each person's result.)
export const SIMPLE_ACTION_TYPES = [
  "schedule_interview",
  "cancel_interview",
  "record_evaluation",
  "close_posting",
  "create_job_posting",
  "team_change",
  "company_edit",
  "posting_edit",
  "interview_progress",
  "confirm_action",
] as const satisfies readonly AssistantAction["type"][];
export type SimpleActionType = (typeof SIMPLE_ACTION_TYPES)[number];

// A file sent with a message travels in its text, wrapped like this.
const ATTACHMENT = /<attachment name="([^"]*)">[\s\S]*?<\/attachment>\s*/g;

/** A user message split into what they typed and the names of any files with it. */
export function splitAttachments(text: string): { typed: string; files: string[] } {
  return { typed: text.replace(ATTACHMENT, "").trim(), files: [...text.matchAll(ATTACHMENT)].map((m) => m[1]) };
}

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: AssistantAction | null;
  stats?: AssistantMessageStats | null;
};

export type AssistantConversationSummary = { id: string; title: string; updatedAt: string };

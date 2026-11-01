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
  | ({ type: "record_evaluation" } & RecordEvaluationRequest);

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

// How long the reply took and what it cost — real numbers from the request
// that produced it, shown as a small footnote under the reply.
export type AssistantMessageStats = { durationMs: number; promptTokens: number; completionTokens: number };

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: AssistantAction | null;
  stats?: AssistantMessageStats | null;
};

export type AssistantConversationSummary = { id: string; title: string; updatedAt: string };

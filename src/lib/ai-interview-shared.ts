// AI interview — constants and shapes shared by the server and both sides'
// screens, so it has no server-only imports. It is its own feature (not the
// video pitch): employers send 5 job-knowledge questions to a shortlisted
// applicant, who records short answers; AI transcribes and scores them
// against the key points the employer approved.

export const AI_INTERVIEW_QUESTION_COUNT = 5;
export const AI_INTERVIEW_ANSWER_SECONDS = [30, 60] as const;
export const AI_INTERVIEW_DEFAULT_ANSWER_SECONDS = 30;
export const AI_INTERVIEW_DEADLINE_DAYS = [3, 5, 7] as const;
export const AI_INTERVIEW_DEFAULT_DEADLINE_DAYS = 3;
// A first take plus two re-records.
export const AI_INTERVIEW_MAX_ATTEMPTS = 3;
export const AI_INTERVIEW_MAX_KEY_POINTS = 5;
export const AI_INTERVIEW_MAX_QUESTION_LENGTH = 300;
export const AI_INTERVIEW_MAX_KEY_POINT_LENGTH = 200;
// Recordings are deleted this long after the interview is scored (the
// transcripts, scores and report stay).
export const AI_INTERVIEW_RETENTION_DAYS = 30;
// Largest single recording we accept, before transcoding.
export const AI_INTERVIEW_MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export const AI_INTERVIEW_STATUSES = [
  "invited",
  "in_progress",
  "processing",
  "completed",
  "failed",
  "expired",
  "cancelled",
] as const;
export type AiInterviewStatus = (typeof AI_INTERVIEW_STATUSES)[number];

export const AI_INTERVIEW_STATUS_LABEL: Record<AiInterviewStatus, string> = {
  invited: "Invited",
  in_progress: "In progress",
  processing: "Analysing answers",
  completed: "Report ready",
  failed: "Analysis failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export type AiInterviewLevel = "strong" | "partial" | "weak";
export type AiInterviewRecommendation = "interview" | "maybe" | "pass";

export const AI_INTERVIEW_LEVEL_LABEL: Record<AiInterviewLevel, string> = {
  strong: "Strong job knowledge",
  partial: "Partial job knowledge",
  weak: "Weak job knowledge",
};
export const AI_INTERVIEW_RECOMMENDATION_LABEL: Record<AiInterviewRecommendation, string> = {
  interview: "Worth interviewing",
  maybe: "Maybe",
  pass: "Pass for now",
};

// The overall result — advice for the employer, never a decision.
export type AiInterviewReport = {
  level: AiInterviewLevel;
  recommendation: AiInterviewRecommendation;
  // Average of the five answer scores, 1 to 5 (one decimal).
  averageScore: number;
  summary: string;
  gaps: string[];
  // Questions worth asking in the live interview, aimed at what was missing.
  followUps: string[];
  // Which AI model scored it (one model scores every candidate; a fallback is noted here).
  model?: string;
};

// One answer's result, judged against that question's key points.
export type AiInterviewAnswerEvaluation = {
  score: number;
  covered: string[];
  missed: string[];
  // A short verbatim line from the transcript that backs the score.
  quote: string | null;
  summary: string;
};

export type AiInterviewDraftQuestion = { question: string; keyPoints: string[] };

export const AI_INTERVIEW_PRACTICE_QUESTION = "Practice: tell us your name and which job you applied for.";

// What the employer sees about one question and its answer.
export type EmployerAiInterviewQuestion = {
  id: string;
  position: number;
  question: string;
  keyPoints: string[];
  answered: boolean;
  mediaKind: "video" | "audio" | null;
  durationSeconds: number | null;
  hasRecording: boolean;
  transcript: string | null;
  score: number | null;
  evaluation: AiInterviewAnswerEvaluation | null;
};

export type EmployerAiInterview = {
  id: string;
  applicationId: string;
  status: AiInterviewStatus;
  answerSeconds: number;
  deadlineAt: string;
  inviteSentAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  recordingsExpireAt: string | null;
  recordingsDeleted: boolean;
  failureReason: string | null;
  report: AiInterviewReport | null;
  questions: EmployerAiInterviewQuestion[];
};

// What the jobseeker sees — never the key points or anyone's scores.
export type JobseekerAiInterviewQuestion = {
  id: string;
  position: number;
  question: string;
  answered: boolean;
  attemptsLeft: number;
};

export type JobseekerAiInterview = {
  id: string;
  status: AiInterviewStatus;
  answerSeconds: number;
  deadlineAt: string;
  consented: boolean;
  jobTitle: string;
  companyName: string;
  questions: JobseekerAiInterviewQuestion[];
};

// Resume Review — the shape of one review, shared by the server (which builds
// and stores it, see resume-review.ts) and the page that shows it.

/** Reviews a jobseeker can run per rolling 24 hours. */
export const RESUME_REVIEW_DAILY_LIMIT = 3;

export const REVIEW_SCORE_KEYS = ["clarity", "impact", "skills", "ats", "completeness"] as const;
export type ReviewScoreKey = (typeof REVIEW_SCORE_KEYS)[number];

export const REVIEW_SCORE_LABEL: Record<ReviewScoreKey, string> = {
  clarity: "Clear & well organised",
  impact: "Shows your impact",
  skills: "Skills & keywords",
  ats: "Easy for hiring software to read",
  completeness: "Complete details",
};

export type ReviewImprovement = {
  priority: "high" | "medium" | "low";
  /** Which part of the resume, e.g. "Work experience". */
  section: string;
  /** The exact line it's about — checked against the resume, or null for something missing. */
  quote: string | null;
  issue: string;
  suggestion: string;
};

/** A quick yes/no check worked out without the AI (page count, contact details…). */
export type ReviewCheck = { key: string; label: string; ok: boolean; detail: string };

export type ResumeReviewResult = {
  version: 1;
  /** 0–100, the average of `scores`. */
  overall: number;
  summary: string;
  scores: { key: ReviewScoreKey; score: number; note: string }[];
  strengths: { title: string; detail: string }[];
  improvements: ReviewImprovement[];
  checks: ReviewCheck[];
  /** Skills live JobGiga jobs that suit them ask for, which the resume doesn't mention. */
  skillGaps: { jobsLookedAt: number; skills: { skill: string; jobs: number }[] };
  /** Where their JobGiga profile and their resume disagree. */
  profileNotes: string[];
};

/**
 * One colour per suggestion, matching its highlight on the resume — soft
 * fills that keep the text readable, with a stronger edge/number colour.
 */
export const HIGHLIGHT_COLORS = [
  { fill: "rgba(245, 180, 0, 0.30)", edge: "#C99A1E" },
  { fill: "rgba(47, 128, 237, 0.22)", edge: "#2F80ED" },
  { fill: "rgba(124, 92, 209, 0.22)", edge: "#7C5CD1" },
  { fill: "rgba(47, 158, 86, 0.22)", edge: "#2F9E56" },
  { fill: "rgba(229, 72, 77, 0.20)", edge: "#E5484D" },
  { fill: "rgba(0, 137, 144, 0.22)", edge: "#008990" },
] as const;

export const highlightColor = (index: number) => HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];

/** A friendly word for the overall score. */
export function scoreBand(score: number): { label: string; tone: "great" | "good" | "work" } {
  if (score >= 80) return { label: "Looking strong", tone: "great" };
  if (score >= 60) return { label: "A good start", tone: "good" };
  return { label: "Worth some polishing", tone: "work" };
}

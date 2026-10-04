// Matches interview_evaluations exactly. Fixed criteria set (not
// employer-customizable yet) so scores stay comparable across every
// candidate and every employer without a criteria-management screen.
export const EVALUATION_CRITERIA = [
  "communication",
  "technicalSkill",
  "problemSolving",
  "cultureFit",
  "roleKnowledge",
] as const;

export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export const EVALUATION_CRITERION_LABEL: Record<EvaluationCriterion, string> = {
  communication: "Communication",
  technicalSkill: "Technical skill",
  problemSolving: "Problem solving",
  cultureFit: "Culture fit",
  roleKnowledge: "Role knowledge",
};

export type InterviewRecommendation = "strong_hire" | "hire" | "no_hire" | "strong_no_hire";

export const RECOMMENDATION_LABEL: Record<InterviewRecommendation, string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  no_hire: "No hire",
  strong_no_hire: "Strong no hire",
};

export const RECOMMENDATION_COLOR: Record<InterviewRecommendation, { bg: string; text: string }> = {
  strong_hire: { bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" },
  hire: { bg: "bg-[#E6F9FA]", text: "text-[#008990]" },
  no_hire: { bg: "bg-[#FFEFE3]", text: "text-[#C2600A]" },
  strong_no_hire: { bg: "bg-red-50", text: "text-red-500" },
};

export type InterviewEvaluation = {
  round: number;
  scores: Partial<Record<EvaluationCriterion, number>>;
  recommendation: InterviewRecommendation;
  notes: string | null;
};

export function averageScore(scores: Partial<Record<EvaluationCriterion, number>>): number | null {
  const values = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// One interviewer's own scorecard on a panel. `evaluatorUserId` is null only
// for a scorecard saved before per-interviewer evaluations existed.
export type PanelEvaluation = InterviewEvaluation & {
  evaluatorUserId: string | null;
  evaluatorName: string | null;
};

const RECOMMENDATION_RANK: Record<InterviewRecommendation, number> = {
  strong_no_hire: 1,
  no_hire: 2,
  hire: 3,
  strong_hire: 4,
};
const RECOMMENDATION_BY_RANK: InterviewRecommendation[] = ["strong_no_hire", "no_hire", "hire", "strong_hire"];

/**
 * The panel's combined result, in the same single-scorecard shape lists and
 * badges already render: each criterion averaged across everyone who scored
 * it (to one decimal), and the recommendation from the average rank.
 */
export function summarizeEvaluations(evaluations: PanelEvaluation[]): InterviewEvaluation | null {
  if (evaluations.length === 0) return null;
  if (evaluations.length === 1) {
    const [only] = evaluations;
    return { round: only.round, scores: only.scores, recommendation: only.recommendation, notes: only.notes };
  }
  const scores: Partial<Record<EvaluationCriterion, number>> = {};
  for (const criterion of EVALUATION_CRITERIA) {
    const values = evaluations
      .map((e) => e.scores[criterion])
      .filter((v): v is number => typeof v === "number");
    if (values.length > 0) {
      scores[criterion] = Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
    }
  }
  const meanRank =
    evaluations.reduce((sum, e) => sum + RECOMMENDATION_RANK[e.recommendation], 0) / evaluations.length;
  return {
    round: evaluations[0].round,
    scores,
    recommendation: RECOMMENDATION_BY_RANK[Math.min(3, Math.max(0, Math.round(meanRank) - 1))],
    notes: null,
  };
}

/**
 * Whether every required panelist has a scorecard for the current round.
 * An interview with no account-linked panel (scheduled before panel
 * evaluations existed) is complete as soon as anyone has scored it — the
 * old one-scorecard behavior.
 */
export function isPanelEvaluationComplete(
  interviewerUserIds: string[] | undefined,
  evaluations: PanelEvaluation[],
): boolean {
  if (!interviewerUserIds || interviewerUserIds.length === 0) return evaluations.length > 0;
  const submitted = new Set(evaluations.map((e) => e.evaluatorUserId));
  return interviewerUserIds.every((id) => submitted.has(id));
}

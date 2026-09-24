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

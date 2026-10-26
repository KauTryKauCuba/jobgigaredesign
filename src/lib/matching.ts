import "server-only";
import { formatLanguageRequirement, sameLanguage } from "@/lib/languages";
import { canonicalizeSkill } from "@/lib/skills-taxonomy";
import { isScorableQuestion, questionType, type CustomAnswer, type CustomQuestion } from "@/lib/screening-questions";

// Scoring weights per FLOW.md §6.2/§0.5 — tuned empirically, see
// POST_JOB_GAPS.md line ~158. Each component is 0..1 or null when it doesn't
// apply to a given posting/candidate pair (e.g. posting has no minimum years
// requirement). weightedScore() renormalizes across whatever components are
// actually available, so a posting missing a signal still produces a
// meaningful 0-100 score from its other components.
export const MATCH_WEIGHTS = {
  skills: 0.35,
  softSkills: 0.1,
  experience: 0.15,
  niceToHaveSkills: 0.1,
  industry: 0.1,
  workArrangement: 0.1,
  employmentType: 0.1,
} as const;

export type MatchComponent = keyof typeof MATCH_WEIGHTS;
export type MatchBreakdown = Record<MatchComponent, number | null>;

// Mirrors employerProfiles.smartMatchCriteria (src/lib/db/schema.ts) — lets an
// employer turn individual criteria off. The 6 MatchComponent keys gate
// weightedScore(); the 2 hard-filter keys gate hardFilterCheck().
export type CriteriaFlags = Record<MatchComponent | "workAuthorization" | "drivingLicense", boolean>;

export const DEFAULT_CRITERIA: CriteriaFlags = {
  skills: true,
  softSkills: true,
  experience: true,
  niceToHaveSkills: true,
  industry: true,
  workArrangement: true,
  employmentType: true,
  workAuthorization: true,
  drivingLicense: true,
};

// Existing rows saved before a criterion was added to the schema default
// won't have that key in their stored jsonb — merge onto the full default
// rather than trusting the stored object alone.
export function withCriteriaDefaults(stored: Partial<CriteriaFlags> | null | undefined): CriteriaFlags {
  return { ...DEFAULT_CRITERIA, ...(stored ?? {}) };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

// Required skills are a hard filter conceptually, but here they still
// contribute proportionally (a candidate with 3/4 required skills is a
// closer match than one with 0/4) rather than being an all-or-nothing gate —
// the actual gate is workAuthorization/drivingLicense, handled separately.
//
// Skills are freeform tags (not a fixed enum like industry), so exact string
// comparison would miss "React" vs "React.js" vs "ReactJS" and silently
// undercount genuine matches. canonicalizeSkill() resolves known variant
// spellings to one id (and normalizes punctuation/casing for anything not in
// the alias table) before comparing — see src/lib/skills-taxonomy.ts.
export function skillsOverlapScore(required: string[], have: string[]): number | null {
  if (required.length === 0) return null;
  const haveSet = new Set(have.map(canonicalizeSkill));
  const matched = required.filter((skill) => haveSet.has(canonicalizeSkill(skill))).length;
  return matched / required.length;
}

export function experienceFitScore(minYearsRequired: number | null, candidateYears: number): number | null {
  if (!minYearsRequired || minYearsRequired <= 0) return null;
  return Math.min(candidateYears / minYearsRequired, 1);
}

export function industryMatchScore(postingIndustry: string | null, candidateIndustry: string): number | null {
  if (!postingIndustry) return null;
  return normalize(postingIndustry) === normalize(candidateIndustry) ? 1 : 0;
}

export function workArrangementMatchScore(postingArrangement: string, candidateArrangement: string): number {
  return postingArrangement === candidateArrangement ? 1 : 0;
}

export function employmentTypeMatchScore(postingType: string, candidateType: string): number {
  return normalize(postingType) === normalize(candidateType) ? 1 : 0;
}

export function hardFilterCheck(params: {
  requiredWorkAuthorizations: string[];
  candidateWorkAuthorization: string;
  requiredDrivingLicense: string | null;
  candidateDrivingLicense: string | null;
  enabledWorkAuthorization?: boolean;
  enabledDrivingLicense?: boolean;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (
    params.enabledWorkAuthorization !== false &&
    params.requiredWorkAuthorizations.length > 0 &&
    !params.requiredWorkAuthorizations.includes(params.candidateWorkAuthorization)
  ) {
    reasons.push("Work authorization doesn't match what this posting accepts");
  }
  if (
    params.enabledDrivingLicense !== false &&
    params.requiredDrivingLicense &&
    params.candidateDrivingLicense !== params.requiredDrivingLicense
  ) {
    reasons.push("Doesn't hold the required driving license");
  }
  return { eligible: reasons.length === 0, reasons };
}

// Mirrors QUALIFICATION_TIERS in EmployerJobsView.tsx / LANGUAGE_LEVELS in
// the same file — lowest to highest, so a candidate's tier/level only needs
// to rank at or above the posting's requirement, not match it exactly.
const QUALIFICATION_TIER_RANK: Record<string, number> = {
  SPM: 0,
  STPM: 1,
  Diploma: 2,
  Degree: 3,
  Master: 4,
  PhD: 5,
  Other: 0,
};
const LANGUAGE_LEVEL_RANK: Record<string, number> = {
  basic: 0,
  conversational: 1,
  fluent: 2,
  native: 3,
};

// Apply-time screening: unlike hardFilterCheck (derived from whatever the
// jobseeker's profile already says), this checks the answers a jobseeker
// gave when applying against exactly the requirements the employer set on
// the posting — only requirements that are actually set are checked, so a
// posting with just a minimum-experience requirement doesn't fail someone
// over an education tier the employer never asked about.
export function screeningEligibilityCheck(
  requirements: {
    minYearsExperience: number | null;
    minQualificationTier: string | null;
    drivingLicense: string | null;
    languages: { language: string; dialect?: string | null; level: string }[];
    workAuthorizations: string[];
    customQuestions: CustomQuestion[];
    // Built-in requirements marked "Preferred" — scored, never gating.
    preferred?: string[];
  },
  answers: {
    yearsExperience: number | null;
    qualificationTier: string | null;
    drivingLicense: string | null;
    languages: { language: string; dialect?: string | null; level: string }[];
    workAuthorization: string | null;
    customAnswers: CustomAnswer[];
  },
): { eligible: boolean; reasons: string[]; preferredMet: number; preferredTotal: number } {
  // A Preferred requirement that's missed doesn't count against eligibility;
  // it only lowers how many preferred ones the applicant met. `preferredTotal`
  // counts only requirements that can actually be checked.
  const reasons: string[] = [];
  let preferredMet = 0;
  let preferredTotal = 0;
  const preferredKeys = new Set(requirements.preferred ?? []);
  const record = (key: string | null, preferred: boolean, failures: string[]) => {
    if (preferred || (key !== null && preferredKeys.has(key))) {
      preferredTotal += 1;
      if (failures.length === 0) preferredMet += 1;
      return;
    }
    reasons.push(...failures);
  };

  if (requirements.minYearsExperience !== null) {
    const failures =
      answers.yearsExperience === null || answers.yearsExperience < requirements.minYearsExperience
        ? [`Doesn't meet the minimum ${requirements.minYearsExperience} years of experience`]
        : [];
    record("yearsExperience", false, failures);
  }

  if (requirements.minQualificationTier) {
    const requiredRank = QUALIFICATION_TIER_RANK[requirements.minQualificationTier] ?? 0;
    const answerRank = answers.qualificationTier ? (QUALIFICATION_TIER_RANK[answers.qualificationTier] ?? -1) : -1;
    record(
      "qualificationTier",
      false,
      answerRank < requiredRank ? [`Doesn't meet the minimum education level (${requirements.minQualificationTier})`] : [],
    );
  }

  // Work authorization / driving license: shared with hardFilterCheck (the
  // profile-derived gate) rather than a second hand-maintained copy, so a
  // fix to either check's logic or wording can't silently diverge between
  // apply-time screening and live matching.
  if (requirements.workAuthorizations.length > 0) {
    record(
      "workAuthorization",
      false,
      hardFilterCheck({
        requiredWorkAuthorizations: requirements.workAuthorizations,
        candidateWorkAuthorization: answers.workAuthorization ?? "",
        requiredDrivingLicense: null,
        candidateDrivingLicense: null,
      }).reasons,
    );
  }
  if (requirements.drivingLicense) {
    record(
      "drivingLicense",
      false,
      hardFilterCheck({
        requiredWorkAuthorizations: [],
        candidateWorkAuthorization: "",
        requiredDrivingLicense: requirements.drivingLicense,
        candidateDrivingLicense: answers.drivingLicense,
      }).reasons,
    );
  }

  // All the language requirements count as one: met only if every one is.
  const languageFailures: string[] = [];
  for (const required of requirements.languages) {
    const requiredRank = LANGUAGE_LEVEL_RANK[required.level] ?? 0;
    // Each answer is the applicant's level for that exact requirement — the
    // language by meaning, not spelling ("BM" answers "Malay"), and the same
    // dialect ("any dialect" answers have none).
    const answer = answers.languages.find(
      (l) =>
        sameLanguage(l.language, required.language) &&
        (l.dialect ?? "").toLowerCase() === (required.dialect ?? "").toLowerCase(),
    );
    const answerRank = answer ? (LANGUAGE_LEVEL_RANK[answer.level] ?? -1) : -1;
    if (answerRank < requiredRank) {
      languageFailures.push(
        `Doesn't meet the required ${formatLanguageRequirement(required.language, required.dialect)} level (${required.level})`,
      );
    }
  }
  if (requirements.languages.length > 0) record("languages", false, languageFailures);

  for (const question of requirements.customQuestions) {
    // Short answers (and choice/number questions with nothing to check
    // against) are read by the employer — they never pass or fail anyone.
    if (!isScorableQuestion(question)) continue;
    const answer = answers.customAnswers.find((a) => a.questionId === question.id);
    let met: boolean;
    switch (questionType(question)) {
      case "choice":
        met = !!answer?.choice && (question.acceptedOptions ?? []).includes(answer.choice);
        break;
      case "number":
        met = typeof answer?.number === "number" && answer.number >= (question.minNumber ?? 0);
        break;
      default:
        met = !!answer && answer.answer === question.requiredAnswer;
    }
    record(null, question.preferred === true, met ? [] : [`"${question.question}" doesn't match what this posting requires`]);
  }

  return { eligible: reasons.length === 0, reasons, preferredMet, preferredTotal };
}

// A small boost for the preferred requirements an applicant met: up to
// +PREFERRED_MAX_BONUS points when they met all of them, capped at 100.
export const PREFERRED_MAX_BONUS = 10;
export function withPreferredBonus(score: number, met: number | null, total: number | null): number {
  if (!met || !total) return score;
  return Math.min(100, score + Math.round((PREFERRED_MAX_BONUS * met) / total));
}

// Renormalizes across whichever components have a real (non-null) value, so
// a posting missing a signal (e.g. no minimum years requirement) isn't
// unfairly penalized relative to one that has every signal available. A
// component the employer has switched off via CriteriaFlags is excluded the
// same way a null value is, regardless of whether it actually computed one.
export function weightedScore(breakdown: MatchBreakdown, enabled?: Partial<CriteriaFlags>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as MatchComponent[]) {
    if (enabled?.[key] === false) continue;
    const value = breakdown[key];
    if (value === null) continue;
    const weight = MATCH_WEIGHTS[key];
    weightedSum += weight * value;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

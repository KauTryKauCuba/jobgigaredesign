import "server-only";

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
export function skillsOverlapScore(required: string[], have: string[]): number | null {
  if (required.length === 0) return null;
  const haveSet = new Set(have.map(normalize));
  const matched = required.filter((skill) => haveSet.has(normalize(skill))).length;
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

// Shared request-body validators/constants for job-posting screening
// fields — used by the employer job-postings create/update routes and the
// jobseeker apply route, which all read/write the same shapes
// (languages/customScreeningQuestions/skillSuggestions) and previously kept
// three hand-maintained copies that could silently drift apart.
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
export const WORK_AUTHORIZATIONS = ["citizen", "permanent_resident", "work_pass_holder", "needs_sponsorship"] as const;
export const DRIVING_LICENSES = ["b2", "b", "d", "da", "e"] as const;
export const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

export function isOptionalInt(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isInteger(value));
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export type LanguageReq = { language: string; level: (typeof LANGUAGE_LEVELS)[number] };

export function isLanguageArray(value: unknown): value is LanguageReq[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === "object" &&
        isNonEmptyString((v as Record<string, unknown>).language) &&
        (LANGUAGE_LEVELS as readonly string[]).includes((v as Record<string, unknown>).level as string),
    )
  );
}

export type CustomQuestion = { id: string; question: string; requiredAnswer: boolean };

export function isCustomQuestionArray(value: unknown): value is CustomQuestion[] {
  return (
    Array.isArray(value) &&
    value.every((v) => {
      if (!v || typeof v !== "object") return false;
      const q = v as Record<string, unknown>;
      return isNonEmptyString(q.id) && isNonEmptyString(q.question) && typeof q.requiredAnswer === "boolean";
    })
  );
}

export type SkillSuggestions = { professionalSkills: string[]; softSkills: string[]; niceToHaveSkills: string[] };

export function isSkillSuggestions(value: unknown): value is SkillSuggestions | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isStringArray(v.professionalSkills) && isStringArray(v.softSkills) && isStringArray(v.niceToHaveSkills);
}

// Shared request-body validators/constants for job-posting screening
// fields — used by the employer job-postings create/update routes and the
// jobseeker apply route, which all read/write the same shapes
// (languages/customScreeningQuestions/skillSuggestions) and previously kept
// three hand-maintained copies that could silently drift apart.
import {
  MAX_CHOICE_OPTIONS,
  PREFERRABLE_REQUIREMENTS,
  SCREENING_QUESTION_TYPES,
  type CustomQuestion,
  type PreferrableRequirement,
} from "./screening-questions";

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "freelance", "temporary"] as const;
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

// A language, ONE dialect or null/omitted for "any dialect", and a level.
export type LanguageReq = { language: string; dialect?: string | null; level: (typeof LANGUAGE_LEVELS)[number] };

export function isLanguageArray(value: unknown): value is LanguageReq[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === "object" &&
        isNonEmptyString((v as Record<string, unknown>).language) &&
        isOptionalString((v as Record<string, unknown>).dialect) &&
        (LANGUAGE_LEVELS as readonly string[]).includes((v as Record<string, unknown>).level as string),
    )
  );
}

export type { CustomQuestion };

export function isCustomQuestionArray(value: unknown): value is CustomQuestion[] {
  return (
    Array.isArray(value) &&
    value.every((v) => {
      if (!v || typeof v !== "object") return false;
      const q = v as Record<string, unknown>;
      if (!isNonEmptyString(q.id) || !isNonEmptyString(q.question) || typeof q.requiredAnswer !== "boolean") return false;
      if (q.preferred !== undefined && typeof q.preferred !== "boolean") return false;
      if (q.type !== undefined && !(SCREENING_QUESTION_TYPES as readonly unknown[]).includes(q.type)) return false;
      if (q.type === "choice") {
        // 2–8 distinct options; accepted ones must be among them.
        if (!isStringArray(q.options) || q.options.length < 2 || q.options.length > MAX_CHOICE_OPTIONS) return false;
        if (!q.options.every((o) => o.trim().length > 0) || new Set(q.options).size !== q.options.length) return false;
        if (q.acceptedOptions !== undefined) {
          if (!isStringArray(q.acceptedOptions) || !q.acceptedOptions.every((o) => (q.options as string[]).includes(o))) {
            return false;
          }
        }
      }
      if (q.type === "number") {
        if (q.minNumber !== undefined && q.minNumber !== null && !(typeof q.minNumber === "number" && Number.isFinite(q.minNumber))) {
          return false;
        }
      }
      return true;
    })
  );
}

// Which built-in requirements are marked Preferred — only known keys.
export function isPreferredKeys(value: unknown): value is PreferrableRequirement[] {
  return isStringArray(value) && value.every((k) => (PREFERRABLE_REQUIREMENTS as readonly string[]).includes(k));
}

export type SkillSuggestions = { professionalSkills: string[]; softSkills: string[]; niceToHaveSkills: string[] };

export function isSkillSuggestions(value: unknown): value is SkillSuggestions | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isStringArray(v.professionalSkills) && isStringArray(v.softSkills) && isStringArray(v.niceToHaveSkills);
}

// What a company's workplace is like, beyond the basics: office & team
// photos, facilities, dress code, awards and leadership. Shared by the
// company profile form, /api/employer/profile and "Fill with AI".

export const FACILITIES = [
  "Prayer room (surau)",
  "Pantry",
  "Free meals or snacks",
  "Cafeteria",
  "Nursing room",
  "Gym",
  "Shower room",
  "Parking",
  "Near public transport",
  "Childcare",
  "Rest or games area",
  "Wheelchair access",
] as const;
// A facility is one of FACILITIES above or one the company wrote itself
// (up to MAX_CUSTOM_FACILITIES, each up to FACILITY_MAX characters).
export type Facility = string;
export const MAX_CUSTOM_FACILITIES = 5;
export const FACILITY_MAX = 40;

export function isKnownFacility(facility: string) {
  return (FACILITIES as readonly string[]).includes(facility);
}

/** Trimmed, with runs of spaces collapsed; the standard spelling when it matches a listed one in any letter case. */
export function normalizeFacility(raw: string) {
  const value = raw.replace(/\s+/g, " ").trim();
  return FACILITIES.find((known) => known.toLowerCase() === value.toLowerCase()) ?? value;
}

/** Why this text can't be a facility, or null if it can. */
export function facilityProblem(value: string): string | null {
  if (!value) return "Type a facility first.";
  if (value.length > FACILITY_MAX) return `Keep it to ${FACILITY_MAX} characters or fewer.`;
  if (/[\u0000-\u001f<>]/.test(value)) return "Use letters, numbers and normal punctuation only.";
  return null;
}

/** Checks and cleans a saved facilities list: no repeats (any letter case), and at most MAX_CUSTOM_FACILITIES of the company's own. */
export function parseFacilities(input: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Invalid facilities." };
  const cleaned: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return { ok: false, error: "Invalid facilities." };
    const value = normalizeFacility(item);
    const problem = facilityProblem(value);
    if (problem) return { ok: false, error: `Invalid facility “${item.slice(0, 20)}” — ${problem}` };
    if (!cleaned.some((c) => c.toLowerCase() === value.toLowerCase())) cleaned.push(value);
  }
  if (cleaned.filter((f) => !isKnownFacility(f)).length > MAX_CUSTOM_FACILITIES) {
    return { ok: false, error: `Add up to ${MAX_CUSTOM_FACILITIES} facilities of your own.` };
  }
  return { ok: true, value: cleaned };
}

export const DRESS_CODES = ["Casual", "Smart casual", "Business formal", "Uniform provided"] as const;
export type DressCode = (typeof DRESS_CODES)[number];

export const MAX_GALLERY_PHOTOS = 6;
export const MAX_AWARDS = 8;
export const MAX_LEADERS = 4;
export const AWARD_TITLE_MAX = 120;
export const LEADER_FIELD_MAX = 80;

export type Award = { title: string; year: number | null };
export type Leader = { name: string; title: string; photoUrl: string | null };

// Files uploaded through /api/employer/uploads — only these are accepted
// back on save, so a profile can't point at anything else.
export const GALLERY_PHOTO_URL = /^\/uploads\/gallery\/[\w-]+\.webp$/;
export const LEADER_PHOTO_URL = /^\/uploads\/leaders\/[\w-]+\.webp$/;

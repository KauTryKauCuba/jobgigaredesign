// Jobseekers give their age; it's kept as the year it implies (this year
// minus the age), so it stays right as the years go by without them updating
// it — and no full date of birth is ever stored. Client-safe.

export const MIN_AGE = 16;
export const MAX_AGE = 70;

const thisYear = () => new Date().getFullYear();

/** Age from a stored birth year (to within a year), or null. */
export function ageFromBirthYear(birthYear: number | null | undefined): number | null {
  return typeof birthYear === "number" && birthYear > 1900 ? thisYear() - birthYear : null;
}

export function birthYearFromAge(age: number): number {
  return thisYear() - age;
}

/** A typed age, as a whole number in range — or null. */
export function parseAge(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return null;
  const age = Number(text);
  return age >= MIN_AGE && age <= MAX_AGE ? age : null;
}

/** Age from a "YYYY-MM-DD" date (e.g. one read off a resume), or null. */
export function ageFromDate(date: string | null | undefined): number | null {
  const match = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!match) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(match[1]);
  const month = now.getMonth() + 1;
  if (month < Number(match[2]) || (month === Number(match[2]) && now.getDate() < Number(match[3]))) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// Option lists for job posting fields that are picked rather than typed —
// shared by the Post a job form, the server-side validation and the
// jobseeker-facing views. Pure, so client and server can both import it.

// The company profile's benefit suggestions (Company Profile page).
export const COMPANY_BENEFITS = [
  "Medical insurance",
  "Dental coverage",
  "Outpatient coverage",
  "Performance bonus",
  "Transport allowance",
  "Meal allowance",
  "Phone/internet allowance",
  "Flexible working hours",
  "Remote/hybrid work",
  "Extra annual leave",
  "Maternity/paternity leave",
  "Training & development",
  "Parking",
  "Life insurance",
  "Personal accident insurance",
  "Wellness/gym allowance",
  "Stock options (ESOS)",
  "Festive bonus",
  "Housing allowance",
  "Birthday leave",
  "Compassionate leave",
  "Marriage leave",
  "Study/education assistance",
  "Staff discount",
  "Team building/company trips",
] as const;

// For a job posting: Malaysia's statutory contributions first — jobseekers
// look for these to tell formal employment from gig/informal work.
export const POSTING_BENEFITS = ["EPF", "SOCSO", "EIS", ...COMPANY_BENEFITS] as const;

export const MAX_POSTING_BENEFITS = 30;

// How soon the hire needs to start. Same values as a jobseeker's notice
// period (jobseekerProfiles.noticePeriod) so the two can be compared, plus
// "flexible".
export const START_AVAILABILITY = [
  { value: "immediate", label: "Immediately" },
  { value: "one_week", label: "Within 1 week" },
  { value: "two_weeks", label: "Within 2 weeks" },
  { value: "one_month", label: "Within 1 month" },
  { value: "two_months", label: "Within 2 months" },
  { value: "flexible", label: "Flexible" },
] as const;

export type StartAvailability = (typeof START_AVAILABILITY)[number]["value"];

export function isStartAvailability(value: unknown): value is StartAvailability {
  return typeof value === "string" && START_AVAILABILITY.some((o) => o.value === value);
}

export function startAvailabilityLabel(value: string | null | undefined): string | null {
  return START_AVAILABILITY.find((o) => o.value === value)?.label ?? null;
}

// The location saved on a remote posting that has no office address.
export const REMOTE_LOCATION = "Remote";

// Hybrid postings: days a week in the office.
export const OFFICE_DAYS_OPTIONS = [1, 2, 3, 4] as const;

export function officeDaysLabel(days: number | null | undefined): string | null {
  if (!days) return null;
  return `${days} day${days === 1 ? "" : "s"} a week in the office`;
}

// What a posting's salary range is per. Monthly suits most full-time roles;
// the others are for part-time, shift, freelance and contract work.
export const SALARY_PERIODS = [
  { value: "month", label: "Monthly", unit: "month" },
  { value: "hour", label: "Hourly", unit: "hour" },
  { value: "day", label: "Daily", unit: "day" },
  { value: "project", label: "Per project", unit: "project" },
] as const;

export type SalaryPeriod = (typeof SALARY_PERIODS)[number]["value"];

export function isSalaryPeriod(value: unknown): value is SalaryPeriod {
  return typeof value === "string" && SALARY_PERIODS.some((o) => o.value === value);
}

function salaryUnit(period: string | null | undefined): string {
  return SALARY_PERIODS.find((o) => o.value === period)?.unit ?? "month";
}

/**
 * "RM3,000–4,500/month" (compact, for cards and lists) or
 * "RM 3,000 – RM 4,500 per month" (long, for a posting's own page). Either
 * end may be missing ("From …" / "Up to …"); null when neither is set.
 */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  period: string | null | undefined,
  style: "compact" | "long" = "compact",
): string | null {
  const unit = salaryUnit(period);
  const rm = (n: number) => n.toLocaleString("en-US");
  if (style === "long") {
    const suffix = ` per ${unit}`;
    if (min && max) return `RM ${rm(min)} – RM ${rm(max)}${suffix}`;
    if (min) return `From RM ${rm(min)}${suffix}`;
    if (max) return `Up to RM ${rm(max)}${suffix}`;
    return null;
  }
  const suffix = `/${unit}`;
  if (min && max) return `RM${rm(min)}–${rm(max)}${suffix}`;
  if (min) return `From RM${rm(min)}${suffix}`;
  if (max) return `Up to RM${rm(max)}${suffix}`;
  return null;
}

/**
 * Does a jobseeker's expected salary fit a posting's range? Jobseekers give
 * a monthly expectation, so only monthly postings are compared (null
 * otherwise, or when either side has no figures). "above" = they expect more
 * than the posting's top end; anything else overlaps or is under budget.
 */
export function salaryFit(
  expected: { min: number | null; max: number | null },
  posting: { min: number | null; max: number | null; period: string | null | undefined },
): "fits" | "above" | null {
  if ((posting.period ?? "month") !== "month") return null;
  if (!expected.min && !expected.max) return null;
  const top = posting.max || posting.min;
  if (!top) return null;
  return (expected.min || expected.max || 0) > top ? "above" : "fits";
}

/**
 * Where an entered range sits against a benchmark range: "below" when even
 * its top is under the benchmark's bottom, "above" when its bottom is over
 * the benchmark's top, otherwise "competitive". Null without both ranges.
 */
export function compareSalaryRange(
  entered: { min: number | null; max: number | null },
  benchmark: { min: number; max: number } | null,
): "below" | "competitive" | "above" | null {
  if (!benchmark) return null;
  const lo = entered.min || entered.max;
  const hi = entered.max || entered.min;
  if (!lo || !hi) return null;
  if (hi < benchmark.min) return "below";
  if (lo > benchmark.max) return "above";
  return "competitive";
}

// One-click fill-ins for the working hours field (still freely editable).
export const WORKING_HOURS_PRESETS = [
  "Mon–Fri, 9am–6pm",
  "Mon–Fri, 8:30am–5:30pm",
  "Mon–Sat, alternate Saturdays",
  "Rotating shifts, incl. weekends",
  "Weekends only",
  "Flexible hours",
] as const;

export const MAX_WORKING_HOURS_LENGTH = 120;

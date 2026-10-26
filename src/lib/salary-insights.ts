import "server-only";
import { and, eq, ilike, notLike } from "drizzle-orm";
import { db } from "./db";
import { jobseekerProfiles, users } from "./db/schema";
import { DUMMY_APPLICANT_EMAIL_DOMAIN } from "./dummy-applicants";

// Shared root of every generated-account email domain.
const FAKE_EMAIL_ROOT = DUMMY_APPLICANT_EMAIL_DOMAIN.split(".").slice(-2).join(".");

// Real data, not a guess: what jobseekers on JobGiga who'd fit a role say
// they expect to earn (their monthly expected salary from onboarding).

// Below this many profiles, a "typical" range would just be one or two
// people's numbers — not shown.
const MIN_PROFILES = 3;

// Words in a job title that say nothing about the role itself.
const FILLER_WORDS = new Set([
  "senior", "junior", "lead", "head", "chief", "assistant", "associate", "principal", "intern",
  "trainee", "executive", "officer", "staff", "the", "and", "for", "with", "part", "time", "full",
]);

export type SalaryInsight = {
  count: number;
  // Median of their expected minimums / maximums, rounded to RM100.
  typicalMin: number;
  typicalMax: number;
  // What the comparison group was, for the hint's wording.
  scope: "role" | "role_state" | "industry";
  state: string | null;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round100 = (n: number) => Math.round(n / 100) * 100;

function summarize(rows: { min: number; max: number }[], scope: SalaryInsight["scope"], state: string | null) {
  const valid = rows.filter((r) => r.min > 0 && r.max >= r.min);
  if (valid.length < MIN_PROFILES) return null;
  return {
    count: valid.length,
    typicalMin: round100(median(valid.map((r) => r.min))),
    typicalMax: round100(median(valid.map((r) => r.max))),
    scope,
    state,
  };
}

/**
 * Typical expected monthly salary of jobseekers targeting a similar role —
 * narrowed to the posting's state when there are enough of them there,
 * falling back to everyone in the same industry. Null when there isn't
 * enough data yet.
 */
export async function getSalaryInsight(params: {
  title: string;
  industry?: string | null;
  state?: string | null;
}): Promise<SalaryInsight | null> {
  const words = params.title
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length >= 3 && !FILLER_WORDS.has(w))
    .slice(0, 5);

  const columns = {
    min: jobseekerProfiles.expectedSalaryMin,
    max: jobseekerProfiles.expectedSalaryMax,
    state: jobseekerProfiles.state,
  };

  // Employers' "Get sample data" applicants (@dummy-applicant.jobgiga.test)
  // and the dev seed (@seed.jobgiga.test) are real jobseeker rows — never
  // count them as real expectations.
  const realJobseeker = notLike(users.email, `%.${FAKE_EMAIL_ROOT}`);

  if (words.length > 0) {
    // Every meaningful word of the title appears in their target role.
    const roleRows = await db
      .select(columns)
      .from(jobseekerProfiles)
      .innerJoin(users, eq(users.id, jobseekerProfiles.userId))
      .where(and(realJobseeker, ...words.map((w) => ilike(jobseekerProfiles.targetRole, `%${w}%`))))
      .limit(1000);
    const state = params.state?.trim() || null;
    if (state) {
      const inState = summarize(
        roleRows.filter((r) => r.state === state),
        "role_state",
        state,
      );
      if (inState) return inState;
    }
    const role = summarize(roleRows, "role", null);
    if (role) return role;
  }

  if (params.industry?.trim()) {
    const industryRows = await db
      .select(columns)
      .from(jobseekerProfiles)
      .innerJoin(users, eq(users.id, jobseekerProfiles.userId))
      .where(and(realJobseeker, eq(jobseekerProfiles.preferredIndustry, params.industry.trim())))
      .limit(1000);
    return summarize(industryRows, "industry", null);
  }
  return null;
}

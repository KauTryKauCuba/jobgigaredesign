import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db } from "./db";
import { employerTeamMembers, jobPostings, users } from "./db/schema";
import { DUMMY_APPLICANT_EMAIL_DOMAIN } from "./dummy-applicants";
import { DUMMY_POSTING_MARKER } from "./dummy-job-postings";
import { DUMMY_TEAM_EMAIL_DOMAIN } from "./dummy-team";

/**
 * Whether this company currently has any of My Profile's "Add sample data"
 * rows — found by the same markers each dummy-data route uses to find its own.
 */
export async function companyHasSampleData(employerProfileId: string) {
  const [[posting], [teammate], [applicant]] = await Promise.all([
    db
      .select({ id: jobPostings.id })
      .from(jobPostings)
      .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.postingName, DUMMY_POSTING_MARKER)))
      .limit(1),
    db
      .select({ id: employerTeamMembers.id })
      .from(employerTeamMembers)
      .where(
        and(
          eq(employerTeamMembers.employerProfileId, employerProfileId),
          like(employerTeamMembers.email, `%@${DUMMY_TEAM_EMAIL_DOMAIN}`),
        ),
      )
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, `%.${employerProfileId}@${DUMMY_APPLICANT_EMAIL_DOMAIN}`))
      .limit(1),
  ]);
  return !!(posting || teammate || applicant);
}

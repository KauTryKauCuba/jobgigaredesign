import "server-only";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, jobPostings, savedJobs } from "./db/schema";
import { stripCustomQuestionAnswers } from "./job-postings";

/** Posting ids this jobseeker has saved — for filling in heart buttons. */
export async function getSavedJobPostingIds(jobseekerProfileId: string): Promise<string[]> {
  const rows = await db
    .select({ jobPostingId: savedJobs.jobPostingId })
    .from(savedJobs)
    .where(eq(savedJobs.jobseekerProfileId, jobseekerProfileId));
  return rows.map((r) => r.jobPostingId);
}

/**
 * The Saved Jobs page — newest save first, including postings that have
 * since closed (the page marks those rather than dropping them).
 */
export async function getSavedJobs(jobseekerProfileId: string) {
  // `posting` omits `posterUrl` (can be large) — this list never shows a poster.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { posterUrl: _posterUrl, ...postingColumns } = getTableColumns(jobPostings);
  const rows = await db
    .select({
      savedAt: savedJobs.createdAt,
      posting: postingColumns,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(savedJobs)
    .innerJoin(jobPostings, eq(savedJobs.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(savedJobs.jobseekerProfileId, jobseekerProfileId))
    .orderBy(desc(savedJobs.createdAt));
  // This goes to the jobseeker's browser — never the screening questions'
  // required answers.
  return rows.map((row) => ({ ...row, posting: stripCustomQuestionAnswers(row.posting) }));
}

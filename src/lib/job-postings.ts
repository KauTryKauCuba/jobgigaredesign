import "server-only";
import { and, count, desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "./db";
import {
  employerProfiles,
  jobApplications,
  jobPostingReports,
  jobPostingStatusEnum,
  jobPostings,
  jobPostingViews,
  jobseekerProfiles,
} from "./db/schema";

// "Acme Corp — Frontend Engineer!" -> "acme-corp-frontend-engineer"
function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

// Pretty URL for a job posting's detail page — "company-job-title", with a
// "-2", "-3", ... suffix if that exact combination is already taken by
// another posting (e.g. two "Frontend Engineer" postings from the same
// company, or a duplicated posting).
export async function generateUniqueJobPostingSlug(companyName: string, title: string): Promise<string> {
  const base = slugify(`${companyName}-${title}`) || "job";
  const taken = new Set(
    (
      await db
        .select({ slug: jobPostings.slug })
        .from(jobPostings)
        .where(or(eq(jobPostings.slug, base), like(jobPostings.slug, `${base}-%`)))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function getJobPostingsForEmployer(employerProfileId: string) {
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.employerProfileId, employerProfileId))
    .orderBy(desc(jobPostings.createdAt));
}

// Manage Job's applicant counts — one query for every posting an employer
// has, rather than N+1 per row.
export async function getApplicantCounts(jobPostingIds: string[]): Promise<Record<string, number>> {
  if (jobPostingIds.length === 0) return {};
  const rows = await db
    .select({ jobPostingId: jobApplications.jobPostingId, value: count() })
    .from(jobApplications)
    .where(inArray(jobApplications.jobPostingId, jobPostingIds))
    .groupBy(jobApplications.jobPostingId);
  return Object.fromEntries(rows.map((r) => [r.jobPostingId, r.value]));
}

// Same shape as getApplicantCounts — one grouped query, unique viewers only
// (job_posting_views has one row per posting+jobseeker pair).
export async function getViewCounts(jobPostingIds: string[]): Promise<Record<string, number>> {
  if (jobPostingIds.length === 0) return {};
  const rows = await db
    .select({ jobPostingId: jobPostingViews.jobPostingId, value: count() })
    .from(jobPostingViews)
    .where(inArray(jobPostingViews.jobPostingId, jobPostingIds))
    .groupBy(jobPostingViews.jobPostingId);
  return Object.fromEntries(rows.map((r) => [r.jobPostingId, r.value]));
}

export async function getJobPostingForEmployer(employerProfileId: string, id: string) {
  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, employerProfileId)))
    .limit(1);
  return posting ?? null;
}

// For Manage Job's own posting page (/employer/jobs/[slug]) — same scoping
// as getJobPostingForEmployer above, just keyed by the pretty URL instead of
// the raw id.
export async function getJobPostingForEmployerBySlug(employerProfileId: string, slug: string) {
  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.slug, slug), eq(jobPostings.employerProfileId, employerProfileId)))
    .limit(1);
  return posting ?? null;
}

export type JobPosting = Awaited<ReturnType<typeof getJobPostingsForEmployer>>[number];

// For the superadmin review queue — every employer's postings in a given
// status, with just enough of the employer profile to identify who posted
// it. Also reused for the "flagged" tab, since flagging (whether directly by
// superadmin or after reviewing jobseeker reports — see
// getJobPostingReports below) is just another status.
export async function getJobPostingsByStatus(status: (typeof jobPostingStatusEnum.enumValues)[number]) {
  return db
    .select({
      posting: jobPostings,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobPostings.status, status))
    .orderBy(desc(jobPostings.createdAt));
}

export async function getJobPostingById(id: string) {
  const [posting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id)).limit(1);
  return posting ?? null;
}

// For the jobseeker-facing detail page (/jobseeker/jobs/[slug]) — only ever
// shown for active postings, so the query filters on status directly rather
// than trusting the caller to check it (same intent as
// getJobPostingForEmployer scoping to the employer's own postings).
export async function getActiveJobPostingBySlug(slug: string) {
  const [row] = await db
    .select({
      posting: jobPostings,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(and(eq(jobPostings.slug, slug), eq(jobPostings.status, "active")))
    .limit(1);
  return row ?? null;
}

// For the superadmin Reports queue — every jobseeker report, flat (one row
// per report, not grouped), newest first. The view groups these by posting
// client-side so a posting with several reports shows as one card with
// every reason listed, rather than superadmin scrolling through duplicates.
export async function getJobPostingReports() {
  return db
    .select({
      report: jobPostingReports,
      postingId: jobPostings.id,
      postingTitle: jobPostings.title,
      postingStatus: jobPostings.status,
      companyName: employerProfiles.companyName,
      reporterName: jobseekerProfiles.fullName,
    })
    .from(jobPostingReports)
    .innerJoin(jobPostings, eq(jobPostingReports.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .innerJoin(jobseekerProfiles, eq(jobPostingReports.jobseekerProfileId, jobseekerProfiles.id))
    .orderBy(desc(jobPostingReports.createdAt));
}

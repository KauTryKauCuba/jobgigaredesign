import "server-only";
import { randomUUID } from "crypto";
import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, jobAds, jobPostings } from "./db/schema";
import {
  AD_ENDING_SOON_DAYS,
  AD_SLOTS,
  addDays,
  adPhase,
  formatAdDate,
  formatAdRun,
  nextFreeStart,
  runEndDate,
  todayMY,
  type SlotBooking,
} from "./ad-slots";
import { notify } from "./notifications";
import { transcodeToMp4 } from "./video-pitch";

// Job posting advertisements: the same booking rules as company ads
// (src/lib/company-ads.ts — 10 slots, 30-day runs, 2 active bookings per
// company, superadmin review), with their own slots, shown above the
// jobseeker page's job search. Media lives in private storage and is served
// through /api/job-ads/[id]/media, public only once approved.
const JOB_AD_DIR = path.join(process.cwd(), "storage", "job-ads");

/** Where job ad notifications send the employer — the Advertisement page's job tab. */
export const JOB_ADS_PAGE = "/employer/advertisement?tab=job";

export function jobAdFilePath(fileName: string) {
  return path.join(JOB_AD_DIR, path.basename(fileName));
}

/** The file name is part of the URL so a replaced artwork never shows a cached old file. */
export function jobAdMediaUrl(ad: { id: string; fileName: string }) {
  return `/api/job-ads/${ad.id}/media?v=${encodeURIComponent(ad.fileName)}`;
}

/** Any image the browser sends → an upright WebP, at most 1200px on its longer side (shown square). */
export async function saveJobAdImage(bytes: Buffer): Promise<string> {
  const { default: sharp } = await import("sharp");
  const output = await sharp(bytes)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await mkdir(JOB_AD_DIR, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  await writeFile(jobAdFilePath(fileName), output);
  return fileName;
}

export function saveJobAdVideo(inputPath: string, maxSeconds: number) {
  return transcodeToMp4(inputPath, {
    outputDir: JOB_AD_DIR,
    maxSeconds,
    shortSide: 720,
    maxRate: "2M",
    tooLongError: `Your video is longer than ${maxSeconds} seconds — please trim it and try again.`,
    unreadableError: "That file doesn't look like a video we can read. Try an MP4 or MOV.",
    failedError: "We couldn't process that video. Try another file.",
  });
}

export async function deleteJobAdFile(fileName: string) {
  await rm(jobAdFilePath(fileName), { force: true });
}

/** A copy of an earlier booking's artwork for a new booking ("Book again"), so each booking owns its file. */
export async function copyJobAdFile(fileName: string): Promise<string> {
  const copy = `${randomUUID()}${path.extname(fileName)}`;
  await copyFile(jobAdFilePath(fileName), jobAdFilePath(copy));
  return copy;
}

/**
 * The artwork of every ad on these postings, to delete once the postings are
 * gone (the rows cascade, the files don't). Call it before deleting the
 * postings — it reads the rows — and run what it returns only after the
 * delete succeeded, so a failed delete never leaves ads without their files.
 */
export async function jobAdFileCleanupForPostings(jobPostingIds: string[]): Promise<() => Promise<void>> {
  if (jobPostingIds.length === 0) return async () => {};
  const rows = await db
    .select({ fileName: jobAds.fileName })
    .from(jobAds)
    .where(inArray(jobAds.jobPostingId, jobPostingIds));
  return async () => {
    await Promise.all(rows.map((r) => deleteJobAdFile(r.fileName)));
  };
}

const adWithJob = {
  id: jobAds.id,
  employerProfileId: jobAds.employerProfileId,
  jobPostingId: jobAds.jobPostingId,
  mediaType: jobAds.mediaType,
  fileName: jobAds.fileName,
  status: jobAds.status,
  rejectionReason: jobAds.rejectionReason,
  startDate: jobAds.startDate,
  endDate: jobAds.endDate,
  submittedAt: jobAds.submittedAt,
  reviewedAt: jobAds.reviewedAt,
  jobTitle: jobPostings.title,
  jobLocation: jobPostings.location,
  jobEmploymentType: jobPostings.employmentType,
  jobStatus: jobPostings.status,
  companyId: employerProfiles.id,
  companyName: employerProfiles.companyName,
  companyLogoUrl: employerProfiles.logoUrl,
  companyVerified: sql<boolean>`${employerProfiles.ssmVerificationStatus} = 'verified'`,
};

/**
 * Bookings holding a slot today or later: pending (held while reviewed) or
 * approved, not yet ended. Pass the transaction (`executor`) when reading
 * under the booking lock, so the read uses that transaction's connection.
 */
export async function getJobAdSlotBookings(
  today = todayMY(),
  executor: Pick<typeof db, "select"> = db,
): Promise<(SlotBooking & { employerProfileId: string })[]> {
  return executor
    .select({
      id: jobAds.id,
      employerProfileId: jobAds.employerProfileId,
      startDate: jobAds.startDate,
      endDate: jobAds.endDate,
    })
    .from(jobAds)
    .where(and(inArray(jobAds.status, ["pending", "approved"]), gt(jobAds.endDate, today)));
}

/** One company's job ad bookings: everything still active, plus its five most recent past ones. */
export async function getCompanyJobAdBookings(employerProfileId: string, today = todayMY()) {
  const rows = await db
    .select(adWithJob)
    .from(jobAds)
    .innerJoin(jobPostings, eq(jobPostings.id, jobAds.jobPostingId))
    .innerJoin(employerProfiles, eq(employerProfiles.id, jobAds.employerProfileId))
    .where(eq(jobAds.employerProfileId, employerProfileId))
    .orderBy(desc(jobAds.startDate));
  const withPhase = rows.map((r) => ({ ...r, phase: adPhase(r, today), mediaUrl: jobAdMediaUrl(r) }));
  const active = withPhase.filter((r) => r.phase !== "ended" && r.phase !== "rejected").reverse();
  const past = withPhase.filter((r) => r.phase === "ended" || r.phase === "rejected").slice(0, 5);
  return { active, past };
}

/** The company's live job postings — the ones a job ad can be booked for. */
export async function getAdvertisableJobPostings(employerProfileId: string) {
  return db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      location: jobPostings.location,
      employmentType: jobPostings.employmentType,
    })
    .from(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.status, "active")))
    .orderBy(desc(jobPostings.createdAt));
}

/** The jobseeker page's featured jobs: approved, running today, on a still-active posting, up to the slot count. */
export async function getLiveJobAds(today = todayMY()) {
  await syncJobAds(today);
  const rows = await db
    .select(adWithJob)
    .from(jobAds)
    .innerJoin(jobPostings, eq(jobPostings.id, jobAds.jobPostingId))
    .innerJoin(employerProfiles, eq(employerProfiles.id, jobAds.employerProfileId))
    .where(
      and(
        eq(jobAds.status, "approved"),
        lte(jobAds.startDate, today),
        gt(jobAds.endDate, today),
        eq(jobPostings.status, "active"),
      ),
    )
    .orderBy(asc(jobAds.startDate), asc(jobAds.reviewedAt))
    .limit(AD_SLOTS);
  return rows.map((r) => ({ ...r, mediaUrl: jobAdMediaUrl(r) }));
}

/** Every booking for the superadmin page, with what it is today. */
export async function getJobAdsForSuperadmin(today = todayMY()) {
  const rows = await db
    .select(adWithJob)
    .from(jobAds)
    .innerJoin(jobPostings, eq(jobPostings.id, jobAds.jobPostingId))
    .innerJoin(employerProfiles, eq(employerProfiles.id, jobAds.employerProfileId))
    .orderBy(asc(jobAds.startDate), asc(jobAds.submittedAt));
  return rows.map((r) => ({ ...r, phase: adPhase(r, today), mediaUrl: jobAdMediaUrl(r) }));
}

async function adRecipients(employerProfileId: string, submittedByUserId: string | null) {
  const [profile] = await db
    .select({ userId: employerProfiles.userId })
    .from(employerProfiles)
    .where(eq(employerProfiles.id, employerProfileId))
    .limit(1);
  return [profile?.userId, submittedByUserId];
}

async function jobTitleOf(jobPostingId: string) {
  const [row] = await db.select({ title: jobPostings.title }).from(jobPostings).where(eq(jobPostings.id, jobPostingId)).limit(1);
  return row?.title ?? "your job";
}

// Runs at most once a minute per server, like syncCompanyAds — any page that
// shows job ads calls this first.
let lastSyncAt = 0;

/**
 * Housekeeping for job ad bookings, done lazily (same as syncCompanyAds): an
 * unreviewed booking whose start date has arrived moves to the next free
 * date, and the "live", "ending soon" and "ended" notifications go out — each
 * claimed with a conditional update first, so it's sent exactly once.
 */
export async function syncJobAds(today = todayMY(), force = false) {
  if (!force && Date.now() - lastSyncAt < 60_000) return;
  lastSyncAt = Date.now();

  // Overdue = its whole start day went by unreviewed (a same-day booking
  // stays held for the superadmin all that day).
  const overdue = await db
    .select()
    .from(jobAds)
    .where(and(eq(jobAds.status, "pending"), lt(jobAds.startDate, today)));
  for (const ad of overdue) {
    const all = await getJobAdSlotBookings(today);
    const own = all.filter((b) => b.employerProfileId === ad.employerProfileId);
    const newStart = nextFreeStart(addDays(today, 1), addDays(today, 730), all, own, ad.id);
    if (!newStart) continue;
    const [moved] = await db
      .update(jobAds)
      .set({ startDate: newStart, endDate: runEndDate(newStart) })
      .where(and(eq(jobAds.id, ad.id), eq(jobAds.status, "pending"), eq(jobAds.startDate, ad.startDate)))
      .returning();
    if (moved) {
      await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
        type: "job_ad_moved",
        title: "Your job ad's start date moved",
        body: `It wasn't reviewed in time for ${formatAdDate(ad.startDate)}, so it now runs ${formatAdRun(newStart, moved.endDate)}.`,
        link: JOB_ADS_PAGE,
      });
    }
  }

  const live = await db
    .update(jobAds)
    .set({ liveNotifiedAt: new Date() })
    .where(
      and(eq(jobAds.status, "approved"), lte(jobAds.startDate, today), gt(jobAds.endDate, today), isNull(jobAds.liveNotifiedAt)),
    )
    .returning();
  for (const ad of live) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "job_ad_live",
      title: "Your job ad is live",
      body: `${await jobTitleOf(ad.jobPostingId)} is featured on the JobGiga jobs page until ${formatAdDate(addDays(ad.endDate, -1))}.`,
      link: JOB_ADS_PAGE,
    });
  }

  const ending = await db
    .update(jobAds)
    .set({ endingNotifiedAt: new Date() })
    .where(
      and(
        eq(jobAds.status, "approved"),
        lte(jobAds.startDate, today),
        gt(jobAds.endDate, today),
        lte(jobAds.endDate, addDays(today, AD_ENDING_SOON_DAYS)),
        isNull(jobAds.endingNotifiedAt),
      ),
    )
    .returning();
  for (const ad of ending) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "job_ad_ending",
      title: "Your job ad ends soon",
      body: `Its last day is ${formatAdDate(addDays(ad.endDate, -1))}. Book your next slot to keep it featured.`,
      link: JOB_ADS_PAGE,
    });
  }

  const ended = await db
    .update(jobAds)
    .set({ endedNotifiedAt: new Date() })
    .where(and(eq(jobAds.status, "approved"), lte(jobAds.endDate, today), isNull(jobAds.endedNotifiedAt)))
    .returning();
  for (const ad of ended) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "job_ad_ended",
      title: "Your job ad has ended",
      body: `${await jobTitleOf(ad.jobPostingId)} is no longer featured. You can book it again anytime.`,
      link: JOB_ADS_PAGE,
    });
  }
}

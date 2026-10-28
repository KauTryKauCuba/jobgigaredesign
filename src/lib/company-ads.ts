import "server-only";
import { randomUUID } from "crypto";
import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { companyAds, employerProfiles } from "./db/schema";
import {
  AD_ENDING_SOON_DAYS,
  AD_SLOTS,
  addDays,
  adPhase,
  formatAdDate,
  formatAdRun,
  lastBookableStart,
  nextFreeStart,
  runEndDate,
  todayMY,
  type SlotBooking,
} from "./ad-slots";
import { notify } from "./notifications";
import { transcodeToMp4 } from "./video-pitch";

// Private storage (the same `storage/` volume as video pitches and SSM
// documents) — files are only reachable through /api/company-ads/[id]/media,
// which shows an ad's media to the public only once it's approved.
const COMPANY_AD_DIR = path.join(process.cwd(), "storage", "company-ads");

export const AD_HEADLINE_MAX = 80;
export const AD_VIDEO_MAX_SECONDS = 30;
export const AD_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const AD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function companyAdFilePath(fileName: string) {
  return path.join(COMPANY_AD_DIR, path.basename(fileName));
}

/** The file name is part of the URL so a replaced ad never shows a cached old file. */
export function companyAdMediaUrl(ad: { id: string; fileName: string }) {
  return `/api/company-ads/${ad.id}/media?v=${encodeURIComponent(ad.fileName)}`;
}

/** Any image the browser sends (phone photos included) → an upright WebP, at most 1600px on its longer side. */
export async function saveCompanyAdImage(bytes: Buffer): Promise<string> {
  const { default: sharp } = await import("sharp");
  const output = await sharp(bytes)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await mkdir(COMPANY_AD_DIR, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  await writeFile(companyAdFilePath(fileName), output);
  return fileName;
}

export function saveCompanyAdVideo(inputPath: string) {
  return transcodeToMp4(inputPath, {
    outputDir: COMPANY_AD_DIR,
    maxSeconds: AD_VIDEO_MAX_SECONDS,
    shortSide: 720,
    maxRate: "2M",
    tooLongError: `Your video is longer than ${AD_VIDEO_MAX_SECONDS} seconds — please trim it and try again.`,
    unreadableError: "That file doesn't look like a video we can read. Try an MP4 or MOV.",
    failedError: "We couldn't process that video. Try another file.",
  });
}

export async function deleteCompanyAdFile(fileName: string) {
  await rm(companyAdFilePath(fileName), { force: true });
}

/** A copy of an earlier booking's media for a new booking ("Book again"), so each booking owns its file. */
export async function copyCompanyAdFile(fileName: string): Promise<string> {
  const copy = `${randomUUID()}${path.extname(fileName)}`;
  await copyFile(companyAdFilePath(fileName), companyAdFilePath(copy));
  return copy;
}

export type CompanyAd = typeof companyAds.$inferSelect;

const adWithCompany = {
  id: companyAds.id,
  employerProfileId: companyAds.employerProfileId,
  mediaType: companyAds.mediaType,
  fileName: companyAds.fileName,
  headline: companyAds.headline,
  status: companyAds.status,
  rejectionReason: companyAds.rejectionReason,
  startDate: companyAds.startDate,
  endDate: companyAds.endDate,
  submittedAt: companyAds.submittedAt,
  reviewedAt: companyAds.reviewedAt,
  companyId: employerProfiles.id,
  companyName: employerProfiles.companyName,
  companyLogoUrl: employerProfiles.logoUrl,
  companyIndustry: employerProfiles.industryCategory,
  companyVerified: sql<boolean>`${employerProfiles.ssmVerificationStatus} = 'verified'`,
};

/**
 * Bookings holding a slot today or later: pending (held while reviewed) or
 * approved, not yet ended. Pass the transaction (`executor`) when reading
 * under the booking lock, so the read uses that transaction's connection.
 */
export async function getSlotBookings(
  today = todayMY(),
  executor: Pick<typeof db, "select"> = db,
): Promise<(SlotBooking & { employerProfileId: string })[]> {
  return executor
    .select({
      id: companyAds.id,
      employerProfileId: companyAds.employerProfileId,
      startDate: companyAds.startDate,
      endDate: companyAds.endDate,
    })
    .from(companyAds)
    .where(and(inArray(companyAds.status, ["pending", "approved"]), gt(companyAds.endDate, today)));
}

/** Slot-holding ads per day, from today to the end of the last bookable run — for the booking calendar. */
export function dailySlotCounts(bookings: SlotBooking[], today: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const last = runEndDate(lastBookableStart(today));
  for (let day = today; day < last; day = addDays(day, 1)) counts[day] = 0;
  for (const b of bookings) {
    for (let day = b.startDate < today ? today : b.startDate; day < b.endDate && day < last; day = addDays(day, 1)) {
      counts[day] = (counts[day] ?? 0) + 1;
    }
  }
  return counts;
}

/** One company's bookings: everything still active, plus its five most recent past ones. */
export async function getCompanyAdBookings(employerProfileId: string, today = todayMY()) {
  const rows = await db
    .select()
    .from(companyAds)
    .where(eq(companyAds.employerProfileId, employerProfileId))
    .orderBy(desc(companyAds.startDate));
  const withPhase = rows.map((r) => ({ ...r, phase: adPhase(r, today), mediaUrl: companyAdMediaUrl(r) }));
  const active = withPhase.filter((r) => r.phase !== "ended" && r.phase !== "rejected").reverse();
  const past = withPhase.filter((r) => r.phase === "ended" || r.phase === "rejected").slice(0, 5);
  return { active, past };
}

/** The landing page's ads: approved and running today, up to the slot count. */
export async function getLiveCompanyAds(today = todayMY()) {
  await syncCompanyAds(today);
  return queryLiveCompanyAds(today);
}

/** getLiveCompanyAds without the housekeeping — for callers that run syncCompanyAds themselves. */
export async function queryLiveCompanyAds(today: string) {
  const rows = await db
    .select(adWithCompany)
    .from(companyAds)
    .innerJoin(employerProfiles, eq(employerProfiles.id, companyAds.employerProfileId))
    .where(and(eq(companyAds.status, "approved"), lte(companyAds.startDate, today), gt(companyAds.endDate, today)))
    .orderBy(asc(companyAds.startDate), asc(companyAds.reviewedAt))
    .limit(AD_SLOTS);
  return rows.map((r) => ({ ...r, mediaUrl: companyAdMediaUrl(r) }));
}

/** Every booking for the superadmin page, with what it is today. */
export async function getCompanyAdsForSuperadmin(today = todayMY()) {
  const rows = await db
    .select(adWithCompany)
    .from(companyAds)
    .innerJoin(employerProfiles, eq(employerProfiles.id, companyAds.employerProfileId))
    .orderBy(asc(companyAds.startDate), asc(companyAds.submittedAt));
  return rows.map((r) => ({ ...r, phase: adPhase(r, today), mediaUrl: companyAdMediaUrl(r) }));
}

export type CompanyAdWithCompany = Awaited<ReturnType<typeof getLiveCompanyAds>>[number];

async function adRecipients(employerProfileId: string, submittedByUserId: string | null) {
  const [profile] = await db
    .select({ userId: employerProfiles.userId })
    .from(employerProfiles)
    .where(eq(employerProfiles.id, employerProfileId))
    .limit(1);
  return [profile?.userId, submittedByUserId];
}

// Runs at most once a minute per server — there's no background job; any
// page that shows ads calls this first, which is enough to keep things on time.
let lastSyncAt = 0;

/**
 * Housekeeping for bookings, done lazily: an unreviewed booking whose start
 * date has arrived moves to the next free date (and the employer is told),
 * and the "live", "ending soon" and "ended" notifications go out — each
 * claimed with a conditional update first, so it's sent exactly once even
 * with several servers or requests racing.
 */
export async function syncCompanyAds(today = todayMY(), force = false) {
  if (!force && Date.now() - lastSyncAt < 60_000) return;
  lastSyncAt = Date.now();

  // Overdue = its whole start day went by unreviewed (a same-day "as soon as
  // possible" booking stays held for the superadmin all that day).
  const overdue = await db
    .select()
    .from(companyAds)
    .where(and(eq(companyAds.status, "pending"), lt(companyAds.startDate, today)));
  for (const ad of overdue) {
    const all = await getSlotBookings(today);
    const own = all.filter((b) => b.employerProfileId === ad.employerProfileId);
    // From tomorrow, so the review has a day; past the usual window if needed.
    const newStart = nextFreeStart(addDays(today, 1), addDays(today, 730), all, own, ad.id);
    if (!newStart) continue;
    const [moved] = await db
      .update(companyAds)
      .set({ startDate: newStart, endDate: runEndDate(newStart) })
      .where(and(eq(companyAds.id, ad.id), eq(companyAds.status, "pending"), eq(companyAds.startDate, ad.startDate)))
      .returning();
    if (moved) {
      await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
        type: "company_ad_moved",
        title: "Your ad's start date moved",
        body: `It wasn't reviewed in time for ${formatAdDate(ad.startDate)}, so it now runs ${formatAdRun(newStart, moved.endDate)}.`,
        link: "/employer/advertisement",
      });
    }
  }

  const live = await db
    .update(companyAds)
    .set({ liveNotifiedAt: new Date() })
    .where(
      and(
        eq(companyAds.status, "approved"),
        lte(companyAds.startDate, today),
        gt(companyAds.endDate, today),
        isNull(companyAds.liveNotifiedAt),
      ),
    )
    .returning();
  for (const ad of live) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "company_ad_live",
      title: "Your ad is live",
      body: `It's showing on the JobGiga employer page until ${formatAdDate(addDays(ad.endDate, -1))}.`,
      link: "/employer/advertisement",
    });
  }

  const ending = await db
    .update(companyAds)
    .set({ endingNotifiedAt: new Date() })
    .where(
      and(
        eq(companyAds.status, "approved"),
        lte(companyAds.startDate, today),
        gt(companyAds.endDate, today),
        lte(companyAds.endDate, addDays(today, AD_ENDING_SOON_DAYS)),
        isNull(companyAds.endingNotifiedAt),
      ),
    )
    .returning();
  for (const ad of ending) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "company_ad_ending",
      title: "Your ad ends soon",
      body: `Its last day is ${formatAdDate(addDays(ad.endDate, -1))}. Book your next slot to keep showing.`,
      link: "/employer/advertisement",
    });
  }

  const ended = await db
    .update(companyAds)
    .set({ endedNotifiedAt: new Date() })
    .where(and(eq(companyAds.status, "approved"), lte(companyAds.endDate, today), isNull(companyAds.endedNotifiedAt)))
    .returning();
  for (const ad of ended) {
    await notify(await adRecipients(ad.employerProfileId, ad.submittedByUserId), "employer", {
      type: "company_ad_ended",
      title: "Your ad has ended",
      body: "Its month on the JobGiga employer page is over. You can book it again anytime.",
      link: "/employer/advertisement",
    });
  }
}

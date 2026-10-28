import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { and, eq, sql } from "drizzle-orm";
import {
  AD_MAX_ACTIVE_PER_COMPANY,
  adPhase,
  checkStart,
  formatAdDate,
  isIsoDate,
  lastBookableStart,
  nextFreeStart,
  runEndDate,
  todayMY,
} from "@/lib/ad-slots";
import { AD_IMAGE_MAX_BYTES, AD_VIDEO_MAX_BYTES, AD_VIDEO_MAX_SECONDS } from "@/lib/company-ads";
import { db } from "@/lib/db";
import { jobAds, jobPostings } from "@/lib/db/schema";
import { getFullEmployerAccess } from "@/lib/employer-profile";
import {
  copyJobAdFile,
  deleteJobAdFile,
  getJobAdSlotBookings,
  jobAdMediaUrl,
  saveJobAdImage,
  saveJobAdVideo,
} from "@/lib/job-ads";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

async function requireEmployer() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getFullEmployerAccess(session.userId);
  return access ? { userId: session.userId, profileId: access.profile.id } : null;
}

async function getOwnBooking(id: string, profileId: string) {
  if (!isUuid(id)) return null;
  const [ad] = await db
    .select()
    .from(jobAds)
    .where(and(eq(jobAds.id, id), eq(jobAds.employerProfileId, profileId)))
    .limit(1);
  return ad ?? null;
}

const REASON_MESSAGE = {
  past: "That date has already passed — pick today or later.",
  too_far: "You can book up to 3 months ahead — pick an earlier date.",
  full: "All 10 featured job slots are taken for part of that month.",
  overlap: "That overlaps your other job ad booking — pick a date after it ends.",
} as const;

/**
 * Book (or edit) a job posting ad. Multipart fields:
 * - jobPostingId (required): one of the company's active job postings
 * - startDate: "YYYY-MM-DD", or "asap" for the earliest free date
 * - media: new square artwork (image/video); or reuseFromId: an earlier
 *   booking's artwork ("Book again"); or neither when editing (keeps it)
 * - bookingId: edit this booking (waiting, scheduled or rejected) instead of
 *   creating one — it goes back to "waiting for review" either way.
 */
export async function POST(request: Request) {
  const employer = await requireEmployer();
  if (!employer) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  let jobPostingId: string;
  let startInput: string;
  let bookingId: string;
  let reuseFromId: string;
  let file: File | null;
  try {
    const form = await request.formData();
    jobPostingId = String(form.get("jobPostingId") ?? "").trim();
    startInput = String(form.get("startDate") ?? "").trim();
    bookingId = String(form.get("bookingId") ?? "").trim();
    reuseFromId = String(form.get("reuseFromId") ?? "").trim();
    const media = form.get("media");
    file = media instanceof File && media.size > 0 ? media : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (!isUuid(jobPostingId)) return NextResponse.json({ error: "Choose the job posting to feature." }, { status: 400 });
  const [posting] = await db
    .select({ id: jobPostings.id, status: jobPostings.status })
    .from(jobPostings)
    .where(and(eq(jobPostings.id, jobPostingId), eq(jobPostings.employerProfileId, employer.profileId)))
    .limit(1);
  if (!posting) return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
  if (posting.status !== "active") {
    return NextResponse.json({ error: "Only a live job posting can be featured — this one isn't open." }, { status: 400 });
  }
  if (startInput !== "asap" && !isIsoDate(startInput)) {
    return NextResponse.json({ error: "Choose a start date." }, { status: 400 });
  }

  const today = todayMY();
  const editing = bookingId ? await getOwnBooking(bookingId, employer.profileId) : null;
  if (bookingId && !editing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (editing) {
    const phase = adPhase(editing, today);
    if (phase === "live" || phase === "ended") {
      return NextResponse.json({ error: "A running or finished ad can't be edited — book a new one instead." }, { status: 400 });
    }
  }
  const reuseFrom = !file && !editing && reuseFromId ? await getOwnBooking(reuseFromId, employer.profileId) : null;
  if (!file && !editing && !reuseFrom) {
    return NextResponse.json({ error: "Upload artwork (an image or video) for your job ad." }, { status: 400 });
  }
  // A rejected booking holds no slot, so resubmitting it counts against the
  // per-company limit like a new booking.
  const holdsSlot = !!editing && editing.status !== "rejected";

  // Quick check before any (possibly slow) media processing; repeated under
  // the lock below, since another employer may book in the meantime.
  const preOwn = (await getJobAdSlotBookings(today)).filter((b) => b.employerProfileId === employer.profileId);
  if (!holdsSlot && preOwn.length >= AD_MAX_ACTIVE_PER_COMPANY) {
    return NextResponse.json(
      { error: `You already have ${AD_MAX_ACTIVE_PER_COMPANY} job ad bookings — the most allowed. You can book again when one ends.` },
      { status: 400 },
    );
  }

  let media: { mediaType: "image" | "video"; fileName: string } | null = null;
  if (file) {
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
      if (file.size > AD_IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: "That image is too large (max 10 MB)." }, { status: 413 });
      }
      try {
        media = { mediaType: "image", fileName: await saveJobAdImage(Buffer.from(await file.arrayBuffer())) };
      } catch {
        return NextResponse.json({ error: "We couldn't read that image — try a JPG or PNG." }, { status: 400 });
      }
    } else if (file.type.startsWith("video/")) {
      if (file.size > AD_VIDEO_MAX_BYTES) {
        return NextResponse.json({ error: "That video is too large (max 100 MB)." }, { status: 413 });
      }
      // ffmpeg needs a real file to read — staged in the OS temp dir, always cleaned up.
      const tempPath = path.join(os.tmpdir(), `job-ad-${randomUUID()}`);
      try {
        await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
        const result = await saveJobAdVideo(tempPath, AD_VIDEO_MAX_SECONDS);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        media = { mediaType: "video", fileName: result.fileName };
      } finally {
        await rm(tempPath, { force: true });
      }
    } else {
      return NextResponse.json({ error: "Upload a JPG, PNG or WebP image, or a video." }, { status: 400 });
    }
  } else if (reuseFrom) {
    media = { mediaType: reuseFrom.mediaType, fileName: await copyJobAdFile(reuseFrom.fileName) };
  }

  // Slot checks and the write happen under one lock, so two employers can't
  // both take the last slot for the same dates.
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('job_ad_slots'))`);
    const all = await getJobAdSlotBookings(today, tx);
    const own = all.filter((b) => b.employerProfileId === employer.profileId);
    if (!holdsSlot && own.length >= AD_MAX_ACTIVE_PER_COMPANY) {
      return { error: `You already have ${AD_MAX_ACTIVE_PER_COMPANY} job ad bookings — the most allowed.` } as const;
    }

    let startDate: string;
    if (startInput === "asap") {
      const free = nextFreeStart(today, lastBookableStart(today), all, own, editing?.id);
      if (!free) return { error: "There's no free slot in the next 3 months right now — please check back soon." } as const;
      startDate = free;
    } else {
      const check = checkStart(startInput, today, all, own, editing?.id);
      if (!check.ok) {
        const next = nextFreeStart(today, lastBookableStart(today), all, own, editing?.id);
        const hint = check.reason === "full" && next ? ` The next free start is ${formatAdDate(next)}.` : "";
        return { error: REASON_MESSAGE[check.reason] + hint } as const;
      }
      startDate = startInput;
    }

    const values = {
      jobPostingId: posting.id,
      startDate,
      endDate: runEndDate(startDate),
      status: "pending" as const,
      rejectionReason: null,
      reviewedAt: null,
      liveNotifiedAt: null,
      endingNotifiedAt: null,
      endedNotifiedAt: null,
      submittedAt: new Date(),
      submittedByUserId: employer.userId,
    };
    if (editing) {
      const [saved] = await tx
        .update(jobAds)
        .set({ ...values, ...(media ?? {}) })
        .where(eq(jobAds.id, editing.id))
        .returning();
      return { saved } as const;
    }
    const [saved] = await tx
      .insert(jobAds)
      .values({ ...values, ...media!, employerProfileId: employer.profileId })
      .returning();
    return { saved } as const;
  });

  if ("error" in result) {
    // The new file isn't referenced by anything — don't leave it behind.
    if (media) await deleteJobAdFile(media.fileName);
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  revalidatePublicData();
  if (editing && media) await deleteJobAdFile(editing.fileName);

  const saved = result.saved;
  return NextResponse.json({ booking: { ...saved, phase: adPhase(saved, today), mediaUrl: jobAdMediaUrl(saved) } });
}

// Cancel a booking (frees its slot) or remove a past one from the list.
export async function DELETE(request: Request) {
  const employer = await requireEmployer();
  if (!employer) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const booking = await getOwnBooking(id, employer.profileId);
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  await db.delete(jobAds).where(eq(jobAds.id, booking.id));
  revalidatePublicData();
  await deleteJobAdFile(booking.fileName);
  return NextResponse.json({ ok: true });
}

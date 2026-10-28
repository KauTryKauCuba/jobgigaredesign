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
import {
  AD_HEADLINE_MAX,
  AD_IMAGE_MAX_BYTES,
  AD_VIDEO_MAX_BYTES,
  companyAdMediaUrl,
  copyCompanyAdFile,
  deleteCompanyAdFile,
  getSlotBookings,
  saveCompanyAdImage,
  saveCompanyAdVideo,
} from "@/lib/company-ads";
import { db } from "@/lib/db";
import { companyAds } from "@/lib/db/schema";
import { getFullEmployerAccess } from "@/lib/employer-profile";
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
    .from(companyAds)
    .where(and(eq(companyAds.id, id), eq(companyAds.employerProfileId, profileId)))
    .limit(1);
  return ad ?? null;
}

const REASON_MESSAGE = {
  past: "That date has already passed — pick today or later.",
  too_far: "You can book up to 3 months ahead — pick an earlier date.",
  full: "All 10 slots are taken for part of that month.",
  overlap: "That overlaps your other booking — pick a date after it ends.",
} as const;

/**
 * Book (or edit) a company ad. Multipart fields:
 * - headline (required)
 * - startDate: "YYYY-MM-DD", or "asap" for the earliest free date
 * - media: a new image/video file; or reuseFromId: an earlier booking's
 *   media ("Book again"); or neither when editing (keeps the current file)
 * - bookingId: edit this booking (waiting, scheduled or rejected) instead of
 *   creating one — it goes back to "waiting for review" either way.
 */
export async function POST(request: Request) {
  const employer = await requireEmployer();
  if (!employer) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  let headline: string;
  let startInput: string;
  let bookingId: string;
  let reuseFromId: string;
  let file: File | null;
  try {
    const form = await request.formData();
    headline = String(form.get("headline") ?? "").trim();
    startInput = String(form.get("startDate") ?? "").trim();
    bookingId = String(form.get("bookingId") ?? "").trim();
    reuseFromId = String(form.get("reuseFromId") ?? "").trim();
    const media = form.get("media");
    file = media instanceof File && media.size > 0 ? media : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (!headline) return NextResponse.json({ error: "Add a headline for your ad." }, { status: 400 });
  if (headline.length > AD_HEADLINE_MAX) {
    return NextResponse.json({ error: `Keep the headline to ${AD_HEADLINE_MAX} characters.` }, { status: 400 });
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
    return NextResponse.json({ error: "Upload an image or video for your ad." }, { status: 400 });
  }
  // A rejected booking holds no slot, so resubmitting it counts against the
  // per-company limit like a new booking.
  const holdsSlot = !!editing && editing.status !== "rejected";

  // Quick checks before any (possibly slow) media processing; repeated under
  // the lock below, since another employer may book in the meantime.
  const preBookings = await getSlotBookings(today);
  const preOwn = preBookings.filter((b) => b.employerProfileId === employer.profileId);
  if (!holdsSlot && preOwn.length >= AD_MAX_ACTIVE_PER_COMPANY) {
    return NextResponse.json(
      { error: `You already have ${AD_MAX_ACTIVE_PER_COMPANY} bookings — the most allowed. You can book again when one ends.` },
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
        media = { mediaType: "image", fileName: await saveCompanyAdImage(Buffer.from(await file.arrayBuffer())) };
      } catch {
        return NextResponse.json({ error: "We couldn't read that image — try a JPG or PNG." }, { status: 400 });
      }
    } else if (file.type.startsWith("video/")) {
      if (file.size > AD_VIDEO_MAX_BYTES) {
        return NextResponse.json({ error: "That video is too large (max 100 MB)." }, { status: 413 });
      }
      // ffmpeg needs a real file to read — staged in the OS temp dir, always cleaned up.
      const tempPath = path.join(os.tmpdir(), `ad-${randomUUID()}`);
      try {
        await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
        const result = await saveCompanyAdVideo(tempPath);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        media = { mediaType: "video", fileName: result.fileName };
      } finally {
        await rm(tempPath, { force: true });
      }
    } else {
      return NextResponse.json({ error: "Upload a JPG, PNG or WebP image, or a video." }, { status: 400 });
    }
  } else if (reuseFrom) {
    media = { mediaType: reuseFrom.mediaType, fileName: await copyCompanyAdFile(reuseFrom.fileName) };
  }

  // Slot checks and the write happen under one lock, so two employers can't
  // both take the last slot for the same dates.
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('company_ad_slots'))`);
    const all = await getSlotBookings(today, tx);
    const own = all.filter((b) => b.employerProfileId === employer.profileId);
    if (!holdsSlot && own.length >= AD_MAX_ACTIVE_PER_COMPANY) {
      return { error: `You already have ${AD_MAX_ACTIVE_PER_COMPANY} bookings — the most allowed.` } as const;
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
      headline,
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
        .update(companyAds)
        .set({ ...values, ...(media ?? {}) })
        .where(eq(companyAds.id, editing.id))
        .returning();
      return { saved } as const;
    }
    const [saved] = await tx
      .insert(companyAds)
      .values({ ...values, ...media!, employerProfileId: employer.profileId })
      .returning();
    return { saved } as const;
  });

  if ("error" in result) {
    // The new file isn't referenced by anything — don't leave it behind.
    if (media) await deleteCompanyAdFile(media.fileName);
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  revalidatePublicData();
  if (editing && media) await deleteCompanyAdFile(editing.fileName);

  const saved = result.saved;
  return NextResponse.json({ booking: { ...saved, phase: adPhase(saved, today), mediaUrl: companyAdMediaUrl(saved) } });
}

// Cancel a booking (frees its slot) or remove a past one from the list.
export async function DELETE(request: Request) {
  const employer = await requireEmployer();
  if (!employer) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const booking = await getOwnBooking(id, employer.profileId);
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  await db.delete(companyAds).where(eq(companyAds.id, booking.id));
  revalidatePublicData();
  await deleteCompanyAdFile(booking.fileName);
  return NextResponse.json({ ok: true });
}

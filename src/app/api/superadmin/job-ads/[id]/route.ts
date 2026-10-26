import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { addDays, formatAdDate, todayMY } from "@/lib/ad-slots";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { employerProfiles, jobAds, jobPostings } from "@/lib/db/schema";
import { JOB_ADS_PAGE, syncJobAds } from "@/lib/job-ads";
import { notify } from "@/lib/notifications";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isUuid } from "@/lib/uuid";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Approve (the job is featured on the jobseeker page from its start date) or
// reject (with a reason shown back to the employer on their Advertisement page).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [existing] = await db
    .select({
      id: jobAds.id,
      status: jobAds.status,
      startDate: jobAds.startDate,
      endDate: jobAds.endDate,
      submittedByUserId: jobAds.submittedByUserId,
      ownerUserId: employerProfiles.userId,
      jobTitle: jobPostings.title,
    })
    .from(jobAds)
    .innerJoin(employerProfiles, eq(employerProfiles.id, jobAds.employerProfileId))
    .innerJoin(jobPostings, eq(jobPostings.id, jobAds.jobPostingId))
    .where(eq(jobAds.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { action, reason } = (body ?? {}) as Record<string, unknown>;
  const recipients = [existing.ownerUserId, existing.submittedByUserId];

  if (action === "approve") {
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This ad isn't waiting for review." }, { status: 400 });
    }
    await db
      .update(jobAds)
      .set({ status: "approved", rejectionReason: null, reviewedAt: new Date() })
      .where(eq(jobAds.id, id));
    // Starting today: the "Your job ad is live" notification (syncJobAds)
    // says it all, so this one only goes out for a future start.
    if (existing.startDate > todayMY()) {
      await notify(recipients, "employer", {
        type: "job_ad_approved",
        title: "Your job ad is approved",
        body: `${existing.jobTitle} is featured from ${formatAdDate(existing.startDate)} until ${formatAdDate(addDays(existing.endDate, -1))}.`,
        link: JOB_ADS_PAGE,
      });
    }
    await syncJobAds(todayMY(), true);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "Give a reason for rejecting this ad." }, { status: 400 });
    }
    // Rejecting (or taking down a running ad) frees its slot straight away.
    const wasLive = existing.status === "approved" && existing.startDate <= todayMY();
    await db
      .update(jobAds)
      .set({ status: "rejected", rejectionReason: reason.trim(), reviewedAt: new Date() })
      .where(eq(jobAds.id, id));
    await notify(recipients, "employer", {
      type: "job_ad_rejected",
      title: wasLive ? "Your job ad was taken down" : "Your job ad needs changes",
      body: `${reason.trim()} You can edit it and submit it again.`,
      link: JOB_ADS_PAGE,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { addDays, formatAdDate, todayMY } from "@/lib/ad-slots";
import { getAuthUser } from "@/lib/auth-user";
import { syncCompanyAds } from "@/lib/company-ads";
import { db } from "@/lib/db";
import { companyAds, employerProfiles } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { revalidatePublicData } from "@/lib/public-data";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isUuid } from "@/lib/uuid";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Approve (the ad goes live on the employer landing page) or reject (with a
// reason shown back to the employer on their Advertisement page).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [existing] = await db
    .select({
      id: companyAds.id,
      status: companyAds.status,
      startDate: companyAds.startDate,
      endDate: companyAds.endDate,
      submittedByUserId: companyAds.submittedByUserId,
      ownerUserId: employerProfiles.userId,
    })
    .from(companyAds)
    .innerJoin(employerProfiles, eq(employerProfiles.id, companyAds.employerProfileId))
    .where(eq(companyAds.id, id))
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
      .update(companyAds)
      .set({ status: "approved", rejectionReason: null, reviewedAt: new Date() })
      .where(eq(companyAds.id, id));
    revalidatePublicData();
    // Starting today: the "Your ad is live" notification (syncCompanyAds)
    // says it all, so this one only goes out for a future start.
    if (existing.startDate > todayMY()) {
      await notify(recipients, "employer", {
        type: "company_ad_approved",
        title: "Your advertisement is approved",
        body: `It goes live on ${formatAdDate(existing.startDate)} and runs until ${formatAdDate(addDays(existing.endDate, -1))}.`,
        link: "/employer/advertisement",
      });
    }
    await syncCompanyAds(todayMY(), true);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "Give a reason for rejecting this ad." }, { status: 400 });
    }
    // Rejecting (or taking down a running ad) frees its slot straight away.
    const wasLive = existing.status === "approved" && existing.startDate <= todayMY();
    await db
      .update(companyAds)
      .set({ status: "rejected", rejectionReason: reason.trim(), reviewedAt: new Date() })
      .where(eq(companyAds.id, id));
    revalidatePublicData();
    await notify(recipients, "employer", {
      type: "company_ad_rejected",
      title: wasLive ? "Your advertisement was taken down" : "Your advertisement needs changes",
      body: `${reason.trim()} You can edit it and submit it again.`,
      link: "/employer/advertisement",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

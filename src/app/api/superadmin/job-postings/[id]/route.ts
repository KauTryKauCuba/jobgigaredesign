import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { jobPostingReports, jobPostings } from "@/lib/db/schema";
import { getJobPostingById } from "@/lib/job-postings";
import { isSuperadminEmail } from "@/lib/superadmin";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getJobPostingById(id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { action, reason } = (body ?? {}) as Record<string, unknown>;

  if (action === "approve" || action === "reject") {
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This posting isn't awaiting review." }, { status: 400 });
    }
  } else if (action === "flag") {
    if (existing.status !== "active") {
      return NextResponse.json({ error: "Only active postings can be flagged." }, { status: 400 });
    }
  }

  if (action === "approve") {
    const [updated] = await db
      .update(jobPostings)
      .set({ status: "active", rejectionReason: null, flagReason: null, flaggedAt: null, updatedAt: new Date() })
      .where(eq(jobPostings.id, id))
      .returning();
    return NextResponse.json({ posting: updated });
  }

  if (action === "reject") {
    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "Give a reason for rejecting this posting." }, { status: 400 });
    }
    const [updated] = await db
      .update(jobPostings)
      .set({ status: "rejected", rejectionReason: reason.trim(), flagReason: null, flaggedAt: null, updatedAt: new Date() })
      .where(eq(jobPostings.id, id))
      .returning();
    return NextResponse.json({ posting: updated });
  }

  if (action === "flag") {
    if (!isNonEmptyString(reason)) {
      return NextResponse.json({ error: "Give a reason for flagging this posting." }, { status: 400 });
    }
    const [updated] = await db
      .update(jobPostings)
      .set({
        status: "flagged",
        flagReason: reason.trim(),
        flaggedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(jobPostings.id, id))
      .returning();
    // Whatever jobseeker reports led here (if any) are now resolved into a
    // formal flag with its own reason — clear them so they don't also
    // linger in the Reports queue for a posting that's already being
    // handled.
    await db.delete(jobPostingReports).where(eq(jobPostingReports.jobPostingId, id));
    return NextResponse.json({ posting: updated });
  }

  // Reviewed the reports and decided they don't warrant flagging this
  // posting — clears them without touching the posting's status, so it
  // drops off the Reports queue.
  if (action === "dismiss_reports") {
    await db.delete(jobPostingReports).where(eq(jobPostingReports.jobPostingId, id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings, jobPostingViews } from "@/lib/db/schema";
import { getJobseekerProfileId } from "@/lib/job-applications";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

// Records a unique view — no-op (via ON CONFLICT DO NOTHING) if this
// jobseeker has already viewed this posting before, so repeat visits don't
// inflate the count. Signed-out/employer visitors aren't tracked at all;
// there's no jobseeker_profile to key the row on.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const jobseekerProfileId = await getJobseekerProfileId(session.userId);
  if (!jobseekerProfileId) return NextResponse.json({ ok: true, tracked: false });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: true, tracked: false });
  // A tab left open on a posting that's since been deleted.
  const [posting] = await db.select({ id: jobPostings.id }).from(jobPostings).where(eq(jobPostings.id, id)).limit(1);
  if (!posting) return NextResponse.json({ ok: true, tracked: false });
  await db
    .insert(jobPostingViews)
    .values({ jobPostingId: id, jobseekerProfileId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, tracked: true });
}

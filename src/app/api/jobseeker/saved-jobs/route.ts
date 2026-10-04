import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings, savedJobs } from "@/lib/db/schema";
import { getJobseekerProfileId } from "@/lib/job-applications";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

async function readJobPostingId(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return isUuid(body?.jobPostingId) ? body.jobPostingId : null;
  } catch {
    return null;
  }
}

async function requireJobseeker() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") return null;
  return getJobseekerProfileId(session.userId);
}

// Save (heart) a posting. Only live postings can be newly saved; saving one
// that's already saved is a no-op.
export async function POST(request: Request) {
  const profileId = await requireJobseeker();
  if (!profileId) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  const jobPostingId = await readJobPostingId(request);
  if (!jobPostingId) return NextResponse.json({ error: "Invalid job posting." }, { status: 400 });

  const [posting] = await db
    .select({ status: jobPostings.status })
    .from(jobPostings)
    .where(eq(jobPostings.id, jobPostingId))
    .limit(1);
  if (!posting || posting.status !== "active") {
    return NextResponse.json({ error: "This job isn't available to save." }, { status: 404 });
  }

  await db.insert(savedJobs).values({ jobseekerProfileId: profileId, jobPostingId }).onConflictDoNothing();
  return NextResponse.json({ saved: true });
}

// Un-save. Works for closed postings too, so they can be cleared from the list.
export async function DELETE(request: Request) {
  const profileId = await requireJobseeker();
  if (!profileId) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  const jobPostingId = await readJobPostingId(request);
  if (!jobPostingId) return NextResponse.json({ error: "Invalid job posting." }, { status: 400 });

  await db
    .delete(savedJobs)
    .where(and(eq(savedJobs.jobseekerProfileId, profileId), eq(savedJobs.jobPostingId, jobPostingId)));
  return NextResponse.json({ saved: false });
}

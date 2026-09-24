import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobPostings, jobseekerProfiles } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker to apply." }, { status: 401 });
  }

  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Finish your profile before applying." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { jobPostingId } = (body ?? {}) as Record<string, unknown>;
  if (typeof jobPostingId !== "string" || !jobPostingId) {
    return NextResponse.json({ error: "Missing job posting." }, { status: 400 });
  }

  const [posting] = await db
    .select({ id: jobPostings.id, status: jobPostings.status })
    .from(jobPostings)
    .where(eq(jobPostings.id, jobPostingId))
    .limit(1);
  if (!posting || posting.status !== "active") {
    return NextResponse.json({ error: "This posting isn't accepting applications." }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(
      and(eq(jobApplications.jobPostingId, jobPostingId), eq(jobApplications.jobseekerProfileId, profile.id)),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyApplied: true });
  }

  await db.insert(jobApplications).values({ jobPostingId, jobseekerProfileId: profile.id });
  return NextResponse.json({ ok: true });
}

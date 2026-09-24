import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobseekerProfiles } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;

  // Application must belong to this jobseeker and still be at (or past) the
  // interview stage. Note interviewResponseStatus gets overwritten to
  // "attended"/"no_show" once the employer marks it, so this can't require
  // it to still read "accepted" — status moving to "interview"/"interviewed"
  // at all already implies an interview was scheduled for them.
  const [existing] = await db
    .select({ id: jobApplications.id, status: jobApplications.status, interviewResponseStatus: jobApplications.interviewResponseStatus })
    .from(jobApplications)
    .where(and(eq(jobApplications.id, id), eq(jobApplications.jobseekerProfileId, profile.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (
    (existing.status !== "interview" && existing.status !== "interviewed") ||
    existing.interviewResponseStatus === "declined"
  ) {
    return NextResponse.json({ error: "This interview can't be confirmed right now." }, { status: 400 });
  }

  const [updated] = await db
    .update(jobApplications)
    .set({ jobseekerConfirmedAttendance: true, updatedAt: new Date() })
    .where(eq(jobApplications.id, id))
    .returning();

  return NextResponse.json({ application: updated });
}

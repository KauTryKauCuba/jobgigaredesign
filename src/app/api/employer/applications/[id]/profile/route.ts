import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getJobseekerProfileById } from "@/lib/jobseeker-profile";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const employerProfile = access.profile;

  const { id } = await params;

  // Application must belong to one of this employer's own postings — same
  // ownership check as the status-update route.
  const [application] = await db
    .select({ jobseekerProfileId: jobApplications.jobseekerProfileId })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(and(eq(jobApplications.id, id), eq(jobPostings.employerProfileId, employerProfile.id)))
    .limit(1);
  if (!application) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const profile = await getJobseekerProfileById(application.jobseekerProfileId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ profile });
}

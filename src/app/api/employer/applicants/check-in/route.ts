import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerProfiles, jobApplications, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

// Backs the chat assistant's "any new applicants since I last checked?"
// question — reads the employer's previous check-in timestamp, counts
// applications since then, then bumps the timestamp to now in the same
// request so the next check-in only counts what's genuinely new.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Employer profile not found." }, { status: 404 });
  const profile = access.profile;

  const previousCheckedAt = profile.applicantsLastCheckedAt;
  const now = new Date();

  let newCount: number | null = null;
  if (previousCheckedAt) {
    const rows = await db
      .select({ id: jobApplications.id })
      .from(jobApplications)
      .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
      .where(and(eq(jobPostings.employerProfileId, profile.id), gt(jobApplications.appliedAt, previousCheckedAt)));
    newCount = rows.length;
  }

  await db.update(employerProfiles).set({ applicantsLastCheckedAt: now }).where(eq(employerProfiles.id, profile.id));

  return NextResponse.json({ newCount, previousCheckedAt: previousCheckedAt?.toISOString() ?? null });
}

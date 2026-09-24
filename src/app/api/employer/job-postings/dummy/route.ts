import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { generateUniqueJobPostingSlug } from "@/lib/job-postings";
import { getSession } from "@/lib/session";
import { DUMMY_JOB_POSTINGS, DUMMY_POSTING_MARKER } from "@/lib/dummy-job-postings";

async function getEmployerProfile(userId: string) {
  const access = await getEmployerAccess(userId);
  return access?.profile ?? null;
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const profile = await getEmployerProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Clear any leftover dummy postings first so repeated clicks (or the
  // Applicants page's button calling this one too) stay idempotent instead
  // of piling up duplicate sets.
  await db
    .delete(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, profile.id), eq(jobPostings.postingName, DUMMY_POSTING_MARKER)));

  const rows = [];
  for (const p of DUMMY_JOB_POSTINGS) {
    rows.push({
      ...p,
      employerProfileId: profile.id,
      postingName: DUMMY_POSTING_MARKER,
      slug: await generateUniqueJobPostingSlug(profile.companyName, p.title),
    });
  }
  await db.insert(jobPostings).values(rows);

  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const profile = await getEmployerProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db
    .delete(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, profile.id), eq(jobPostings.postingName, DUMMY_POSTING_MARKER)));

  return NextResponse.json({ ok: true });
}

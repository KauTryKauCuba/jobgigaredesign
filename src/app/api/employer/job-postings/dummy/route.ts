import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getFullEmployerAccess } from "@/lib/employer-profile";
import { jobAdFileCleanupForPostings } from "@/lib/job-ads";
import { aiInterviewMediaCleanupForPostings } from "@/lib/ai-interview";
import { generateUniqueJobPostingSlug } from "@/lib/job-postings";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { DUMMY_JOB_POSTINGS, DUMMY_POSTING_MARKER } from "@/lib/dummy-job-postings";

async function getEmployerProfile(userId: string) {
  const access = await getFullEmployerAccess(userId);
  return access?.profile ?? null;
}

async function deleteDummyPostings(employerProfileId: string) {
  const where = and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.postingName, DUMMY_POSTING_MARKER));
  const dummies = await db.select({ id: jobPostings.id }).from(jobPostings).where(where);
  // Job ad and AI interview rows cascade with the postings; their files don't,
  // so they're removed once the postings are really gone.
  const ids = dummies.map((p) => p.id);
  const cleanups = await Promise.all([jobAdFileCleanupForPostings(ids), aiInterviewMediaCleanupForPostings(ids)]);
  await db.delete(jobPostings).where(where);
  revalidatePublicData();
  await Promise.all(cleanups.map((cleanup) => cleanup()));
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
  await deleteDummyPostings(profile.id);

  const rows = [];
  for (const p of DUMMY_JOB_POSTINGS) {
    rows.push({
      ...p,
      employerProfileId: profile.id,
      // The person adding the sample data is each posting's "Posted by" contact.
      contactUserId: session.userId,
      postingName: DUMMY_POSTING_MARKER,
      slug: await generateUniqueJobPostingSlug(profile.companyName, p.title),
    });
  }
  await db.insert(jobPostings).values(rows);
  revalidatePublicData();

  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const profile = await getEmployerProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteDummyPostings(profile.id);

  return NextResponse.json({ ok: true });
}

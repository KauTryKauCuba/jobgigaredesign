import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostingPosters } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";

// Most recent poster generated for a posting is capped, newest first — an
// employer who's generated dozens for one posting shouldn't have every full
// base64-encoded image re-downloaded on every posting switch (see
// PosterGeneratorView.tsx, which refetches this on selection change).
const HISTORY_LIMIT = 20;

// Lists the most recent posters generated for a posting, newest first, so
// the employer can browse/download past posters instead of only the latest
// (which jobPostings.posterUrl still mirrors).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const profileId = access.profile.id;

  const { id } = await params;
  const posting = await getJobPostingForEmployer(profileId, id);
  if (!posting) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const posters = await db
    .select({
      id: jobPostingPosters.id,
      posterUrl: jobPostingPosters.posterUrl,
      style: jobPostingPosters.style,
      createdAt: jobPostingPosters.createdAt,
    })
    .from(jobPostingPosters)
    .where(eq(jobPostingPosters.jobPostingId, id))
    .orderBy(desc(jobPostingPosters.createdAt))
    .limit(HISTORY_LIMIT);

  return NextResponse.json({ posters });
}

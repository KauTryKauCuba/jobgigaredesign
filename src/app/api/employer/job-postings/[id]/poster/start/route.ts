import { NextResponse } from "next/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";

// Starts the Poster Generator's fake-delay countdown for one posting.
// `posterGeneratingSince` is the source of truth for "is a poster currently
// generating" — enforced here (not just in the UI) so opening the page in two
// tabs, or hitting this twice quickly, can't start two generations at once.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const [alreadyGenerating] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.employerProfileId, profileId),
        isNotNull(jobPostings.posterGeneratingSince),
        ne(jobPostings.id, id),
      ),
    )
    .limit(1);
  if (alreadyGenerating) {
    return NextResponse.json(
      { error: "Only one poster can generate at a time — wait for the current one to finish." },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(jobPostings)
    .set({ posterGeneratingSince: new Date(), posterUrl: null, updatedAt: new Date() })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profileId)))
    .returning({ id: jobPostings.id, posterGeneratingSince: jobPostings.posterGeneratingSince });

  return NextResponse.json({ posting: updated });
}

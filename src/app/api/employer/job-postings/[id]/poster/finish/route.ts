import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Saves the finished poster (a data: URL rendered client-side via canvas —
// the actual drawing can only happen in a browser) and clears the
// "generating" flag, making the result a durable fact on the posting instead
// of something that lives only in this browser tab.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!posting.posterGeneratingSince) {
    return NextResponse.json({ error: "This posting isn't currently generating a poster." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { posterUrl } = (body ?? {}) as Record<string, unknown>;
  if (!isNonEmptyString(posterUrl) || !posterUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid poster image." }, { status: 400 });
  }

  const [updated] = await db
    .update(jobPostings)
    .set({ posterUrl, posterGeneratingSince: null, updatedAt: new Date() })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profileId)))
    .returning({ id: jobPostings.id, posterUrl: jobPostings.posterUrl });

  return NextResponse.json({ posting: updated });
}

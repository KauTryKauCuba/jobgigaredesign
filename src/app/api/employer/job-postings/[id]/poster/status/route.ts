import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { logAiUsage } from "@/lib/ai-usage";
import { db } from "@/lib/db";
import { jobPostingPosters, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { POSTER_GENERATION_STALE_MS, getPosterImageTaskResult } from "@/lib/icreat";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";
import { saveBufferUpload } from "@/lib/uploads";

// Polled by the client (PosterGeneratorView) every few seconds while a
// posting has posterGeneratingSince/posterTaskId set. Downloads the finished
// image server-side and stores it as a data: URL — same convention as
// avatarUrl/logoUrl/resumeUrl elsewhere — rather than pointing posterUrl at
// icreat's own hosted URL, which isn't guaranteed to stay valid indefinitely.
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

  if (!posting.posterGeneratingSince || !posting.posterTaskId) {
    return NextResponse.json({ generating: false, posterUrl: posting.posterUrl });
  }

  if (Date.now() - posting.posterGeneratingSince.getTime() > POSTER_GENERATION_STALE_MS) {
    await db
      .update(jobPostings)
      .set({ posterGeneratingSince: null, posterTaskId: null, posterPendingStyle: null, updatedAt: new Date() })
      .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profileId)));
    return NextResponse.json(
      { generating: false, posterUrl: null, error: "Poster generation timed out. Try again." },
      { status: 502 },
    );
  }

  const result = await getPosterImageTaskResult(posting.posterTaskId);

  if (result.status === "PENDING" || result.status === "PROCESSING") {
    return NextResponse.json({ generating: true, posterUrl: null });
  }

  if (result.status === "FAILED") {
    await db
      .update(jobPostings)
      .set({ posterGeneratingSince: null, posterTaskId: null, posterPendingStyle: null, updatedAt: new Date() })
      .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profileId)));
    return NextResponse.json({ generating: false, posterUrl: null, error: result.error }, { status: 502 });
  }

  let posterUrl: string;
  try {
    const imageRes = await fetch(result.imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageRes.ok) throw new Error(`fetch failed: ${imageRes.status}`);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get("content-type") ?? "image/png";
    // Written straight to disk instead of base64-encoded into Postgres —
    // that base64 step (previously stored as a `data:` URL, sometimes
    // several MB) was what made this endpoint take 27-33s per poll.
    posterUrl = await saveBufferUpload(buffer, contentType, "posters");
  } catch (err) {
    console.error("Failed to download generated poster:", err);
    return NextResponse.json({ generating: true, posterUrl: null });
  }

  // Conditioned on posterTaskId still matching what was just read — two
  // overlapping polls for the same finished task (two open tabs, or
  // overlapping interval ticks) would otherwise both pass the checks above
  // and both insert a history row / log AI usage for one actual generation.
  // Only the poll that wins this race actually clears the row; the loser's
  // update affects zero rows and skips the side effects below.
  const [updated] = await db
    .update(jobPostings)
    .set({
      posterUrl,
      posterGeneratingSince: null,
      posterTaskId: null,
      posterPendingStyle: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobPostings.id, id),
        eq(jobPostings.employerProfileId, profileId),
        eq(jobPostings.posterTaskId, posting.posterTaskId),
      ),
    )
    .returning({ posterUrl: jobPostings.posterUrl });

  if (!updated) {
    return NextResponse.json({ generating: false, posterUrl });
  }

  await db.insert(jobPostingPosters).values({
    jobPostingId: id,
    posterUrl,
    style: posting.posterPendingStyle ?? "playful",
  });

  await logAiUsage({
    userId: session.userId,
    feature: "poster_generation",
    provider: "icreat",
    model: "google/gemini-3-1-flash-image",
    usage: null,
    durationMs: null,
    callCount: 1,
    actualCostUsd: result.costUsd,
  });

  return NextResponse.json({ generating: false, posterUrl: updated.posterUrl ?? posterUrl });
}

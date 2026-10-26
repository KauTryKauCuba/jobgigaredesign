import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviews } from "@/lib/db/schema";
import { loadJobseekerInterview } from "@/lib/ai-interview-access";
import { getJobseekerAiInterview } from "@/lib/ai-interview";
import { getSession } from "@/lib/session";

// The applicant ticks the consent box (recording + AI processing) and begins.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker." }, { status: 401 });
  }
  const { id } = await params;
  const ctx = await loadJobseekerInterview(session.userId, id);
  if (!ctx) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if ((body as Record<string, unknown> | null)?.consent !== true) {
    return NextResponse.json({ error: "Please tick the box to agree before you start." }, { status: 400 });
  }
  const { interview } = ctx;
  if (interview.status === "expired") {
    return NextResponse.json({ error: "The deadline has passed. Ask the employer for more time." }, { status: 409 });
  }
  if (interview.status !== "invited" && interview.status !== "in_progress") {
    return NextResponse.json({ error: "This AI interview isn't open." }, { status: 409 });
  }

  const now = new Date();
  await db
    .update(aiInterviews)
    .set({
      status: "in_progress",
      // Keep the first consent time if they come back later.
      consentAt: interview.consentAt ?? now,
      startedAt: interview.startedAt ?? now,
      updatedAt: now,
    })
    .where(and(eq(aiInterviews.id, id), inArray(aiInterviews.status, ["invited", "in_progress"])));

  return NextResponse.json({ interview: await getJobseekerAiInterview(id, ctx.jobseekerProfileId) });
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviewEvaluations, jobApplications, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";
import { EVALUATION_CRITERIA } from "@/lib/interviewEvaluation";

const RECOMMENDATIONS = ["strong_hire", "hire", "no_hire", "strong_no_hire"] as const;

function parseScores(value: unknown): Record<string, number> | "invalid" {
  if (!value || typeof value !== "object") return "invalid";
  const v = value as Record<string, unknown>;
  const scores: Record<string, number> = {};
  for (const [key, raw] of Object.entries(v)) {
    if (!(EVALUATION_CRITERIA as readonly string[]).includes(key)) return "invalid";
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) return "invalid";
    scores[key] = raw;
  }
  if (Object.keys(scores).length === 0) return "invalid";
  return scores;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const profile = access.profile;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { scores, recommendation, notes } = (body ?? {}) as Record<string, unknown>;

  const parsedScores = parseScores(scores);
  if (parsedScores === "invalid") {
    return NextResponse.json({ error: "Invalid scores." }, { status: 400 });
  }
  if (typeof recommendation !== "string" || !(RECOMMENDATIONS as readonly string[]).includes(recommendation)) {
    return NextResponse.json({ error: "Invalid recommendation." }, { status: 400 });
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return NextResponse.json({ error: "Invalid notes." }, { status: 400 });
  }

  const { id } = await params;

  // Application must belong to one of this employer's own postings, and
  // must have had an interview scheduled at some point — evaluating a
  // candidate who was never interviewed doesn't make sense.
  const [existing] = await db
    .select({ id: jobApplications.id, status: jobApplications.status, round: jobApplications.interviewDetails })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(and(eq(jobApplications.id, id), eq(jobPostings.employerProfileId, profile.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!existing.round) {
    return NextResponse.json({ error: "Schedule an interview before evaluating this candidate." }, { status: 400 });
  }

  const [evaluation] = await db
    .insert(interviewEvaluations)
    .values({
      jobApplicationId: id,
      round: existing.round.round,
      scores: parsedScores,
      recommendation: recommendation as (typeof RECOMMENDATIONS)[number],
      notes: notes ? (notes as string).trim() || null : null,
    })
    .onConflictDoUpdate({
      target: interviewEvaluations.jobApplicationId,
      set: {
        round: existing.round.round,
        scores: parsedScores,
        recommendation: recommendation as (typeof RECOMMENDATIONS)[number],
        notes: notes ? (notes as string).trim() || null : null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Saving an evaluation is what closes out "evaluation" — advance the
  // pipeline stage automatically, same pattern as marking attendance closes
  // out "interview". Only when actually at "evaluation" though: don't drag
  // a KIV'd or already-decided application backward into "evaluated", and
  // don't let a save short-circuit past the explicit "start evaluation"
  // step from "interviewed".
  const advancesToEvaluated = existing.status === "evaluation";
  if (advancesToEvaluated) {
    await db.update(jobApplications).set({ status: "evaluated", updatedAt: new Date() }).where(eq(jobApplications.id, id));
  }

  return NextResponse.json({ evaluation, status: advancesToEvaluated ? "evaluated" : existing.status });
}

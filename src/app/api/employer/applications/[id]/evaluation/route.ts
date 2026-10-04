import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { recordStatusChange } from "@/lib/application-events";
import { db } from "@/lib/db";
import { interviewEvaluations, jobApplications, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";
import { getPanelEvaluations } from "@/lib/job-applications";
import { EVALUATION_CRITERIA, isPanelEvaluationComplete, summarizeEvaluations } from "@/lib/interviewEvaluation";

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

// Shared by both handlers: the caller's company access plus the application,
// which must belong to one of that company's own postings.
async function loadContext(id: string) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return { error: NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 }) } as const;
  }
  const access = await getEmployerAccess(session.userId);
  if (!access || !isUuid(id)) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) } as const;

  const [application] = await db
    .select({
      id: jobApplications.id,
      status: jobApplications.status,
      interviewDetails: jobApplications.interviewDetails,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(and(eq(jobApplications.id, id), eq(jobPostings.employerProfileId, access.profile.id)))
    .limit(1);
  if (!application) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) } as const;

  return { userId: session.userId, access, application } as const;
}

async function panelState(employerProfileId: string, application: { id: string; interviewDetails: { round: number } | null }) {
  const evaluations = (await getPanelEvaluations(employerProfileId, [application])).get(application.id) ?? [];
  return { evaluations, evaluation: summarizeEvaluations(evaluations) };
}

// Submit (or update) the caller's own scorecard. Allowed for anyone on the
// interview panel, plus the company's Owners. The application only moves to
// "evaluated" once every panelist has submitted (see isPanelEvaluationComplete).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadContext(id);
  if ("error" in ctx) return ctx.error;
  const { userId, access, application } = ctx;

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

  // Evaluating a candidate who was never interviewed doesn't make sense.
  const details = application.interviewDetails;
  if (!details) {
    return NextResponse.json({ error: "Schedule an interview before evaluating this candidate." }, { status: 400 });
  }

  // An interview scheduled before panel evaluations existed has no linked
  // panel — anyone at the company may score it, as before.
  const panel = details.interviewerUserIds ?? [];
  const onPanel = panel.includes(userId);
  if (panel.length > 0 && !onPanel && access.role !== "owner") {
    return NextResponse.json(
      { error: "Only interviewers on this panel (or an Owner) can evaluate this candidate." },
      { status: 403 },
    );
  }

  const values = {
    round: details.round,
    scores: parsedScores,
    recommendation: recommendation as (typeof RECOMMENDATIONS)[number],
    notes: notes ? (notes as string).trim() || null : null,
  };
  await db
    .insert(interviewEvaluations)
    .values({ jobApplicationId: id, evaluatorUserId: userId, ...values })
    .onConflictDoUpdate({
      target: [interviewEvaluations.jobApplicationId, interviewEvaluations.evaluatorUserId],
      set: { ...values, updatedAt: new Date() },
    });

  const state = await panelState(access.profile.id, application);

  // Only advance from "evaluation" itself: don't drag a KIV'd or
  // already-decided application backward, and don't skip past the explicit
  // "start evaluation" step from "interviewed".
  let status = application.status;
  if (application.status === "evaluation" && isPanelEvaluationComplete(details.interviewerUserIds, state.evaluations)) {
    await db.update(jobApplications).set({ status: "evaluated", updatedAt: new Date() }).where(eq(jobApplications.id, id));
    await recordStatusChange(id, "evaluation", "evaluated");
    status = "evaluated";
  }

  return NextResponse.json({ ...state, status });
}

// Owner override: close out the evaluation now, without waiting for the rest
// of the panel (e.g. an interviewer left the company). Needs at least one
// scorecard, so "evaluated" never means "nobody evaluated".
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadContext(id);
  if ("error" in ctx) return ctx.error;
  const { access, application } = ctx;

  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only an Owner can complete an evaluation early." }, { status: 403 });
  }
  if (application.status !== "evaluation") {
    return NextResponse.json({ error: "This candidate isn't in the evaluation stage." }, { status: 400 });
  }

  const state = await panelState(access.profile.id, application);
  if (state.evaluations.length === 0) {
    return NextResponse.json({ error: "At least one interviewer needs to submit an evaluation first." }, { status: 400 });
  }

  await db.update(jobApplications).set({ status: "evaluated", updatedAt: new Date() }).where(eq(jobApplications.id, id));
  await recordStatusChange(id, "evaluation", "evaluated");
  return NextResponse.json({ ...state, status: "evaluated" });
}

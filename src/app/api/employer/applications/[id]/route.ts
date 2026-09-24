import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

const SETTABLE_STATUSES = [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "interviewed",
  "evaluation",
  "kiv",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

const INTERVIEW_MODES = ["onsite", "online", "phone"] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

type InterviewDetails = {
  round: number;
  mode: (typeof INTERVIEW_MODES)[number];
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingLink: string | null;
  interviewerName: string | null;
  notes: string | null;
};

function parseInterviewDetails(value: unknown): InterviewDetails | null | "invalid" {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "object") return "invalid";
  const v = value as Record<string, unknown>;

  if (typeof v.round !== "number" || !Number.isInteger(v.round) || v.round < 1) return "invalid";
  if (typeof v.mode !== "string" || !(INTERVIEW_MODES as readonly string[]).includes(v.mode)) return "invalid";
  if (!isNonEmptyString(v.scheduledAt) || Number.isNaN(Date.parse(v.scheduledAt))) return "invalid";
  if (v.durationMinutes !== null && (typeof v.durationMinutes !== "number" || v.durationMinutes <= 0)) {
    return "invalid";
  }
  if (!isOptionalString(v.location) || !isOptionalString(v.meetingLink)) return "invalid";
  if (!isOptionalString(v.interviewerName) || !isOptionalString(v.notes)) return "invalid";
  if (v.mode === "onsite" && !isNonEmptyString(v.location)) return "invalid";
  if (v.mode === "online" && !isNonEmptyString(v.meetingLink)) return "invalid";

  return {
    round: v.round,
    mode: v.mode as (typeof INTERVIEW_MODES)[number],
    scheduledAt: new Date(v.scheduledAt as string).toISOString(),
    durationMinutes: (v.durationMinutes as number | null) ?? null,
    location: isNonEmptyString(v.location) ? (v.location as string).trim() : null,
    meetingLink: isNonEmptyString(v.meetingLink) ? (v.meetingLink as string).trim() : null,
    interviewerName: isNonEmptyString(v.interviewerName) ? (v.interviewerName as string).trim() : null,
    notes: isNonEmptyString(v.notes) ? (v.notes as string).trim() : null,
  };
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
  const { status, interviewDetails, interviewResponseStatus } = (body ?? {}) as Record<string, unknown>;
  if (typeof status !== "string" || !(SETTABLE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const parsedInterviewDetails = parseInterviewDetails(interviewDetails);
  if (parsedInterviewDetails === "invalid") {
    return NextResponse.json({ error: "Invalid interview details." }, { status: 400 });
  }
  // The employer can only ever mark attended/no-show directly —
  // accepted/declined/reschedule_requested are the jobseeker's own response,
  // set via their own endpoint, never spoofable through this one.
  const EMPLOYER_SETTABLE_RESPONSE_STATUSES = ["attended", "no_show"];
  if (interviewResponseStatus !== undefined && !EMPLOYER_SETTABLE_RESPONSE_STATUSES.includes(interviewResponseStatus as string)) {
    return NextResponse.json({ error: "Invalid interview response status." }, { status: 400 });
  }

  const { id } = await params;

  // Application must belong to one of this employer's own postings —
  // checked via a join rather than trusting the id alone.
  const [existing] = await db
    .select({ id: jobApplications.id, status: jobApplications.status })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(and(eq(jobApplications.id, id), eq(jobPostings.employerProfileId, profile.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // A transition INTO "interview" from any other stage must bring real
  // scheduling details — otherwise the application would read as "interview
  // scheduled" with nothing actually scheduled. Already being at "interview"
  // is exempt (e.g. marking attendance re-sends status:"interview" without
  // touching interviewDetails at all).
  if (status === "interview" && existing.status !== "interview" && !parsedInterviewDetails) {
    return NextResponse.json({ error: "Set up the interview details first." }, { status: 400 });
  }
  // "Evaluation" only makes sense as the explicit next step right after
  // attendance was marked — it's how the employer signals "I'm starting the
  // evaluation now" so the candidate doesn't just sit forgotten as
  // "Interviewed". Blocking any other source keeps it meaningful instead of
  // a status that can be jumped to from anywhere.
  if (status === "evaluation" && existing.status !== "interviewed") {
    return NextResponse.json({ error: "Mark attendance before starting the evaluation." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    status: status as (typeof SETTABLE_STATUSES)[number],
    updatedAt: new Date(),
  };
  if (interviewDetails !== undefined) {
    updates.interviewDetails = parsedInterviewDetails;
    // Scheduling or rescheduling an interview always resets the jobseeker's
    // response and attendance confirmation; leaving the interview stage
    // entirely clears them.
    updates.interviewResponseStatus = parsedInterviewDetails ? "pending" : null;
    updates.jobseekerConfirmedAttendance = false;
  }
  if (interviewResponseStatus === "attended" || interviewResponseStatus === "no_show") {
    updates.interviewResponseStatus = interviewResponseStatus;
    // Marking attendance is what actually closes out the scheduled round —
    // advance the pipeline stage automatically rather than making the
    // employer make a separate "mark as interviewed" click.
    updates.status = "interviewed";
  }
  // Only stamp hiredAt on the actual transition into "hired" — a re-save
  // while already hired (e.g. editing something unrelated later) shouldn't
  // push the hire date forward.
  if (updates.status === "hired" && existing.status !== "hired") {
    updates.hiredAt = new Date();
  }

  const [updated] = await db.update(jobApplications).set(updates).where(eq(jobApplications.id, id)).returning();

  return NextResponse.json({ application: updated });
}

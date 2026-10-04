import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobseekerProfiles } from "@/lib/db/schema";
import { getApplicationNotificationContext, getEmployerTeamUserIds, notify } from "@/lib/notifications";
import { getSession } from "@/lib/session";

const RESPONSES = ["accepted", "declined", "reschedule_requested"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { response } = (body ?? {}) as Record<string, unknown>;
  if (typeof response !== "string" || !(RESPONSES as readonly string[]).includes(response)) {
    return NextResponse.json({ error: "Invalid response." }, { status: 400 });
  }

  const { id } = await params;

  // Application must belong to this jobseeker, currently be in the
  // interview stage, and still be awaiting their response — an already
  // accepted/declined/no-show response can't be overwritten from here.
  const [existing] = await db
    .select({ id: jobApplications.id, status: jobApplications.status, interviewResponseStatus: jobApplications.interviewResponseStatus })
    .from(jobApplications)
    .where(and(eq(jobApplications.id, id), eq(jobApplications.jobseekerProfileId, profile.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.status !== "interview" || existing.interviewResponseStatus !== "pending") {
    return NextResponse.json({ error: "This interview invite can't be responded to right now." }, { status: 400 });
  }

  const [updated] = await db
    .update(jobApplications)
    .set({ interviewResponseStatus: response as (typeof RESPONSES)[number], updatedAt: new Date() })
    .where(eq(jobApplications.id, id))
    .returning();

  // Tell whoever's running the interview — the panel if there is one,
  // otherwise the whole hiring team.
  const ctx = await getApplicationNotificationContext(id);
  if (ctx) {
    const panel = updated.interviewDetails?.interviewerUserIds ?? [];
    const recipients = panel.length > 0 ? panel : await getEmployerTeamUserIds(ctx.employerProfileId, ctx.ownerUserId);
    const verb =
      response === "accepted"
        ? "accepted"
        : response === "declined"
          ? "declined"
          : "asked to reschedule";
    await notify(recipients, "employer", {
      type: `interview_${response}`,
      title: `${ctx.applicantName} ${verb} the interview`,
      body: ctx.postingTitle,
      link: "/employer/interviews",
    });
  }

  return NextResponse.json({ application: updated });
}

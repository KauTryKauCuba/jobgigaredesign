import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostingReports, jobPostingReportReasonEnum, jobPostings } from "@/lib/db/schema";
import { getJobseekerProfileId } from "@/lib/job-applications";
import { getSession } from "@/lib/session";

const REPORT_REASONS = jobPostingReportReasonEnum.enumValues;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// One report per jobseeker per posting (see the unique constraint on
// jobPostingReports) — re-reporting the same posting updates the existing
// row instead of erroring, in case the jobseeker wants to change their
// reason. This only logs the report for superadmin's Reports queue; it
// never flags the posting by itself.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const jobseekerProfileId = await getJobseekerProfileId(session.userId);
  if (!jobseekerProfileId) {
    return NextResponse.json({ error: "Finish your profile before reporting a posting." }, { status: 400 });
  }

  const { id } = await params;
  const [posting] = await db.select({ id: jobPostings.id }).from(jobPostings).where(eq(jobPostings.id, id)).limit(1);
  if (!posting) return NextResponse.json({ error: "This posting no longer exists." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { reason, details } = (body ?? {}) as Record<string, unknown>;

  if (typeof reason !== "string" || !(REPORT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "Choose a reason for reporting this posting." }, { status: 400 });
  }

  const values = {
    jobPostingId: id,
    jobseekerProfileId,
    reason: reason as (typeof REPORT_REASONS)[number],
    details: isNonEmptyString(details) ? details.trim() : null,
  };

  await db
    .insert(jobPostingReports)
    .values(values)
    .onConflictDoUpdate({
      target: [jobPostingReports.jobPostingId, jobPostingReports.jobseekerProfileId],
      set: { reason: values.reason, details: values.details, createdAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { getSession } from "@/lib/session";

// Employer-wide applications across every posting — for the chat assistant's
// stat questions (interviews today, applicants to screen, etc). Trimmed down
// to just what a count/lookup needs, not the full applicant profile fields
// getApplicationsForEmployer also returns.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ applications: [] });

  const rows = await getApplicationsForEmployer(access.profile.id);
  const applications = rows.map((r) => ({
    jobPostingId: r.jobPostingId,
    jobPostingTitle: r.jobPostingTitle,
    applicantName: r.applicantName,
    applicantLocation: r.applicantLocation,
    status: r.application.status,
    appliedAt: r.application.appliedAt,
    interviewDetails: r.application.interviewDetails,
  }));

  return NextResponse.json({ applications });
}

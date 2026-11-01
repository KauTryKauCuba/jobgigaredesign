import { NextResponse } from "next/server";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { reviewsUsedToday, runResumeReview } from "@/lib/resume-review";
import { getSession } from "@/lib/session";

// Runs a Resume Review on the signed-in jobseeker's current resume. Takes a
// few seconds (one AI call); the page shows progress meanwhile.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker to review your resume." }, { status: 401 });
  }
  const profile = await getJobseekerProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 400 });

  const outcome = await runResumeReview({ userId: session.userId, profileId: profile.id });
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error, usedToday: await reviewsUsedToday(profile.id) }, { status: outcome.status });
  }
  return NextResponse.json({
    result: outcome.result,
    createdAt: new Date().toISOString(),
    usedToday: await reviewsUsedToday(profile.id),
  });
}

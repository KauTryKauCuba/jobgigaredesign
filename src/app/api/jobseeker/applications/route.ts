import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobPostings, jobseekerProfiles } from "@/lib/db/schema";
import { isLanguageArray, isOptionalInt, isOptionalString } from "@/lib/job-posting-validation";
import { screeningEligibilityCheck } from "@/lib/matching";
import { getSession } from "@/lib/session";

function isCustomAnswerArray(value: unknown): value is { questionId: string; answer: boolean }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === "object" &&
        typeof (v as Record<string, unknown>).questionId === "string" &&
        typeof (v as Record<string, unknown>).answer === "boolean",
    )
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Sign in as a jobseeker to apply." }, { status: 401 });
  }

  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Finish your profile before applying." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { jobPostingId, screeningAnswers } = (body ?? {}) as Record<string, unknown>;
  if (typeof jobPostingId !== "string" || !jobPostingId) {
    return NextResponse.json({ error: "Missing job posting." }, { status: 400 });
  }

  const [posting] = await db
    .select({
      id: jobPostings.id,
      status: jobPostings.status,
      screeningEnabled: jobPostings.screeningEnabled,
      minYearsExperience: jobPostings.minYearsExperience,
      minQualificationTier: jobPostings.minQualificationTier,
      drivingLicense: jobPostings.drivingLicense,
      languages: jobPostings.languages,
      workAuthorizations: jobPostings.workAuthorizations,
      customScreeningQuestions: jobPostings.customScreeningQuestions,
    })
    .from(jobPostings)
    .where(eq(jobPostings.id, jobPostingId))
    .limit(1);
  if (!posting || posting.status !== "active") {
    return NextResponse.json({ error: "This posting isn't accepting applications." }, { status: 400 });
  }

  // Only trusted when the posting actually has screening on — a jobseeker
  // (or a stale client) can't force eligibility to be computed/stored for a
  // posting the employer never gated.
  let storedAnswers: {
    yearsExperience: number | null;
    qualificationTier: string | null;
    drivingLicense: string | null;
    languages: { language: string; level: string }[];
    workAuthorization: string | null;
    customAnswers: { questionId: string; answer: boolean }[];
  } | null = null;
  let eligible: boolean | null = null;
  if (posting.screeningEnabled) {
    const raw = (screeningAnswers ?? {}) as Record<string, unknown>;
    const yearsExperience = isOptionalInt(raw.yearsExperience) ? (raw.yearsExperience ?? null) : null;
    const qualificationTier = isOptionalString(raw.qualificationTier) ? (raw.qualificationTier ?? null) : null;
    const drivingLicense = isOptionalString(raw.drivingLicense) ? (raw.drivingLicense ?? null) : null;
    const languages = isLanguageArray(raw.languages) ? raw.languages : [];
    const workAuthorization = isOptionalString(raw.workAuthorization) ? (raw.workAuthorization ?? null) : null;
    const customAnswers = isCustomAnswerArray(raw.customAnswers) ? raw.customAnswers : [];
    storedAnswers = { yearsExperience, qualificationTier, drivingLicense, languages, workAuthorization, customAnswers };
    eligible = screeningEligibilityCheck(
      {
        minYearsExperience: posting.minYearsExperience,
        minQualificationTier: posting.minQualificationTier,
        drivingLicense: posting.drivingLicense,
        languages: posting.languages,
        workAuthorizations: posting.workAuthorizations,
        customQuestions: posting.customScreeningQuestions,
      },
      storedAnswers,
    ).eligible;
  }

  const [existing] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(
      and(eq(jobApplications.jobPostingId, jobPostingId), eq(jobApplications.jobseekerProfileId, profile.id)),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyApplied: true });
  }

  await db.insert(jobApplications).values({
    jobPostingId,
    jobseekerProfileId: profile.id,
    screeningAnswers: storedAnswers,
    screeningEligible: eligible,
  });
  return NextResponse.json({ ok: true });
}

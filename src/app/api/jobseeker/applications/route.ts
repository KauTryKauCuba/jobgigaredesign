import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { recordStatusChange } from "@/lib/application-events";
import { getApplicationNotificationContext, getJobNotificationRecipients, notify } from "@/lib/notifications";
import { db } from "@/lib/db";
import { jobApplications, jobPostings, jobseekerProfiles } from "@/lib/db/schema";
import { isLanguageArray, isOptionalInt, isOptionalString } from "@/lib/job-posting-validation";
import { screeningEligibilityCheck } from "@/lib/matching";
import type { CustomAnswer } from "@/lib/screening-questions";
import { getSession } from "@/lib/session";

// One answer per question; which field is filled depends on the question's type.
function isCustomAnswerArray(value: unknown): value is CustomAnswer[] {
  return (
    Array.isArray(value) &&
    value.every((v) => {
      if (!v || typeof v !== "object") return false;
      const a = v as Record<string, unknown>;
      return (
        typeof a.questionId === "string" &&
        (a.answer === undefined || typeof a.answer === "boolean") &&
        (a.choice === undefined || (typeof a.choice === "string" && a.choice.length <= 200)) &&
        (a.number === undefined || a.number === null || (typeof a.number === "number" && Number.isFinite(a.number))) &&
        (a.text === undefined || (typeof a.text === "string" && a.text.length <= 1000))
      );
    })
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
      askLanguages: jobPostings.askLanguages,
      workAuthorizations: jobPostings.workAuthorizations,
      customScreeningQuestions: jobPostings.customScreeningQuestions,
      screeningPreferred: jobPostings.screeningPreferred,
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
    // One per requirement: its language, its dialect (null for "any"), the level given.
    languages: { language: string; dialect?: string | null; level: string }[];
    workAuthorization: string | null;
    customAnswers: CustomAnswer[];
  } | null = null;
  let eligible: boolean | null = null;
  let preferredMet: number | null = null;
  let preferredTotal: number | null = null;
  if (posting.screeningEnabled) {
    const raw = (screeningAnswers ?? {}) as Record<string, unknown>;
    const yearsExperience = isOptionalInt(raw.yearsExperience) ? (raw.yearsExperience ?? null) : null;
    const qualificationTier = isOptionalString(raw.qualificationTier) ? (raw.qualificationTier ?? null) : null;
    const drivingLicense = isOptionalString(raw.drivingLicense) ? (raw.drivingLicense ?? null) : null;
    const languages = isLanguageArray(raw.languages) ? raw.languages : [];
    const workAuthorization = isOptionalString(raw.workAuthorization) ? (raw.workAuthorization ?? null) : null;
    const customAnswers = isCustomAnswerArray(raw.customAnswers) ? raw.customAnswers : [];
    storedAnswers = { yearsExperience, qualificationTier, drivingLicense, languages, workAuthorization, customAnswers };
    const check = screeningEligibilityCheck(
      {
        preferred: posting.screeningPreferred,
        minYearsExperience: posting.minYearsExperience,
        minQualificationTier: posting.minQualificationTier,
        drivingLicense: posting.drivingLicense,
        // Languages are always on the posting now; they only screen
        // applicants when the employer switched "Ask this" on for them.
        languages: posting.askLanguages ? posting.languages : [],
        workAuthorizations: posting.workAuthorizations,
        customQuestions: posting.customScreeningQuestions,
      },
      storedAnswers,
    );
    eligible = check.eligible;
    preferredMet = check.preferredMet;
    preferredTotal = check.preferredTotal;
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

  const [created] = await db
    .insert(jobApplications)
    .values({
      jobPostingId,
      jobseekerProfileId: profile.id,
      screeningAnswers: storedAnswers,
      screeningEligible: eligible,
      screeningPreferredMet: preferredMet,
      screeningPreferredTotal: preferredTotal,
    })
    .returning({ id: jobApplications.id });
  await recordStatusChange(created.id, null, "applied");

  const ctx = await getApplicationNotificationContext(created.id);
  if (ctx) {
    // Owners/Admins, plus this posting's own Hiring managers.
    await notify(await getJobNotificationRecipients(ctx.employerProfileId, ctx.ownerUserId, ctx.postingId), "employer", {
      type: "new_application",
      title: `New applicant for ${ctx.postingTitle}`,
      body: `${ctx.applicantName} just applied.`,
      link: `/employer/applicants?jobId=${ctx.postingId}`,
    });
  }
  return NextResponse.json({ ok: true });
}

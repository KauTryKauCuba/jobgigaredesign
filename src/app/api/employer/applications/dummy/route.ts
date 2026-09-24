import { NextResponse } from "next/server";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  interviewEvaluations,
  jobApplications,
  jobPostings,
  jobseekerCertifications,
  jobseekerEducation,
  jobseekerLanguages,
  jobseekerProfiles,
  jobseekerWorkExperiences,
  users,
} from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";
import {
  DUMMY_APPLICANTS,
  DUMMY_APPLICANT_EMAIL_DOMAIN,
  ROLE_INDUSTRY,
  buildDummyApplicantProfile,
} from "@/lib/dummy-applicants";
import { INDUSTRIES } from "@/lib/industries";
import type { InterviewDetails } from "@/lib/applicationStatus";

async function getEmployerProfileId(userId: string) {
  const access = await getEmployerAccess(userId);
  return access?.profile.id ?? null;
}

// Dummy applicant emails are scoped per-employer (the employerProfileId is
// embedded in the local-part) so one employer clicking "Get dummy data" /
// "Remove dummy data" can never delete or collide with another employer's
// dummy applicants — this used to match every dummy user in the database
// regardless of caller, which meant the last employer to click this button
// silently wiped out everyone else's dummy demo data.
async function deleteDummyApplicants(employerProfileId: string) {
  const dummyUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%.${employerProfileId}@${DUMMY_APPLICANT_EMAIL_DOMAIN}`));
  const dummyUserIds = dummyUsers.map((u) => u.id);
  if (dummyUserIds.length === 0) return;

  // jobseekerProfiles.userId has no onDelete cascade, but job_applications
  // and interview_evaluations both cascade off jobseekerProfiles/
  // jobApplications — so deleting the profiles first cleans up everything
  // this button created, then the users themselves can go.
  await db.delete(jobseekerProfiles).where(inArray(jobseekerProfiles.userId, dummyUserIds));
  await db.delete(users).where(inArray(users.id, dummyUserIds));
}

// Roughly how many days ago an application at this stage would realistically
// have come in — without this, every dummy application gets the exact same
// appliedAt (insert time), so "Recent applicants" shows everyone as "today"
// in an arbitrary tied order, and hired candidates show ~0 days to hire.
const STAGE_DAYS_AGO: Record<string, number> = {
  applied: 2,
  screened: 5,
  shortlisted: 8,
  interview: 6,
  interviewed: 10,
  evaluation: 11,
  evaluated: 12,
  kiv: 18,
  offer: 15,
  hired: 21,
  rejected: 14,
};

function appliedAtFor(status: string, index: number): Date {
  const baseDaysAgo = STAGE_DAYS_AGO[status] ?? 3;
  const jitterDays = index % 4;
  return new Date(Date.now() - (baseDaysAgo + jitterDays) * 24 * 60 * 60 * 1000);
}

// Hired some number of days after they applied — never before appliedAt,
// and always at least a day so time-to-hire never shows as 0.
function hiredAtFor(appliedAt: Date, index: number): Date {
  const daysToHire = 3 + (index % 6);
  return new Date(appliedAt.getTime() + daysToHire * 24 * 60 * 60 * 1000);
}

// One interview per day (scheduleIndex maps 1:1 to a day offset, wrapping
// after 28 days so everything stays within "this month") at a rotating time
// slot — so the Interviews page's calendar and "Today" / "This week" /
// "This month" tiles each land at least one hit, and dummy interviews don't
// all pile onto the same date/time the way a single fixed +3-days slot did.
const INTERVIEW_HOURS = [9, 11, 14, 16] as const;

function fakeInterviewDetails(round: number, scheduleIndex: number): InterviewDetails {
  const daysFromNow = scheduleIndex % 28;
  const hour = INTERVIEW_HOURS[scheduleIndex % INTERVIEW_HOURS.length];
  const scheduledAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  scheduledAt.setHours(hour, 0, 0, 0);
  return {
    round,
    mode: "online",
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes: 45,
    location: null,
    meetingLink: "https://meet.google.com/dummy-interview",
    interviewerName: null,
    notes: null,
  };
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const employerProfileId = await getEmployerProfileId(session.userId);
  if (!employerProfileId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const allPostings = await db
    .select({ id: jobPostings.id, title: jobPostings.title, status: jobPostings.status })
    .from(jobPostings)
    .where(eq(jobPostings.employerProfileId, employerProfileId));
  if (allPostings.length === 0) {
    return NextResponse.json({ error: "Post a job first, then add dummy applicants." }, { status: 400 });
  }

  // Only "active" postings can realistically have applicants — a jobseeker
  // can't apply to a draft or a pending-review posting. Everything else
  // (round-robin fallback included) draws only from this pool, never from
  // draft/pending/closed ones, so dummy applicants never land somewhere
  // they couldn't actually exist.
  const postings = allPostings.filter((p) => p.status === "active");
  if (postings.length === 0) {
    return NextResponse.json({ error: "You need at least one active job posting first." }, { status: 400 });
  }

  // Clean up any leftover dummy applicants from a previous run before
  // creating fresh ones, so repeated clicks stay idempotent.
  await deleteDummyApplicants(employerProfileId);

  // Line each dummy applicant up with an active posting of the same title
  // (the dummy postings' titles match the dummy applicants' target roles
  // 1:1) so "Get dummy data" on Applicants visually lines up with "Get
  // dummy data" on Manage Job. Falls back to round-robin over whatever
  // active postings exist if the matching title isn't active (or doesn't
  // exist) — e.g. the dummy posting for that role is still in draft, or
  // was removed.
  const postingsByTitle = new Map(postings.map((p) => [p.title, p]));

  // Cycled independently per stage (rather than off the shared `i`) so every
  // Interviews page response-status tile — pending / accepted / declined /
  // reschedule_requested / attended / no_show — gets at least one row,
  // regardless of how the DUMMY_APPLICANTS statuses happen to be ordered.
  const INTERVIEW_STAGE_RESPONSES = ["accepted", "pending", "declined", "reschedule_requested"] as const;
  const PAST_INTERVIEW_RESPONSES = ["attended", "attended", "attended", "no_show"] as const;
  let interviewStageIndex = 0;
  let pastInterviewIndex = 0;
  let interviewScheduleIndex = 0;

  for (let i = 0; i < DUMMY_APPLICANTS.length; i++) {
    const applicant = DUMMY_APPLICANTS[i];
    const posting = postingsByTitle.get(applicant.targetRole) ?? postings[i % postings.length];
    const email = `applicant${i + 1}.${employerProfileId}@${DUMMY_APPLICANT_EMAIL_DOMAIN}`;

    const [user] = await db
      .insert(users)
      .values({ email, name: applicant.fullName, role: "jobseeker" })
      .returning({ id: users.id });

    const extras = buildDummyApplicantProfile(applicant, i);

    const [profile] = await db
      .insert(jobseekerProfiles)
      .values({
        userId: user.id,
        // A real (if generic) headshot photo, same service the general
        // seed script uses — clearer to look at than the placeholder icon
        // shown when avatarUrl is unset.
        avatarUrl: `https://i.pravatar.cc/300?img=${(i % 70) + 1}`,
        fullName: applicant.fullName,
        phone: extras.phone,
        dateOfBirth: extras.dateOfBirth,
        gender: extras.gender,
        maritalStatus: extras.maritalStatus,
        nationality: extras.nationality,
        drivingLicense: extras.drivingLicense,
        location: applicant.location,
        targetRole: applicant.targetRole,
        // Aligned to the same industry as the dummy posting for this role
        // (ROLE_INDUSTRY), so industry-match scoring has real signal to
        // demo — falls back to rotating the full list for any role that
        // doesn't have a corresponding dummy posting.
        preferredIndustry: ROLE_INDUSTRY[applicant.targetRole] ?? INDUSTRIES[i % INDUSTRIES.length],
        yearsExperience: applicant.yearsExperience,
        professionalSkills: extras.skills,
        softSkills: extras.softSkills,
        employmentType: applicant.employmentType,
        expectedSalaryMin: applicant.expectedSalaryMin,
        expectedSalaryMax: applicant.expectedSalaryMax,
        bio: applicant.bio,
        noticePeriod: applicant.noticePeriod,
        workArrangement: applicant.workArrangement,
        workAuthorization: applicant.workAuthorization,
      })
      .returning({ id: jobseekerProfiles.id });

    await db.insert(jobseekerEducation).values({
      profileId: profile.id,
      institution: extras.education.institution,
      fieldOfStudy: extras.education.fieldOfStudy,
      qualificationTier: extras.education.qualificationTier,
      graduationYear: extras.education.graduationYear,
      sortOrder: 0,
    });

    if (extras.workExperience) {
      await db.insert(jobseekerWorkExperiences).values({
        profileId: profile.id,
        company: extras.workExperience.company,
        title: extras.workExperience.title,
        startDate: extras.workExperience.startDate,
        isCurrent: true,
        achievements: extras.workExperience.achievements,
        sortOrder: 0,
      });
    }

    if (extras.certification) {
      await db.insert(jobseekerCertifications).values({
        profileId: profile.id,
        name: extras.certification.name,
        issuer: extras.certification.issuer,
        year: extras.certification.year,
        sortOrder: 0,
      });
    }

    await db.insert(jobseekerLanguages).values(
      extras.languages.map((lang, idx) => ({
        profileId: profile.id,
        language: lang.language,
        spokenLevel: lang.spokenLevel,
        writtenLevel: lang.writtenLevel,
        sortOrder: idx,
      })),
    );

    const hasInterview =
      applicant.status === "interview" ||
      applicant.status === "interviewed" ||
      applicant.status === "evaluation" ||
      applicant.status === "evaluated";
    let interviewResponseStatus: (typeof INTERVIEW_STAGE_RESPONSES)[number] | (typeof PAST_INTERVIEW_RESPONSES)[number] | null = null;
    if (applicant.status === "interview") {
      interviewResponseStatus = INTERVIEW_STAGE_RESPONSES[interviewStageIndex % INTERVIEW_STAGE_RESPONSES.length];
      interviewStageIndex++;
    } else if (hasInterview) {
      interviewResponseStatus = PAST_INTERVIEW_RESPONSES[pastInterviewIndex % PAST_INTERVIEW_RESPONSES.length];
      pastInterviewIndex++;
    }
    const attendedInterview = interviewResponseStatus === "attended";
    const interviewDetails = hasInterview
      ? fakeInterviewDetails(applicant.interviewRound ?? 1, interviewScheduleIndex++)
      : null;

    const appliedAt = appliedAtFor(applicant.status, i);
    // updatedAt otherwise defaults to insert time — for an "offer" this
    // would make the Overview page's "Stale offers" tile always read 0 right
    // after generating dummy data, since every offer would look brand new.
    // Backdating it a few days past appliedAt keeps it consistent with
    // STAGE_DAYS_AGO.offer (15 days) while landing outside the 3-day window.
    const updatedAt = applicant.status === "offer" ? new Date(appliedAt.getTime() + (5 + (i % 4)) * 24 * 60 * 60 * 1000) : undefined;

    const [application] = await db
      .insert(jobApplications)
      .values({
        jobPostingId: posting.id,
        jobseekerProfileId: profile.id,
        status: applicant.status,
        interviewDetails,
        interviewResponseStatus,
        jobseekerConfirmedAttendance:
          (applicant.status === "interviewed" || applicant.status === "evaluation" || applicant.status === "evaluated") &&
          attendedInterview,
        appliedAt,
        updatedAt,
        hiredAt: applicant.status === "hired" ? hiredAtFor(appliedAt, i) : null,
      })
      .returning({ id: jobApplications.id });

    if (applicant.status === "evaluated") {
      await db.insert(interviewEvaluations).values({
        jobApplicationId: application.id,
        round: applicant.interviewRound ?? 1,
        scores: { communication: 4, technicalSkill: 4, problemSolving: 3, cultureFit: 4, roleKnowledge: 4 },
        recommendation: "hire",
        notes: "Dummy evaluation — solid all-round candidate.",
      });
    }
  }

  return NextResponse.json({ ok: true, count: DUMMY_APPLICANTS.length });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const employerProfileId = await getEmployerProfileId(session.userId);
  if (!employerProfileId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await deleteDummyApplicants(employerProfileId);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { copyFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import {
  aiInterviewQuestions,
  aiInterviews,
  employerTeamMembers,
  interviewEvaluations,
  jobApplicationEvents,
  jobApplications,
  jobPostings,
  jobseekerCertifications,
  jobseekerEducation,
  jobseekerLanguages,
  jobseekerProfiles,
  jobseekerWorkExperiences,
  users,
  verifiedPhones,
  videoPitches,
  videoPitchViews,
} from "@/lib/db/schema";
import { installSampleVideoPitch } from "@/lib/video-pitch-storage";
import { AI_INTERVIEW_DIR, deleteAiInterviewMedia } from "@/lib/ai-interview-media";
import { AI_INTERVIEW_RETENTION_DAYS } from "@/lib/ai-interview-shared";
import { DUMMY_AI_INTERVIEWS, DUMMY_AI_QUESTION_SETS, dummyClipName } from "@/lib/dummy-ai-interviews";
import { dummyCustomAnswer } from "@/lib/dummy-screening";
import { getFullEmployerAccess } from "@/lib/employer-profile";
import { screeningEligibilityCheck } from "@/lib/matching";
import { toMalaysianMobileE164 } from "@/lib/phone";
import type { CustomAnswer } from "@/lib/screening-questions";
import { getSession } from "@/lib/session";
import {
  DUMMY_APPLICANTS,
  DUMMY_APPLICANT_EMAIL_DOMAIN,
  ROLE_INDUSTRY,
  buildDummyApplicantProfile,
  cityStateForDummyLocation,
  dummyPreferredWorkPlaces,
} from "@/lib/dummy-applicants";
import { buildDummyTeamEmail, DUMMY_TEAM_EMAIL_DOMAIN, DUMMY_TEAM_ROSTER, slugifyName } from "@/lib/dummy-team";
import { INDUSTRIES } from "@/lib/industries";
import { meetsLanguage } from "@/lib/languages";
import type { InterviewDetails } from "@/lib/applicationStatus";

async function getEmployerProfileId(userId: string) {
  const access = await getFullEmployerAccess(userId);
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

  // AI interview rows go with their applications, but their answer
  // recordings are files — delete those first, while we can still find them.
  const interviews = await db
    .select({ id: aiInterviews.id })
    .from(aiInterviews)
    .innerJoin(jobApplications, eq(jobApplications.id, aiInterviews.jobApplicationId))
    .innerJoin(jobseekerProfiles, eq(jobseekerProfiles.id, jobApplications.jobseekerProfileId))
    .where(inArray(jobseekerProfiles.userId, dummyUserIds));
  await Promise.all(interviews.map((interview) => deleteAiInterviewMedia(interview.id)));

  // jobseekerProfiles.userId has no onDelete cascade, but job_applications,
  // interview_evaluations and ai_interviews all cascade off jobseekerProfiles/
  // jobApplications (and verified_phones off users) — so deleting the
  // profiles first cleans up everything this button created, then the users
  // themselves can go.
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

// Upcoming interviews ("interview" stage) get one per day (scheduleIndex
// maps 1:1 to a day offset, wrapping after 28 days so everything stays
// within "this month") at a rotating time slot — so the Interviews page's
// calendar and "Today" / "This week" / "This month" tiles each land at least
// one hit. Interviews that already happened (interviewed / evaluation /
// evaluated) are dated 1–8 days ago instead — never in the future, and
// always after those stages' application date (STAGE_DAYS_AGO, 10+ days).
const INTERVIEW_HOURS = [9, 11, 14, 16] as const;

type PanelMember = { userId: string; name: string };

function fakeInterviewDetails(round: number, scheduleIndex: number, past: boolean, panel: PanelMember[]): InterviewDetails {
  const days = past ? -(1 + (scheduleIndex % 8)) : scheduleIndex % 28;
  const hour = INTERVIEW_HOURS[scheduleIndex % INTERVIEW_HOURS.length];
  const scheduledAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  scheduledAt.setHours(hour, 0, 0, 0);
  return {
    round,
    mode: "online",
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes: 45,
    location: null,
    meetingLink: "https://meet.google.com/dummy-interview",
    // Same shape the scheduling route saves: the panel's account ids, plus
    // their names in the same order.
    interviewers: panel.map((p) => p.name),
    interviewerUserIds: panel.map((p) => p.userId),
    notes: null,
  };
}

// One interviewer's scorecard — varied a little per panelist and candidate
// so the combined panel result isn't every score identical.
const SCORE_SETS = [
  { communication: 4, technicalSkill: 4, problemSolving: 3, cultureFit: 4, roleKnowledge: 4 },
  { communication: 5, technicalSkill: 4, problemSolving: 4, cultureFit: 5, roleKnowledge: 4 },
  { communication: 3, technicalSkill: 4, problemSolving: 4, cultureFit: 3, roleKnowledge: 3 },
  { communication: 4, technicalSkill: 5, problemSolving: 5, cultureFit: 4, roleKnowledge: 5 },
] as const;
const RECOMMENDATIONS = ["hire", "strong_hire", "hire", "no_hire"] as const;
const EVALUATION_NOTES = [
  "Clear communicator — walked through past work confidently.",
  "Strong problem solving; would ramp up quickly.",
  "Good fundamentals, a little light on hands-on depth.",
  "Solid all-round candidate, good culture fit.",
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// The sample AI interview answers (recorded by
// scripts/generate-dummy-ai-interview-audio.ts) and how long each one runs.
const SAMPLE_CLIP_DIR = path.join(process.cwd(), "assets", "sample-ai-interview");
async function loadSampleClipDurations(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await readFile(path.join(SAMPLE_CLIP_DIR, "durations.json"), "utf8"));
  } catch {
    return {};
  }
}

// Each interview gets its own copy, named like a real answer, so it plays,
// purges and deletes exactly like one. Null if the sample clip is missing.
async function installSampleClip(interviewId: string, clipName: string): Promise<string | null> {
  try {
    const dir = path.join(AI_INTERVIEW_DIR, interviewId);
    await mkdir(dir, { recursive: true });
    const fileName = `${randomUUID()}.m4a`;
    await copyFile(path.join(SAMPLE_CLIP_DIR, clipName), path.join(dir, fileName));
    return fileName;
  } catch {
    return null;
  }
}

/**
 * The sample AI interview for this applicant (DUMMY_AI_INTERVIEWS), timed
 * after they were shortlisted: a finished one was answered the next day and
 * scored a minute later; an open one was sent recently enough to still be open.
 */
async function createDummyAiInterview(params: {
  applicationId: string;
  createdByUserId: string;
  shortlistedAt: Date;
  sample: (typeof DUMMY_AI_INTERVIEWS)[number];
  clipDurations: Record<string, number>;
}) {
  const { sample, shortlistedAt } = params;
  const questions = DUMMY_AI_QUESTION_SETS[sample.jobTitle];
  if (!questions) return;
  const now = Date.now();

  let inviteSentAt: Date;
  let startedAt: Date | null = null;
  if (sample.status === "completed" || sample.status === "expired") {
    inviteSentAt = new Date(shortlistedAt.getTime() + 3 * HOUR_MS);
    if (sample.status === "completed") startedAt = new Date(inviteSentAt.getTime() + 19 * HOUR_MS);
  } else if (sample.status === "in_progress") {
    inviteSentAt = new Date(now - 26 * HOUR_MS);
    startedAt = new Date(now - 3 * HOUR_MS);
  } else {
    inviteSentAt = new Date(now - 5 * HOUR_MS);
  }
  const deadlineAt = new Date(inviteSentAt.getTime() + 3 * DAY_MS);
  // About two minutes per answer, including a re-record now and then.
  const answeredAt = (index: number) => new Date(startedAt!.getTime() + (index + 1) * 2 * 60 * 1000 + index * 17 * 1000);
  const submittedAt = sample.status === "completed" ? new Date(answeredAt(questions.length - 1).getTime() + 40 * 1000) : null;
  const completedAt = submittedAt ? new Date(submittedAt.getTime() + 70 * 1000) : null;

  const [interview] = await db
    .insert(aiInterviews)
    .values({
      jobApplicationId: params.applicationId,
      createdByUserId: params.createdByUserId,
      status: sample.status,
      answerSeconds: sample.answerSeconds,
      deadlineAt,
      inviteSentAt,
      consentAt: startedAt,
      startedAt,
      submittedAt,
      completedAt,
      report: sample.status === "completed" ? (sample.report ?? null) : null,
      recordingsExpireAt: completedAt ? new Date(completedAt.getTime() + AI_INTERVIEW_RETENTION_DAYS * DAY_MS) : null,
      createdAt: inviteSentAt,
      updatedAt: completedAt ?? (startedAt ? answeredAt(sample.answers.length - 1) : inviteSentAt),
    })
    .returning({ id: aiInterviews.id });

  const rows: (typeof aiInterviewQuestions.$inferInsert)[] = [];
  for (let index = 0; index < questions.length; index++) {
    const answer = sample.answers[index];
    const clipName = answer && sample.clipKey ? dummyClipName(sample.clipKey, index + 1) : null;
    const mediaFileName = clipName ? await installSampleClip(interview.id, clipName) : null;
    rows.push({
      aiInterviewId: interview.id,
      position: index + 1,
      question: questions[index].question,
      keyPoints: questions[index].keyPoints,
      createdAt: inviteSentAt,
      ...(answer && startedAt
        ? {
            mediaFileName,
            mediaKind: mediaFileName ? "audio" : null,
            durationSeconds: clipName ? (params.clipDurations[clipName] ?? 20) : null,
            // Now and then someone re-records an answer.
            attempts: index === 2 ? 2 : 1,
            answeredAt: answeredAt(index),
            // Transcribed and scored only once the whole interview is submitted.
            transcript: answer.evaluation ? answer.transcript : null,
            score: answer.evaluation?.score ?? null,
            evaluation: answer.evaluation ?? null,
          }
        : {}),
    });
  }
  await db.insert(aiInterviewQuestions).values(rows);
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const employerProfileId = await getEmployerProfileId(session.userId);
  if (!employerProfileId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const allPostings = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
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

  // Interview panels: whoever is adding the sample data, plus the active
  // sample teammates who work on that job (DUMMY_TEAM_ROSTER jobTitles) —
  // e.g. the Hiring manager and Panel member on the engineering roles. The
  // sample team is added before the applicants (see DummyDataCard), so its
  // accounts exist here; without it, panels are just the current user.
  const [me] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const teammates = await db
    .select({ userId: employerTeamMembers.userId, email: employerTeamMembers.email, name: users.name })
    .from(employerTeamMembers)
    .innerJoin(users, eq(users.id, employerTeamMembers.userId))
    .where(
      and(
        eq(employerTeamMembers.employerProfileId, employerProfileId),
        eq(employerTeamMembers.status, "active"),
        like(employerTeamMembers.email, `%@${DUMMY_TEAM_EMAIL_DOMAIN}`),
      ),
    );
  function panelFor(jobTitle: string): PanelMember[] {
    const panel: PanelMember[] = [{ userId: session!.userId, name: me?.name || me?.email || "Interviewer" }];
    for (const teammate of teammates) {
      const roster = DUMMY_TEAM_ROSTER.find((m) => buildDummyTeamEmail(slugifyName(m.name)) === teammate.email);
      if (teammate.userId && roster?.jobTitles?.includes(jobTitle)) {
        panel.push({ userId: teammate.userId, name: teammate.name || roster.name });
      }
    }
    return panel;
  }

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
  // Every other dummy applicant gets a video pitch — all sharing the one
  // sample clip — so the "Video pitch" badge and panel have data to demo
  // next to applicants without one.
  const samplePitch = await installSampleVideoPitch();
  const clipDurations = await loadSampleClipDurations();

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
        birthYear: extras.birthYear,
        gender: extras.gender,
        maritalStatus: extras.maritalStatus,
        nationality: extras.nationality,
        drivingLicense: extras.drivingLicense,
        location: applicant.location,
        ...cityStateForDummyLocation(applicant.location),
        preferredWorkPlaces: dummyPreferredWorkPlaces(applicant.location),
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

    // About two in three proved their number with a code, a while before
    // they applied — so the "Phone verified" seal shows on some, not all.
    const verifiedPhone = toMalaysianMobileE164(extras.phone);
    if (verifiedPhone && i % 3 !== 2) {
      await db.insert(verifiedPhones).values({
        userId: user.id,
        phone: verifiedPhone,
        verifiedAt: new Date(appliedAtFor(applicant.status, i).getTime() - (2 + (i % 20)) * DAY_MS),
      });
    }

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
        dialects: lang.dialects,
        spokenLevel: lang.spokenLevel,
        writtenLevel: lang.writtenLevel,
        sortOrder: idx,
      })),
    );

    if (i % 2 === 0) {
      const years = applicant.yearsExperience;
      const [pitch] = await db
        .insert(videoPitches)
        .values({
          jobseekerProfileId: profile.id,
          ...samplePitch,
          intro: `${applicant.targetRole} with ${years} year${years === 1 ? "" : "s"} of experience, based in ${applicant.location}.`.slice(0, 150),
          strengths: extras.skills.slice(0, 3),
        })
        .returning({ id: videoPitches.id });
      // Some already watched by this company, to demo the "Watched" mark.
      if (i % 4 === 0) {
        await db.insert(videoPitchViews).values({ videoPitchId: pitch.id, employerProfileId });
      }
    }

    const hasInterview =
      applicant.status === "interview" ||
      applicant.status === "interviewed" ||
      applicant.status === "evaluation" ||
      applicant.status === "evaluated";
    let interviewResponseStatus: (typeof INTERVIEW_STAGE_RESPONSES)[number] | (typeof PAST_INTERVIEW_RESPONSES)[number] | null = null;
    if (applicant.status === "interview") {
      interviewResponseStatus = INTERVIEW_STAGE_RESPONSES[interviewStageIndex % INTERVIEW_STAGE_RESPONSES.length];
      interviewStageIndex++;
    } else if (applicant.status === "interviewed") {
      // Marking attendance (attended or no-show) is what moves a real
      // application to "interviewed" — so that's the only stage a no-show
      // can sit at; anyone further along was evaluated, so they attended.
      interviewResponseStatus = PAST_INTERVIEW_RESPONSES[pastInterviewIndex % PAST_INTERVIEW_RESPONSES.length];
      pastInterviewIndex++;
    } else if (hasInterview) {
      interviewResponseStatus = "attended";
    }
    const attendedInterview = interviewResponseStatus === "attended";
    const panel = panelFor(posting.title);
    const interviewDetails = hasInterview
      ? fakeInterviewDetails(applicant.interviewRound ?? 1, interviewScheduleIndex++, applicant.status !== "interview", panel)
      : null;

    // Only the dummy postings with screeningEnabled on (Frontend Engineer,
    // Registered Nurse, Temporary Event Crew) demo screeningEligible-based
    // matching — every other posting leaves these fields null, same as a
    // real application to a non-screened posting.
    let screeningAnswers: {
      yearsExperience: number | null;
      qualificationTier: string | null;
      drivingLicense: string | null;
      languages: { language: string; dialect?: string | null; level: string }[];
      workAuthorization: string | null;
      customAnswers: CustomAnswer[];
    } | null = null;
    let screeningEligible: boolean | null = null;
    let screeningPreferredMet: number | null = null;
    let screeningPreferredTotal: number | null = null;
    if (posting.screeningEnabled) {
      screeningAnswers = {
        yearsExperience: applicant.yearsExperience,
        qualificationTier: extras.education.qualificationTier,
        drivingLicense: extras.drivingLicense,
        // Answered honestly, one per requirement: their level, if they speak
        // that language (and the dialect, when one is asked for).
        languages: posting.languages.flatMap((required) => {
          const spoken = extras.languages.find((l) => meetsLanguage(required, l));
          return spoken ? [{ language: required.language, dialect: required.dialect ?? null, level: spoken.spokenLevel }] : [];
        }),
        workAuthorization: applicant.workAuthorization,
        // Answered honestly against the applicant's own profile rather than
        // always "yes" — e.g. only someone who wants to work fully remote
        // says no to the hybrid schedule.
        customAnswers: posting.customScreeningQuestions.map((q) =>
          dummyCustomAnswer(q, {
            index: i,
            fullName: applicant.fullName,
            location: applicant.location,
            yearsExperience: applicant.yearsExperience,
            workArrangement: applicant.workArrangement,
            noticePeriod: applicant.noticePeriod,
            drivingLicense: extras.drivingLicense,
          }),
        ),
      };
      const check = screeningEligibilityCheck(
        {
          preferred: posting.screeningPreferred,
          minYearsExperience: posting.minYearsExperience,
          minQualificationTier: posting.minQualificationTier,
          drivingLicense: posting.drivingLicense,
          languages: posting.askLanguages ? posting.languages : [],
          workAuthorizations: posting.workAuthorizations,
          customQuestions: posting.customScreeningQuestions,
        },
        screeningAnswers,
      );
      screeningEligible = check.eligible;
      screeningPreferredMet = check.preferredMet;
      screeningPreferredTotal = check.preferredTotal;
    }

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
        screeningAnswers,
        screeningEligible,
        screeningPreferredMet,
        screeningPreferredTotal,
        appliedAt,
        updatedAt,
        hiredAt: applicant.status === "hired" ? hiredAtFor(appliedAt, i) : null,
      })
      .returning({ id: jobApplications.id });

    // History for the jobseeker's tracker and the employer's reply-time
    // badge: the application itself, then (if it's moved on) one step to its
    // current stage, 1–3 days later — never in the future.
    const events: (typeof jobApplicationEvents.$inferInsert)[] = [
      { jobApplicationId: application.id, fromStatus: null, toStatus: "applied", createdAt: appliedAt },
    ];
    let movedOnAt: Date | null = null;
    if (applicant.status !== "applied") {
      // A stage after an interview that already happened is reached just
      // after that interview, not before it.
      const pastInterviewAt =
        interviewDetails && applicant.status !== "interview" ? new Date(interviewDetails.scheduledAt).getTime() : null;
      const respondedAt = new Date(
        Math.min(
          Date.now(),
          pastInterviewAt ? pastInterviewAt + 2 * 60 * 60 * 1000 : appliedAt.getTime() + (1 + (i % 3)) * 24 * 60 * 60 * 1000,
        ),
      );
      events.push({ jobApplicationId: application.id, fromStatus: "applied", toStatus: applicant.status, createdAt: respondedAt });
      movedOnAt = respondedAt;
    }
    await db.insert(jobApplicationEvents).values(events);

    // A few shortlisted applicants were sent an AI interview after being
    // shortlisted (only shortlisted ones can be) — on the job it was written for.
    const aiSample = DUMMY_AI_INTERVIEWS.find((s) => s.applicantName === applicant.fullName);
    if (aiSample && applicant.status === "shortlisted" && posting.title === aiSample.jobTitle && movedOnAt) {
      await createDummyAiInterview({
        applicationId: application.id,
        createdByUserId: session.userId,
        shortlistedAt: movedOnAt,
        sample: aiSample,
        clipDurations,
      });
    }

    // Panel scorecards: "evaluated" = every panelist has submitted (what
    // moves a real application there); "evaluation" = only the first one
    // has, so it shows as waiting on the rest — when there's a rest to wait
    // on, otherwise it'd already be complete.
    const evaluators =
      applicant.status === "evaluated" ? panel : applicant.status === "evaluation" && panel.length > 1 ? panel.slice(0, 1) : [];
    if (evaluators.length > 0) {
      await db.insert(interviewEvaluations).values(
        evaluators.map((member, j) => ({
          jobApplicationId: application.id,
          evaluatorUserId: member.userId,
          round: applicant.interviewRound ?? 1,
          scores: { ...SCORE_SETS[(i + j) % SCORE_SETS.length] },
          recommendation: RECOMMENDATIONS[(i + j) % RECOMMENDATIONS.length],
          notes: EVALUATION_NOTES[(i + j) % EVALUATION_NOTES.length],
        })),
      );
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

import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { getEmployerResponsiveness } from "./application-events";
import { db } from "./db";
import {
  coverLetters,
  employerAddresses,
  employerProfiles,
  jobApplications,
  jobPostings,
  jobseekerProfiles,
  savedJobs,
  users,
  videoPitches,
} from "./db/schema";

export async function getJobseekersForSuperadmin() {
  const [rows, applicationCounts, savedCounts, coverLetterCounts, pitches] = await Promise.all([
    db
      .select({
        id: jobseekerProfiles.id,
        userId: users.id,
        fullName: jobseekerProfiles.fullName,
        avatarUrl: jobseekerProfiles.avatarUrl,
        email: users.email,
        phone: jobseekerProfiles.phone,
        location: jobseekerProfiles.location,
        targetRole: jobseekerProfiles.targetRole,
        jobAlertsEnabled: jobseekerProfiles.jobAlertsEnabled,
        createdAt: jobseekerProfiles.createdAt,
      })
      .from(jobseekerProfiles)
      .innerJoin(users, eq(jobseekerProfiles.userId, users.id))
      .orderBy(desc(jobseekerProfiles.createdAt)),
    db
      .select({ profileId: jobApplications.jobseekerProfileId, value: count() })
      .from(jobApplications)
      .groupBy(jobApplications.jobseekerProfileId),
    db
      .select({ profileId: savedJobs.jobseekerProfileId, value: count() })
      .from(savedJobs)
      .groupBy(savedJobs.jobseekerProfileId),
    db
      .select({ profileId: coverLetters.jobseekerProfileId, value: count() })
      .from(coverLetters)
      .groupBy(coverLetters.jobseekerProfileId),
    db
      .select({
        profileId: videoPitches.jobseekerProfileId,
        id: videoPitches.id,
        durationSeconds: videoPitches.durationSeconds,
        visible: videoPitches.visible,
        intro: videoPitches.intro,
        updatedAt: videoPitches.updatedAt,
      })
      .from(videoPitches),
  ]);

  const byProfile = (list: { profileId: string; value: number }[]) => new Map(list.map((r) => [r.profileId, r.value]));
  const applicationsById = byProfile(applicationCounts);
  const savedById = byProfile(savedCounts);
  const coverLettersById = byProfile(coverLetterCounts);
  const pitchById = new Map(pitches.map(({ profileId, ...pitch }) => [profileId, pitch]));

  return rows.map((row) => ({
    ...row,
    applicationCount: applicationsById.get(row.id) ?? 0,
    savedJobCount: savedById.get(row.id) ?? 0,
    coverLetterCount: coverLettersById.get(row.id) ?? 0,
    videoPitch: pitchById.get(row.id) ?? null,
  }));
}

// Applications sitting untouched at "applied" for 3+ days count as "waiting"
// — same threshold as the anti-ghosting badge.
const WAITING_AFTER_HOURS = 72;

export async function getEmployersForSuperadmin() {
  const [rows, postingCounts, applicationStats] = await Promise.all([
    db
      .select({
        id: employerProfiles.id,
        userId: users.id,
        companyName: employerProfiles.companyName,
        logoUrl: employerProfiles.logoUrl,
        contactName: employerProfiles.contactName,
        contactEmail: employerProfiles.contactEmail,
        email: users.email,
        industry: employerProfiles.industry,
        location: sql<string>`(
          select ${employerAddresses.city} || ', ' || ${employerAddresses.state}
          from ${employerAddresses}
          where ${employerAddresses.employerProfileId} = ${employerProfiles.id}
          order by ${employerAddresses.createdAt} asc
          limit 1
        )`.as("location"),
        createdAt: employerProfiles.createdAt,
      })
      .from(employerProfiles)
      .innerJoin(users, eq(employerProfiles.userId, users.id))
      .orderBy(desc(employerProfiles.createdAt)),
    db
      .select({ employerProfileId: jobPostings.employerProfileId, value: count() })
      .from(jobPostings)
      .groupBy(jobPostings.employerProfileId),
    db
      .select({
        employerProfileId: jobPostings.employerProfileId,
        applications: sql<number>`count(*)::int`,
        waitingLong: sql<number>`count(*) filter (
          where ${jobApplications.status} = 'applied'
            and ${jobApplications.appliedAt} < now() - make_interval(hours => ${WAITING_AFTER_HOURS})
        )::int`,
      })
      .from(jobApplications)
      .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
      .groupBy(jobPostings.employerProfileId),
  ]);

  const postingCountById = new Map(postingCounts.map((r) => [r.employerProfileId, r.value]));
  const statsById = new Map(applicationStats.map((r) => [r.employerProfileId, r]));
  const responsiveness = await getEmployerResponsiveness(rows.map((r) => r.id));

  return rows.map((row) => ({
    ...row,
    jobPostingCount: postingCountById.get(row.id) ?? 0,
    applicationCount: statsById.get(row.id)?.applications ?? 0,
    waitingLong: statsById.get(row.id)?.waitingLong ?? 0,
    responsiveness: responsiveness.get(row.id) ?? null,
  }));
}

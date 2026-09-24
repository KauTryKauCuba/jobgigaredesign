import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  jobseekerCertifications,
  jobseekerEducation,
  jobseekerLanguages,
  jobseekerProfiles,
  jobseekerReferences,
  jobseekerWorkExperiences,
} from "./db/schema";

/**
 * Everything from onboarding, for the dashboard's read-only profile summary
 * card — the full profile row (minus `resumeUrl`, which is a potentially
 * multi-MB data URL with no reason to load just to show a summary) plus its
 * related work experience/education/certification/language entries, each in
 * the same order the user arranged them in during onboarding.
 */
const PROFILE_COLUMNS = {
  id: jobseekerProfiles.id,
  avatarUrl: jobseekerProfiles.avatarUrl,
  fullName: jobseekerProfiles.fullName,
  dateOfBirth: jobseekerProfiles.dateOfBirth,
  gender: jobseekerProfiles.gender,
  maritalStatus: jobseekerProfiles.maritalStatus,
  nationality: jobseekerProfiles.nationality,
  phone: jobseekerProfiles.phone,
  drivingLicense: jobseekerProfiles.drivingLicense,
  resumeFileName: jobseekerProfiles.resumeFileName,
  resumeFileSize: jobseekerProfiles.resumeFileSize,
  location: jobseekerProfiles.location,
  targetRole: jobseekerProfiles.targetRole,
  preferredIndustry: jobseekerProfiles.preferredIndustry,
  yearsExperience: jobseekerProfiles.yearsExperience,
  professionalSkills: jobseekerProfiles.professionalSkills,
  softSkills: jobseekerProfiles.softSkills,
  employmentType: jobseekerProfiles.employmentType,
  expectedSalaryMin: jobseekerProfiles.expectedSalaryMin,
  expectedSalaryMax: jobseekerProfiles.expectedSalaryMax,
  bio: jobseekerProfiles.bio,
  linkedinUrl: jobseekerProfiles.linkedinUrl,
  portfolioUrl: jobseekerProfiles.portfolioUrl,
  githubUrl: jobseekerProfiles.githubUrl,
  noticePeriod: jobseekerProfiles.noticePeriod,
  workArrangement: jobseekerProfiles.workArrangement,
  workAuthorization: jobseekerProfiles.workAuthorization,
};

async function attachProfileRelations<T extends { id: string }>(profile: T) {
  const [workExperiences, education, certifications, languages, references] = await Promise.all([
    db
      .select()
      .from(jobseekerWorkExperiences)
      .where(eq(jobseekerWorkExperiences.profileId, profile.id))
      .orderBy(asc(jobseekerWorkExperiences.sortOrder)),
    db
      .select()
      .from(jobseekerEducation)
      .where(eq(jobseekerEducation.profileId, profile.id))
      .orderBy(asc(jobseekerEducation.sortOrder)),
    db
      .select()
      .from(jobseekerCertifications)
      .where(eq(jobseekerCertifications.profileId, profile.id))
      .orderBy(asc(jobseekerCertifications.sortOrder)),
    db
      .select()
      .from(jobseekerLanguages)
      .where(eq(jobseekerLanguages.profileId, profile.id))
      .orderBy(asc(jobseekerLanguages.sortOrder)),
    db
      .select()
      .from(jobseekerReferences)
      .where(eq(jobseekerReferences.profileId, profile.id))
      .orderBy(asc(jobseekerReferences.sortOrder)),
  ]);

  return { ...profile, workExperiences, education, certifications, languages, references };
}

export async function getJobseekerProfile(userId: string) {
  const [profile] = await db
    .select(PROFILE_COLUMNS)
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  if (!profile) return null;
  return attachProfileRelations(profile);
}

// For the employer side — an applicant's full profile (work history,
// education, certifications, languages, everything), looked up by
// jobseeker_profile_id rather than userId since that's what an application
// row points at. The caller is responsible for checking the employer
// actually owns the posting this application belongs to before calling this.
export async function getJobseekerProfileById(profileId: string) {
  const [profile] = await db
    .select({ ...PROFILE_COLUMNS, resumeUrl: jobseekerProfiles.resumeUrl })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.id, profileId))
    .limit(1);
  if (!profile) return null;
  return attachProfileRelations(profile);
}

export type JobseekerProfile = NonNullable<Awaited<ReturnType<typeof getJobseekerProfile>>>;

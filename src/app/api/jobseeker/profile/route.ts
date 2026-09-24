import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jobseekerProfiles,
  jobseekerWorkExperiences,
  jobseekerEducation,
  jobseekerCertifications,
  jobseekerLanguages,
  jobseekerReferences,
  jobseekerOnboardingDrafts,
} from "@/lib/db/schema";
import { INDUSTRIES } from "@/lib/industries";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
const WORK_AUTHORIZATIONS = [
  "citizen",
  "permanent_resident",
  "work_pass_holder",
  "needs_sponsorship",
] as const;
const NOTICE_PERIODS = [
  "immediate",
  "one_week",
  "two_weeks",
  "one_month",
  "two_months",
  "more_than_two_months",
] as const;
const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "prefer_not_to_say"] as const;
const DRIVING_LICENSES = ["none", "b2", "b", "d", "da", "e"] as const;
const DATE_OF_BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type WorkExperienceInput = {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  achievements: string | null;
};

function parseWorkExperiences(value: unknown): WorkExperienceInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: WorkExperienceInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(entry.company) || !isNonEmptyString(entry.title) || !isNonEmptyString(entry.startDate)) {
      return null;
    }
    entries.push({
      company: entry.company.trim(),
      title: entry.title.trim(),
      startDate: entry.startDate.trim(),
      endDate: isNonEmptyString(entry.endDate) ? entry.endDate.trim() : null,
      isCurrent: entry.isCurrent === true,
      achievements: isNonEmptyString(entry.achievements) ? sanitizeDescriptionHtml(entry.achievements.trim()) : null,
    });
  }
  return entries;
}

type EducationInput = {
  institution: string;
  fieldOfStudy: string | null;
  qualificationTier: string;
  cgpa: string | null;
  graduationYear: number | null;
};

function parseEducation(value: unknown): EducationInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: EducationInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(entry.institution) || !isNonEmptyString(entry.qualificationTier)) {
      return null;
    }
    entries.push({
      institution: entry.institution.trim(),
      fieldOfStudy: isNonEmptyString(entry.fieldOfStudy) ? entry.fieldOfStudy.trim() : null,
      qualificationTier: entry.qualificationTier.trim(),
      cgpa: isNonEmptyString(entry.cgpa) ? entry.cgpa.trim() : null,
      graduationYear: isNonNegativeInt(entry.graduationYear) ? entry.graduationYear : null,
    });
  }
  return entries;
}

type CertificationInput = {
  name: string;
  issuer: string | null;
  year: number | null;
};

function parseCertifications(value: unknown): CertificationInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: CertificationInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(entry.name)) return null;
    entries.push({
      name: entry.name.trim(),
      issuer: isNonEmptyString(entry.issuer) ? entry.issuer.trim() : null,
      year: isNonNegativeInt(entry.year) ? entry.year : null,
    });
  }
  return entries;
}

type ReferenceInput = {
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
};

function parseReferences(value: unknown): ReferenceInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: ReferenceInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(entry.fullName)) return null;
    if (isNonEmptyString(entry.email) && !isValidEmail(entry.email)) return null;
    entries.push({
      fullName: entry.fullName.trim(),
      jobTitle: isNonEmptyString(entry.jobTitle) ? entry.jobTitle.trim() : null,
      company: isNonEmptyString(entry.company) ? entry.company.trim() : null,
      phone: isNonEmptyString(entry.phone) ? entry.phone.trim() : null,
      email: isNonEmptyString(entry.email) ? entry.email.trim().toLowerCase() : null,
    });
  }
  return entries;
}

type LanguageInput = {
  language: string;
  spokenLevel: (typeof LANGUAGE_LEVELS)[number];
  writtenLevel: (typeof LANGUAGE_LEVELS)[number];
};

function parseLanguages(value: unknown): LanguageInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: LanguageInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (
      !isNonEmptyString(entry.language) ||
      !isOneOf(entry.spokenLevel, LANGUAGE_LEVELS) ||
      !isOneOf(entry.writtenLevel, LANGUAGE_LEVELS)
    ) {
      return null;
    }
    entries.push({
      language: entry.language.trim(),
      spokenLevel: entry.spokenLevel,
      writtenLevel: entry.writtenLevel,
    });
  }
  return entries;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    avatarUrl,
    fullName,
    resumeUrl,
    resumeFileName,
    resumeFileSize,
    dateOfBirth,
    gender,
    maritalStatus,
    nationality,
    phone,
    drivingLicense,
    location,
    targetRole,
    preferredIndustry,
    yearsExperience,
    professionalSkills,
    softSkills,
    employmentType,
    expectedSalaryMin,
    expectedSalaryMax,
    bio,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    noticePeriod,
    workArrangement,
    workAuthorization,
    workExperiences: rawWorkExperiences,
    education: rawEducation,
    certifications: rawCertifications,
    languages: rawLanguages,
    references: rawReferences,
  } = (body ?? {}) as Record<string, unknown>;

  if (!isOptionalString(avatarUrl) || (typeof avatarUrl === "string" && avatarUrl.length > 6_000_000)) {
    return NextResponse.json({ error: "Invalid profile photo." }, { status: 400 });
  }
  // 14MB covers a 10MB resume (this app's upload cap) inflated ~33% by
  // base64 encoding, plus the data URL prefix.
  if (!isOptionalString(resumeUrl) || (typeof resumeUrl === "string" && resumeUrl.length > 14_000_000)) {
    return NextResponse.json({ error: "Invalid resume file." }, { status: 400 });
  }
  if (!isOptionalString(resumeFileName)) {
    return NextResponse.json({ error: "Invalid resume file." }, { status: 400 });
  }
  if (resumeFileSize !== undefined && resumeFileSize !== null && !isNonNegativeInt(resumeFileSize)) {
    return NextResponse.json({ error: "Invalid resume file." }, { status: 400 });
  }
  if (!isNonEmptyString(fullName)) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (isNonEmptyString(dateOfBirth) && !DATE_OF_BIRTH_RE.test(dateOfBirth.trim())) {
    return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
  }
  if (gender !== undefined && gender !== null && !isOneOf(gender, GENDERS)) {
    return NextResponse.json({ error: "Invalid gender." }, { status: 400 });
  }
  if (
    maritalStatus !== undefined &&
    maritalStatus !== null &&
    !isOneOf(maritalStatus, MARITAL_STATUSES)
  ) {
    return NextResponse.json({ error: "Invalid marital status." }, { status: 400 });
  }
  if (!isOptionalString(nationality) || !isOptionalString(phone)) {
    return NextResponse.json({ error: "Invalid contact details." }, { status: 400 });
  }
  if (
    drivingLicense !== undefined &&
    drivingLicense !== null &&
    !isOneOf(drivingLicense, DRIVING_LICENSES)
  ) {
    return NextResponse.json({ error: "Invalid driving license." }, { status: 400 });
  }
  if (!isNonEmptyString(location)) {
    return NextResponse.json({ error: "Enter your location." }, { status: 400 });
  }
  if (!isNonEmptyString(targetRole)) {
    return NextResponse.json({ error: "Enter the role you're targeting." }, { status: 400 });
  }
  if (!isOneOf(preferredIndustry, INDUSTRIES)) {
    return NextResponse.json({ error: "Choose your preferred industry." }, { status: 400 });
  }
  if (!isNonNegativeInt(yearsExperience)) {
    return NextResponse.json({ error: "Enter your years of experience." }, { status: 400 });
  }
  if (
    !Array.isArray(professionalSkills) ||
    professionalSkills.length === 0 ||
    !professionalSkills.every(isNonEmptyString)
  ) {
    return NextResponse.json({ error: "Add at least one professional skill." }, { status: 400 });
  }
  if (!Array.isArray(softSkills) || !softSkills.every(isNonEmptyString)) {
    return NextResponse.json({ error: "Invalid soft skills." }, { status: 400 });
  }
  if (!isOneOf(employmentType, EMPLOYMENT_TYPES)) {
    return NextResponse.json({ error: "Choose an employment type." }, { status: 400 });
  }
  if (!isNonNegativeInt(expectedSalaryMin) || !isNonNegativeInt(expectedSalaryMax)) {
    return NextResponse.json({ error: "Enter your expected salary range." }, { status: 400 });
  }
  if (expectedSalaryMin > expectedSalaryMax) {
    return NextResponse.json(
      { error: "Minimum salary can't be higher than the maximum." },
      { status: 400 },
    );
  }
  if (!isOptionalString(bio) || !isOptionalString(linkedinUrl) || !isOptionalString(portfolioUrl) || !isOptionalString(githubUrl)) {
    return NextResponse.json({ error: "Invalid profile details." }, { status: 400 });
  }
  if (!isOneOf(noticePeriod, NOTICE_PERIODS)) {
    return NextResponse.json({ error: "Choose your notice period." }, { status: 400 });
  }
  if (!isOneOf(workArrangement, WORK_ARRANGEMENTS)) {
    return NextResponse.json({ error: "Choose a work arrangement." }, { status: 400 });
  }
  if (!isOneOf(workAuthorization, WORK_AUTHORIZATIONS)) {
    return NextResponse.json({ error: "Choose your work authorization." }, { status: 400 });
  }

  const workExperiences = parseWorkExperiences(rawWorkExperiences ?? []);
  if (!workExperiences) {
    return NextResponse.json({ error: "Check your work experience entries." }, { status: 400 });
  }
  const education = parseEducation(rawEducation ?? []);
  if (!education) {
    return NextResponse.json({ error: "Check your education entries." }, { status: 400 });
  }
  const certifications = parseCertifications(rawCertifications ?? []);
  if (!certifications) {
    return NextResponse.json({ error: "Check your certification entries." }, { status: 400 });
  }
  const languages = parseLanguages(rawLanguages ?? []);
  if (!languages) {
    return NextResponse.json({ error: "Check your language entries." }, { status: 400 });
  }
  const references = parseReferences(rawReferences ?? []);
  if (!references) {
    return NextResponse.json({ error: "Check your reference entries." }, { status: 400 });
  }

  // A freshly-picked resume has real bytes to save; an edit save where the
  // user didn't touch the resume sends none — in that case the existing
  // stored resume (referenced via the table's own column, not overwritten)
  // must survive rather than being nulled out.
  const hasNewResume = isNonEmptyString(resumeUrl);

  const baseValues = {
    userId: session.userId,
    avatarUrl: isNonEmptyString(avatarUrl) ? avatarUrl.trim() : null,
    fullName: fullName.trim(),
    dateOfBirth: isNonEmptyString(dateOfBirth) ? dateOfBirth.trim() : null,
    gender: isNonEmptyString(gender) ? gender : null,
    maritalStatus: isNonEmptyString(maritalStatus) ? maritalStatus : null,
    nationality: isNonEmptyString(nationality) ? nationality.trim() : null,
    phone: isNonEmptyString(phone) ? phone.trim() : null,
    drivingLicense: isNonEmptyString(drivingLicense) ? drivingLicense : null,
    location: location.trim(),
    targetRole: targetRole.trim(),
    preferredIndustry,
    yearsExperience,
    professionalSkills: professionalSkills.map((s) => s.trim()),
    softSkills: softSkills.map((s) => s.trim()),
    employmentType,
    expectedSalaryMin,
    expectedSalaryMax,
    bio: isNonEmptyString(bio) ? sanitizeDescriptionHtml(bio.trim()) : null,
    linkedinUrl: isNonEmptyString(linkedinUrl) ? linkedinUrl.trim() : null,
    portfolioUrl: isNonEmptyString(portfolioUrl) ? portfolioUrl.trim() : null,
    githubUrl: isNonEmptyString(githubUrl) ? githubUrl.trim() : null,
    noticePeriod,
    workArrangement,
    workAuthorization,
  };

  const insertValues = {
    ...baseValues,
    resumeUrl: hasNewResume ? (resumeUrl as string).trim() : null,
    resumeFileName: isNonEmptyString(resumeFileName) ? resumeFileName.trim() : null,
    resumeFileSize: isNonNegativeInt(resumeFileSize) ? resumeFileSize : null,
  };

  const updateValues = {
    ...baseValues,
    updatedAt: new Date(),
    resumeUrl: hasNewResume ? (resumeUrl as string).trim() : sql`${jobseekerProfiles.resumeUrl}`,
    resumeFileName: hasNewResume
      ? isNonEmptyString(resumeFileName)
        ? resumeFileName.trim()
        : null
      : sql`${jobseekerProfiles.resumeFileName}`,
    resumeFileSize: hasNewResume
      ? isNonNegativeInt(resumeFileSize)
        ? resumeFileSize
        : null
      : sql`${jobseekerProfiles.resumeFileSize}`,
  };

  await db.transaction(async (tx) => {
    // Upsert rather than insert-only — this same endpoint also saves edits
    // made from the post-onboarding "My Profile" page, where a row for this
    // user already exists.
    const [profile] = await tx
      .insert(jobseekerProfiles)
      .values(insertValues)
      .onConflictDoUpdate({ target: jobseekerProfiles.userId, set: updateValues })
      .returning({ id: jobseekerProfiles.id });

    // Related entries are replaced wholesale rather than diffed — simpler,
    // and cheap enough at this scale, and it's how a fresh onboarding save
    // already behaved (insert-only, nothing to replace yet).
    await tx.delete(jobseekerWorkExperiences).where(eq(jobseekerWorkExperiences.profileId, profile.id));
    await tx.delete(jobseekerEducation).where(eq(jobseekerEducation.profileId, profile.id));
    await tx.delete(jobseekerCertifications).where(eq(jobseekerCertifications.profileId, profile.id));
    await tx.delete(jobseekerLanguages).where(eq(jobseekerLanguages.profileId, profile.id));
    await tx.delete(jobseekerReferences).where(eq(jobseekerReferences.profileId, profile.id));

    if (workExperiences.length > 0) {
      await tx.insert(jobseekerWorkExperiences).values(
        workExperiences.map((entry, index) => ({
          profileId: profile.id,
          company: entry.company,
          title: entry.title,
          startDate: entry.startDate,
          endDate: entry.endDate,
          isCurrent: entry.isCurrent,
          achievements: entry.achievements,
          sortOrder: index,
        })),
      );
    }

    if (education.length > 0) {
      await tx.insert(jobseekerEducation).values(
        education.map((entry, index) => ({
          profileId: profile.id,
          institution: entry.institution,
          fieldOfStudy: entry.fieldOfStudy,
          qualificationTier: entry.qualificationTier,
          cgpa: entry.cgpa,
          graduationYear: entry.graduationYear,
          sortOrder: index,
        })),
      );
    }

    if (certifications.length > 0) {
      await tx.insert(jobseekerCertifications).values(
        certifications.map((entry, index) => ({
          profileId: profile.id,
          name: entry.name,
          issuer: entry.issuer,
          year: entry.year,
          sortOrder: index,
        })),
      );
    }

    if (languages.length > 0) {
      await tx.insert(jobseekerLanguages).values(
        languages.map((entry, index) => ({
          profileId: profile.id,
          language: entry.language,
          spokenLevel: entry.spokenLevel,
          writtenLevel: entry.writtenLevel,
          sortOrder: index,
        })),
      );
    }

    if (references.length > 0) {
      await tx.insert(jobseekerReferences).values(
        references.map((entry, index) => ({
          profileId: profile.id,
          fullName: entry.fullName,
          jobTitle: entry.jobTitle,
          company: entry.company,
          phone: entry.phone,
          email: entry.email,
          sortOrder: index,
        })),
      );
    }

    await tx.delete(jobseekerOnboardingDrafts).where(eq(jobseekerOnboardingDrafts.userId, session.userId));
  });

  return NextResponse.json({ ok: true });
}

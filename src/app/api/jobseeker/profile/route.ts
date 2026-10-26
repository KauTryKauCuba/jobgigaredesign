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
import { birthYearFromAge, MAX_AGE, MIN_AGE, parseAge } from "@/lib/age";
import { DEFAULT_COUNTRY, isCountry } from "@/lib/countries";
import { listMalaysianTowns } from "@/lib/postcodes";
import { AREA_MAX, formatPlace, isMalaysiaCoordinate, MAX_WORK_PLACES, type Place, type WorkPlace } from "@/lib/work-locations";
import { INDUSTRIES } from "@/lib/industries";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";
import { isBase64DataUrl, saveBase64Upload } from "@/lib/uploads";
import { normalizeSpokenLanguages } from "@/lib/languages";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "freelance", "temporary"] as const;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// A place from the place search: an official town in its state, an optional
// area name, optional coordinates (inside Malaysia) — or null if it doesn't fit.
function parsePlace(value: unknown): Place | null {
  const { city, state, area, lat, lng } = (value ?? {}) as Record<string, unknown>;
  const town = listMalaysianTowns().find((t) => t.city === city && t.state === state);
  if (!town) return null;
  if (area !== null && area !== undefined && (typeof area !== "string" || area.trim().length > AREA_MAX)) return null;
  const hasCoords = lat !== null && lat !== undefined;
  if (hasCoords && !isMalaysiaCoordinate(lat, lng)) return null;
  return {
    area: typeof area === "string" && area.trim() ? area.trim() : null,
    city: town.city,
    state: town.state,
    lat: hasCoords ? (lat as number) : null,
    lng: hasCoords ? (lng as number) : null,
  };
}

// Preferred work locations: each a valid place, no repeats, at most
// MAX_WORK_PLACES — or null if anything doesn't fit.
function parseWorkPlaces(value: unknown): WorkPlace[] | null {
  if (!Array.isArray(value) || value.length > MAX_WORK_PLACES) return null;
  const out: WorkPlace[] = [];
  for (const item of value) {
    const place = parsePlace(item);
    if (!place) return null;
    if (!out.some((p) => formatPlace(p) === formatPlace(place))) out.push(place);
  }
  return out;
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
  // Either an existing "/uploads/certificates/..." URL (unchanged) or a fresh
  // "data:...;base64,..." picked client-side — resolved to a stored URL
  // later, the same way the avatar and resume are.
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
};

function parseCertifications(value: unknown): CertificationInput[] | null {
  if (!Array.isArray(value)) return null;
  const entries: CertificationInput[] = [];
  for (const raw of value) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(entry.name)) return null;
    // 7MB covers a 5MB certificate file (this app's upload cap for it)
    // inflated ~33% by base64 encoding, plus the data URL prefix.
    if (!isOptionalString(entry.fileUrl) || (typeof entry.fileUrl === "string" && entry.fileUrl.length > 7_000_000)) {
      return null;
    }
    if (!isOptionalString(entry.fileName)) return null;
    if (entry.fileSize !== undefined && entry.fileSize !== null && !isNonNegativeInt(entry.fileSize)) return null;
    entries.push({
      name: entry.name.trim(),
      issuer: isNonEmptyString(entry.issuer) ? entry.issuer.trim() : null,
      year: isNonNegativeInt(entry.year) ? entry.year : null,
      fileUrl: isNonEmptyString(entry.fileUrl) ? entry.fileUrl : null,
      fileName: isNonEmptyString(entry.fileName) ? entry.fileName.trim() : null,
      fileSize: isNonNegativeInt(entry.fileSize) ? entry.fileSize : null,
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
  dialects: string[];
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
      !isOneOf(entry.writtenLevel, LANGUAGE_LEVELS) ||
      (entry.dialects !== undefined && !(Array.isArray(entry.dialects) && entry.dialects.every((d) => typeof d === "string")))
    ) {
      return null;
    }
    entries.push({
      language: entry.language.trim(),
      dialects: (entry.dialects as string[] | undefined) ?? [],
      spokenLevel: entry.spokenLevel,
      writtenLevel: entry.writtenLevel,
    });
  }
  // Standard names ("BM" → Malay), each language once with its dialects —
  // a dialect not on the list for that language is dropped.
  return normalizeSpokenLanguages(entries);
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
    age,
    gender,
    maritalStatus,
    nationality,
    phone,
    drivingLicense,
    city,
    state,
    country,
    area,
    latitude,
    longitude,
    targetRole,
    preferredIndustry,
    yearsExperience,
    professionalSkills,
    softSkills,
    otherSkills,
    employmentType,
    expectedSalaryMin,
    expectedSalaryMax,
    bio,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    noticePeriod,
    workArrangement,
    preferredWorkPlaces,
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
  const parsedAge = parseAge(age);
  if (parsedAge === null) {
    return NextResponse.json({ error: `Enter your age (${MIN_AGE}–${MAX_AGE}).` }, { status: 400 });
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
  // Older callers (e.g. the Resume Designer before country existed) send no
  // country — that means Malaysia, as it always did.
  const countryName = country === undefined || country === null || country === "" ? DEFAULT_COUNTRY : country;
  if (!isCountry(countryName)) {
    return NextResponse.json({ error: "Choose your country." }, { status: 400 });
  }
  const inMalaysia = countryName === DEFAULT_COUNTRY;
  if (!isNonEmptyString(city)) {
    return NextResponse.json({ error: "Enter your city." }, { status: 400 });
  }
  // A state only applies in Malaysia.
  if (inMalaysia && (!isNonEmptyString(state) || !(MALAYSIA_STATES as readonly string[]).includes(state))) {
    return NextResponse.json({ error: "Choose your state." }, { status: 400 });
  }
  const savedState = inMalaysia ? (state as string) : "";
  // The area and map coordinates from the place search (Malaysia only). Older
  // callers (the Resume Designer) don't send them — then they stay as saved.
  let savedArea: string | null | undefined;
  let savedLatitude: number | null | undefined;
  let savedLongitude: number | null | undefined;
  if (!inMalaysia) {
    savedArea = savedLatitude = savedLongitude = null;
  } else if (area !== undefined || latitude !== undefined || longitude !== undefined) {
    if (area !== null && area !== undefined && (typeof area !== "string" || area.trim().length > AREA_MAX)) {
      return NextResponse.json({ error: "Invalid area." }, { status: 400 });
    }
    const hasCoords = latitude !== null && latitude !== undefined;
    if (hasCoords && !isMalaysiaCoordinate(latitude, longitude)) {
      return NextResponse.json({ error: "Invalid location." }, { status: 400 });
    }
    savedArea = typeof area === "string" && area.trim() ? area.trim() : null;
    savedLatitude = hasCoords ? (latitude as number) : null;
    savedLongitude = hasCoords ? (longitude as number) : null;
  }
  const areaForLabel =
    savedArea !== undefined
      ? savedArea
      : ((
          await db
            .select({ area: jobseekerProfiles.area })
            .from(jobseekerProfiles)
            .where(eq(jobseekerProfiles.userId, session.userId))
            .limit(1)
        )[0]?.area ?? null);
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
  if (!Array.isArray(otherSkills) || !otherSkills.every(isNonEmptyString)) {
    return NextResponse.json({ error: "Invalid other skills." }, { status: 400 });
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
  // Compulsory when sent (the profile form always sends it); left as it is
  // when not, so older callers like the Resume Designer keep working.
  const workPlaces = preferredWorkPlaces === undefined ? null : parseWorkPlaces(preferredWorkPlaces);
  if (preferredWorkPlaces !== undefined && workPlaces === null) {
    return NextResponse.json({ error: "Pick each preferred work location from the list." }, { status: 400 });
  }
  if (workPlaces !== null && workPlaces.length === 0) {
    return NextResponse.json({ error: "Add at least one preferred work location." }, { status: 400 });
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

  // Both arrive as either a `data:...;base64,...` string (freshly picked by
  // the browser) or an existing `/uploads/...` URL (unchanged from a
  // previous save) — only the former needs writing to disk. Storing the
  // base64 string itself in Postgres is what caused the Applicants/
  // Interviews page bloat found earlier this session.
  const resolvedAvatarUrl = isBase64DataUrl(avatarUrl) ? await saveBase64Upload(avatarUrl, "avatars") : avatarUrl;
  const resolvedResumeUrl = isBase64DataUrl(resumeUrl) ? await saveBase64Upload(resumeUrl, "resumes") : resumeUrl;
  const resolvedCertifications = await Promise.all(
    certifications.map(async (c) => ({
      ...c,
      fileUrl: isBase64DataUrl(c.fileUrl) ? await saveBase64Upload(c.fileUrl, "certificates") : c.fileUrl,
    })),
  );

  // A freshly-picked resume has real bytes to save; an edit save where the
  // user didn't touch the resume sends none — in that case the existing
  // stored resume (referenced via the table's own column, not overwritten)
  // must survive rather than being nulled out.
  const hasNewResume = isNonEmptyString(resolvedResumeUrl);

  const baseValues = {
    userId: session.userId,
    avatarUrl: isNonEmptyString(resolvedAvatarUrl) ? resolvedAvatarUrl.trim() : null,
    fullName: fullName.trim(),
    birthYear: birthYearFromAge(parsedAge),
    gender: isNonEmptyString(gender) ? gender : null,
    maritalStatus: isNonEmptyString(maritalStatus) ? maritalStatus : null,
    nationality: isNonEmptyString(nationality) ? nationality.trim() : null,
    phone: isNonEmptyString(phone) ? phone.trim() : null,
    drivingLicense: isNonEmptyString(drivingLicense) ? drivingLicense : null,
    // "Kota Damansara, Petaling Jaya, Selangor" in Malaysia ("Setapak, Kuala
    // Lumpur" when the town is the state); "London, United Kingdom" — or just
    // "Singapore" when the city is the country — elsewhere.
    location: inMalaysia
      ? formatPlace({ area: areaForLabel, city: city.trim(), state: savedState as Place["state"] })
      : city.trim().toLowerCase() === countryName.toLowerCase()
        ? city.trim()
        : `${city.trim()}, ${countryName}`,
    city: city.trim(),
    state: savedState,
    country: countryName,
    area: savedArea,
    latitude: savedLatitude,
    longitude: savedLongitude,
    targetRole: targetRole.trim(),
    preferredIndustry,
    yearsExperience,
    professionalSkills: professionalSkills.map((s) => s.trim()),
    softSkills: softSkills.map((s) => s.trim()),
    otherSkills: otherSkills.map((s) => s.trim()),
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
    // Left as it is when not sent (older callers, e.g. the Resume Designer).
    preferredWorkPlaces: workPlaces ?? undefined,
  };

  const insertValues = {
    ...baseValues,
    resumeUrl: hasNewResume ? (resolvedResumeUrl as string).trim() : null,
    resumeFileName: isNonEmptyString(resumeFileName) ? resumeFileName.trim() : null,
    resumeFileSize: isNonNegativeInt(resumeFileSize) ? resumeFileSize : null,
  };

  const updateValues = {
    ...baseValues,
    updatedAt: new Date(),
    resumeUrl: hasNewResume ? (resolvedResumeUrl as string).trim() : sql`${jobseekerProfiles.resumeUrl}`,
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
        resolvedCertifications.map((entry, index) => ({
          profileId: profile.id,
          name: entry.name,
          issuer: entry.issuer,
          year: entry.year,
          fileUrl: entry.fileUrl,
          fileName: entry.fileName,
          fileSize: entry.fileSize,
          sortOrder: index,
        })),
      );
    }

    if (languages.length > 0) {
      await tx.insert(jobseekerLanguages).values(
        languages.map((entry, index) => ({
          profileId: profile.id,
          language: entry.language,
          dialects: entry.dialects,
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

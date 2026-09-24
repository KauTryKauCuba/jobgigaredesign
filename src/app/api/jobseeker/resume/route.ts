import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { db } from "@/lib/db";
import {
  jobseekerCertifications,
  jobseekerEducation,
  jobseekerLanguages,
  jobseekerProfiles,
  jobseekerReferences,
  jobseekerWorkExperiences,
} from "@/lib/db/schema";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { plainTextToHtml } from "@/lib/richText";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import {
  RESUME_MAX_BYTES,
  fileToDataUrl,
  isSupportedResumeFile,
  parseResumeFile,
  type ParsedProfile,
} from "@/lib/resume-parser";
import { getSession } from "@/lib/session";

// Fills only fields the profile doesn't already have, never overwrites
// something the jobseeker already filled in — same rule the onboarding
// form's resume parser follows, just applied straight to the saved profile
// instead of in-progress form state.
function mergeScalar<T>(current: T | null | undefined, parsed: T | null): { value: T | null | undefined; filled: boolean } {
  const isEmpty = current === null || current === undefined || (typeof current === "string" && current.trim() === "");
  if (isEmpty && parsed !== null) return { value: parsed, filled: true };
  return { value: current, filled: false };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  const profile = await getJobseekerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a resume file." }, { status: 400 });
  }
  if (file.size > RESUME_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large — max 10 MB." }, { status: 400 });
  }
  if (!isSupportedResumeFile(file)) {
    return NextResponse.json({ error: "Only PDF or DOCX resumes are supported." }, { status: 400 });
  }

  const [result, buffer] = await Promise.all([parseResumeFile(file), file.arrayBuffer().then(Buffer.from)]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAiUsage({
    userId: session.userId,
    feature: "resume_parse",
    provider: "deepseek",
    model: "deepseek-chat",
    usage: result.usage,
    durationMs: result.durationMs,
  });

  const parsed: ParsedProfile = result.profile;
  let filledCount = 0;
  const mark = (filled: boolean) => {
    if (filled) filledCount++;
  };

  const fullName = mergeScalar(profile.fullName, parsed.fullName);
  const dateOfBirth = mergeScalar(profile.dateOfBirth, parsed.dateOfBirth);
  const gender = mergeScalar(profile.gender, parsed.gender);
  const maritalStatus = mergeScalar(profile.maritalStatus, parsed.maritalStatus);
  const nationality = mergeScalar(profile.nationality, parsed.nationality);
  const phone = mergeScalar(profile.phone, parsed.phone);
  const drivingLicense = mergeScalar(profile.drivingLicense, parsed.drivingLicense);
  const location = mergeScalar(profile.location, parsed.location);
  const targetRole = mergeScalar(profile.targetRole, parsed.targetRole);
  const yearsExperience = mergeScalar(profile.yearsExperience, parsed.yearsExperience);
  const employmentType = mergeScalar(profile.employmentType, parsed.employmentType);
  const expectedSalaryMin = mergeScalar(profile.expectedSalaryMin, parsed.expectedSalaryMin);
  const expectedSalaryMax = mergeScalar(profile.expectedSalaryMax, parsed.expectedSalaryMax);
  const bio = mergeScalar(profile.bio, parsed.bio);
  const linkedinUrl = mergeScalar(profile.linkedinUrl, parsed.linkedinUrl);
  const portfolioUrl = mergeScalar(profile.portfolioUrl, parsed.portfolioUrl);
  const githubUrl = mergeScalar(profile.githubUrl, parsed.githubUrl);
  const avatarUrl = mergeScalar(profile.avatarUrl, result.photoUrl);
  [
    fullName,
    dateOfBirth,
    gender,
    maritalStatus,
    nationality,
    phone,
    drivingLicense,
    location,
    targetRole,
    yearsExperience,
    employmentType,
    expectedSalaryMin,
    expectedSalaryMax,
    bio,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    avatarUrl,
  ].forEach((r) => mark(r.filled));

  const professionalSkills = Array.from(new Set([...profile.professionalSkills, ...parsed.professionalSkills]));
  if (parsed.professionalSkills.length > 0) mark(true);
  const softSkills = Array.from(new Set([...profile.softSkills, ...parsed.softSkills]));
  if (parsed.softSkills.length > 0) mark(true);

  const workExperiences = [
    ...profile.workExperiences.map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      achievements: e.achievements,
    })),
    // The AI parse's achievements are plain text (real "\n" line breaks) —
    // converted to safe HTML before it ever lands in the same column as the
    // rich-text-edited rows above.
    ...parsed.workExperiences.map((e) => ({
      ...e,
      achievements: e.achievements ? sanitizeDescriptionHtml(plainTextToHtml(e.achievements)) : null,
    })),
  ];
  if (parsed.workExperiences.length > 0) mark(true);

  const education = [
    ...profile.education.map((e) => ({
      institution: e.institution,
      fieldOfStudy: e.fieldOfStudy,
      qualificationTier: e.qualificationTier,
      cgpa: e.cgpa,
      graduationYear: e.graduationYear,
    })),
    ...parsed.education,
  ];
  if (parsed.education.length > 0) mark(true);

  const certifications = [
    ...profile.certifications.map((e) => ({ name: e.name, issuer: e.issuer, year: e.year })),
    ...parsed.certifications,
  ];
  if (parsed.certifications.length > 0) mark(true);

  const languages = [
    ...profile.languages.map((e) => ({
      language: e.language,
      spokenLevel: e.spokenLevel,
      writtenLevel: e.writtenLevel,
    })),
    ...parsed.languages,
  ];
  if (parsed.languages.length > 0) mark(true);

  const references = [
    ...profile.references.map((e) => ({
      fullName: e.fullName,
      jobTitle: e.jobTitle,
      company: e.company,
      phone: e.phone,
      email: e.email,
    })),
    ...parsed.references,
  ];
  if (parsed.references.length > 0) mark(true);

  const resumeUrl = fileToDataUrl(file, buffer);

  await db.transaction(async (tx) => {
    await tx
      .update(jobseekerProfiles)
      .set({
        avatarUrl: avatarUrl.value ?? null,
        fullName: fullName.value ?? profile.fullName,
        dateOfBirth: dateOfBirth.value ?? null,
        gender: gender.value ?? null,
        maritalStatus: maritalStatus.value ?? null,
        nationality: nationality.value ?? null,
        phone: phone.value ?? null,
        drivingLicense: drivingLicense.value ?? null,
        resumeUrl,
        resumeFileName: file.name,
        resumeFileSize: file.size,
        location: location.value ?? profile.location,
        targetRole: targetRole.value ?? profile.targetRole,
        yearsExperience: yearsExperience.value ?? profile.yearsExperience,
        professionalSkills,
        softSkills,
        employmentType: employmentType.value ?? profile.employmentType,
        expectedSalaryMin: expectedSalaryMin.value ?? profile.expectedSalaryMin,
        expectedSalaryMax: expectedSalaryMax.value ?? profile.expectedSalaryMax,
        bio: bio.value ? sanitizeDescriptionHtml(bio.value) : null,
        linkedinUrl: linkedinUrl.value ?? null,
        portfolioUrl: portfolioUrl.value ?? null,
        githubUrl: githubUrl.value ?? null,
        updatedAt: new Date(),
      })
      .where(eq(jobseekerProfiles.id, profile.id));

    await tx.delete(jobseekerWorkExperiences).where(eq(jobseekerWorkExperiences.profileId, profile.id));
    await tx.delete(jobseekerEducation).where(eq(jobseekerEducation.profileId, profile.id));
    await tx.delete(jobseekerCertifications).where(eq(jobseekerCertifications.profileId, profile.id));
    await tx.delete(jobseekerLanguages).where(eq(jobseekerLanguages.profileId, profile.id));
    await tx.delete(jobseekerReferences).where(eq(jobseekerReferences.profileId, profile.id));

    if (workExperiences.length > 0) {
      await tx.insert(jobseekerWorkExperiences).values(
        workExperiences.map((entry, index) => ({ profileId: profile.id, ...entry, sortOrder: index })),
      );
    }
    if (education.length > 0) {
      await tx.insert(jobseekerEducation).values(
        education.map((entry, index) => ({ profileId: profile.id, ...entry, sortOrder: index })),
      );
    }
    if (certifications.length > 0) {
      await tx.insert(jobseekerCertifications).values(
        certifications.map((entry, index) => ({ profileId: profile.id, ...entry, sortOrder: index })),
      );
    }
    if (languages.length > 0) {
      await tx.insert(jobseekerLanguages).values(
        languages.map((entry, index) => ({ profileId: profile.id, ...entry, sortOrder: index })),
      );
    }
    if (references.length > 0) {
      await tx.insert(jobseekerReferences).values(
        references.map((entry, index) => ({ profileId: profile.id, ...entry, sortOrder: index })),
      );
    }
  });

  return NextResponse.json({
    fileName: file.name,
    fileSize: file.size,
    filledCount,
    usage: result.usage,
    durationMs: result.durationMs,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  await db
    .update(jobseekerProfiles)
    .set({ resumeUrl: null, resumeFileName: null, resumeFileSize: null, updatedAt: new Date() })
    .where(eq(jobseekerProfiles.userId, session.userId));

  return NextResponse.json({ ok: true });
}

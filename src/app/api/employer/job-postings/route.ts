import { normalizeLanguageRequirements } from "@/lib/languages";
import { parsePostingExtras } from "@/lib/posting-extras";
import { NextResponse } from "next/server";
import { awardBadge } from "@/lib/badges";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getScopedEmployerAccess, parseHiringManagerIds, setJobHiringManagers } from "@/lib/hiring-scope";
import { hasFullAccess } from "@/lib/team-roles";
import { generateUniqueJobPostingSlug, getJobPostingsForEmployer } from "@/lib/job-postings";
import {
  DRIVING_LICENSES,
  EMPLOYMENT_TYPES,
  WORK_ARRANGEMENTS,
  WORK_AUTHORIZATIONS,
  isCustomQuestionArray,
  isLanguageArray,
  isNonEmptyString,
  isOptionalInt,
  isOptionalString,
  isPreferredKeys,
  isSkillSuggestions,
  isStringArray,
} from "@/lib/job-posting-validation";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

// Only these two are reachable from Post a Job itself — pending (submit for
// review) or draft (save for later). The other five states in
// job_posting_status are only reached via the (not yet built) superadmin
// review flow or employer actions on an existing posting (close, etc.).
const CREATABLE_STATUSES = ["draft", "pending"] as const;

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getScopedEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ postings: [] });

  // A Hiring manager sees only the postings they're assigned to.
  const postings = await getJobPostingsForEmployer(access.profile.id, access.scope);
  return NextResponse.json({ postings });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) {
    return NextResponse.json({ error: "Finish your company profile first." }, { status: 400 });
  }
  if (!hasFullAccess(access.role)) {
    return NextResponse.json({ error: "Only an owner or admin can post jobs." }, { status: 403 });
  }
  const profile = access.profile;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    status,
    postingName,
    title,
    description,
    responsibilities,
    industry,
    employmentType,
    workArrangement,
    location,
    addressLine1,
    addressLine2,
    area,
    city,
    state,
    postcode,
    salaryMin,
    salaryMax,
    openings,
    skills,
    softSkills,
    niceToHaveSkills,
    minYearsExperience,
    minQualificationTier,
    languages,
    workAuthorizations,
    drivingLicense,
    screeningEnabled,
    customScreeningQuestions,
    screeningPreferred,
    skillSuggestions,
    askMinYearsExperience,
    askMinQualificationTier,
    askDrivingLicense,
    askLanguages,
    askWorkAuthorizations,
  } = (body ?? {}) as Record<string, unknown>;
  const screening = screeningEnabled === true;

  if (!(CREATABLE_STATUSES as readonly string[]).includes(status as string)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  // Drafts can be genuinely half-finished — only title is required so an
  // employer can save a bare idea and come back to it later. Submitting for
  // review holds the form's full required-field checklist.
  if (!isNonEmptyString(title)) {
    return NextResponse.json({ error: "Enter a job title." }, { status: 400 });
  }
  if (status === "pending") {
    if (!isNonEmptyString(description)) {
      return NextResponse.json({ error: "Enter a description." }, { status: 400 });
    }
    if (!isNonEmptyString(responsibilities)) {
      return NextResponse.json({ error: "Enter the job description/responsibilities." }, { status: 400 });
    }
    if (!isNonEmptyString(industry)) {
      return NextResponse.json({ error: "Choose an industry." }, { status: 400 });
    }
    if (!isNonEmptyString(location)) {
      return NextResponse.json({ error: "Enter a location." }, { status: 400 });
    }
    if (!isStringArray(skills) || skills.length === 0) {
      return NextResponse.json({ error: "Add at least one required skill." }, { status: 400 });
    }
  }
  if (isNonEmptyString(industry) && !(INDUSTRIES as readonly string[]).includes(industry)) {
    return NextResponse.json({ error: "Invalid industry." }, { status: 400 });
  }
  if (
    employmentType !== undefined &&
    !(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType as string)
  ) {
    return NextResponse.json({ error: "Invalid employment type." }, { status: 400 });
  }
  if (
    workArrangement !== undefined &&
    !(WORK_ARRANGEMENTS as readonly string[]).includes(workArrangement as string)
  ) {
    return NextResponse.json({ error: "Invalid work arrangement." }, { status: 400 });
  }
  if (!isOptionalInt(salaryMin) || !isOptionalInt(salaryMax)) {
    return NextResponse.json({ error: "Invalid salary range." }, { status: 400 });
  }
  if (!isOptionalInt(openings)) {
    return NextResponse.json({ error: "Invalid number of openings." }, { status: 400 });
  }
  if (skills !== undefined && !isStringArray(skills)) {
    return NextResponse.json({ error: "Invalid skills list." }, { status: 400 });
  }
  if (softSkills !== undefined && !isStringArray(softSkills)) {
    return NextResponse.json({ error: "Invalid soft skills list." }, { status: 400 });
  }
  if (niceToHaveSkills !== undefined && !isStringArray(niceToHaveSkills)) {
    return NextResponse.json({ error: "Invalid nice-to-have skills list." }, { status: 400 });
  }
  if (!isOptionalInt(minYearsExperience)) {
    return NextResponse.json({ error: "Invalid minimum years of experience." }, { status: 400 });
  }
  if (!isOptionalString(minQualificationTier)) {
    return NextResponse.json({ error: "Invalid minimum qualification." }, { status: 400 });
  }
  if (languages !== undefined && !isLanguageArray(languages)) {
    return NextResponse.json({ error: "Invalid required languages." }, { status: 400 });
  }
  if (
    workAuthorizations !== undefined &&
    (!isStringArray(workAuthorizations) ||
      !workAuthorizations.every((w) => (WORK_AUTHORIZATIONS as readonly string[]).includes(w)))
  ) {
    return NextResponse.json({ error: "Invalid work authorizations." }, { status: 400 });
  }
  if (
    drivingLicense !== undefined &&
    drivingLicense !== null &&
    !(DRIVING_LICENSES as readonly string[]).includes(drivingLicense as string)
  ) {
    return NextResponse.json({ error: "Invalid driving license." }, { status: 400 });
  }
  if (customScreeningQuestions !== undefined && !isCustomQuestionArray(customScreeningQuestions)) {
    return NextResponse.json({ error: "Invalid custom screening questions." }, { status: 400 });
  }
  if (screeningPreferred !== undefined && !isPreferredKeys(screeningPreferred)) {
    return NextResponse.json({ error: "Invalid preferred requirements." }, { status: 400 });
  }
  if (skillSuggestions !== undefined && !isSkillSuggestions(skillSuggestions)) {
    return NextResponse.json({ error: "Invalid skill suggestions." }, { status: 400 });
  }
  if (!isOptionalString(postingName)) {
    return NextResponse.json({ error: "Invalid posting name." }, { status: 400 });
  }
  if (!isOptionalString(description)) {
    return NextResponse.json({ error: "Invalid description." }, { status: 400 });
  }
  if (!isOptionalString(responsibilities)) {
    return NextResponse.json({ error: "Invalid responsibilities." }, { status: 400 });
  }
  if (!isOptionalString(location)) {
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });
  }
  if (!isOptionalString(addressLine1) || !isOptionalString(addressLine2)) {
    return NextResponse.json({ error: "Invalid street address." }, { status: 400 });
  }
  if (!isOptionalString(city) || !isOptionalString(state) || !isOptionalString(postcode)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }
  if (!isOptionalString(area) || (typeof area === "string" && area.trim().length > 80)) {
    return NextResponse.json({ error: "Keep the area to 80 characters." }, { status: 400 });
  }

  // Benefits, start date, working hours and contact person.
  const extras = await parsePostingExtras(body as Record<string, unknown>, { id: profile.id, ownerUserId: profile.userId });
  if (!extras.ok) return NextResponse.json({ error: extras.error }, { status: 400 });
  // Who's notified about (and can review) this posting's applicants.
  const hiringManagers = await parseHiringManagerIds(profile.id, (body as Record<string, unknown>).hiringManagerIds);
  if (!hiringManagers.ok) return NextResponse.json({ error: hiringManagers.error }, { status: 400 });

  const slug = await generateUniqueJobPostingSlug(profile.companyName, (title as string).trim());

  const [inserted] = await db
    .insert(jobPostings)
    .values({
      employerProfileId: profile.id,
      slug,
      status: status as (typeof CREATABLE_STATUSES)[number],
      postingName: isNonEmptyString(postingName) ? postingName.trim() : null,
      title: (title as string).trim(),
      description: isNonEmptyString(description) ? sanitizeDescriptionHtml(description.trim()) : "",
      responsibilities: isNonEmptyString(responsibilities) ? sanitizeDescriptionHtml(responsibilities.trim()) : "",
      industry: isNonEmptyString(industry) ? industry : null,
      employmentType: (employmentType as (typeof EMPLOYMENT_TYPES)[number] | undefined) ?? "full_time",
      workArrangement: (workArrangement as (typeof WORK_ARRANGEMENTS)[number] | undefined) ?? "onsite",
      location: isNonEmptyString(location) ? location.trim() : "",
      addressLine1: isNonEmptyString(addressLine1) ? addressLine1.trim() : null,
      addressLine2: isNonEmptyString(addressLine2) ? addressLine2.trim() : null,
      area: isNonEmptyString(area) ? area.trim() : null,
      city: isNonEmptyString(city) ? city.trim() : null,
      state: isNonEmptyString(state) ? state.trim() : null,
      postcode: isNonEmptyString(postcode) ? postcode.trim() : null,
      salaryMin: (salaryMin as number | null) ?? null,
      salaryMax: (salaryMax as number | null) ?? null,
      openings: (openings as number | undefined) ?? 1,
      skills: isStringArray(skills) ? skills : [],
      softSkills: isStringArray(softSkills) ? softSkills : [],
      niceToHaveSkills: isStringArray(niceToHaveSkills) ? niceToHaveSkills : [],
      // Authoritative: even if the client sent stale requirement values
      // alongside screeningEnabled: false, they're dropped here so a
      // posting that isn't screening-gated can never end up asking
      // applicants anything.
      minYearsExperience: screening ? ((minYearsExperience as number | null) ?? null) : null,
      minQualificationTier: screening && isNonEmptyString(minQualificationTier) ? minQualificationTier : null,
      // Languages are part of the job itself (shown on every posting), not
      // only a screening requirement — kept whether or not screening is on.
      // Applicants are only screened by them when screening + askLanguages.
      languages: isLanguageArray(languages) ? normalizeLanguageRequirements(languages) : [],
      workAuthorizations:
        screening && isStringArray(workAuthorizations)
          ? (workAuthorizations as (typeof WORK_AUTHORIZATIONS)[number][])
          : [],
      drivingLicense: screening && isNonEmptyString(drivingLicense)
        ? (drivingLicense as (typeof DRIVING_LICENSES)[number])
        : null,
      screeningEnabled: screening,
      customScreeningQuestions: screening && isCustomQuestionArray(customScreeningQuestions) ? customScreeningQuestions : [],
      screeningPreferred: screening && isPreferredKeys(screeningPreferred) ? screeningPreferred : [],
      askMinYearsExperience: askMinYearsExperience !== false,
      askMinQualificationTier: askMinQualificationTier !== false,
      askDrivingLicense: askDrivingLicense !== false,
      askLanguages: askLanguages !== false,
      askWorkAuthorizations: askWorkAuthorizations !== false,
      skillSuggestions: isSkillSuggestions(skillSuggestions) ? skillSuggestions : null,
      ...extras.values,
    })
    .returning();

  if (hiringManagers.ids && hiringManagers.ids.length > 0) {
    await setJobHiringManagers({
      employerProfileId: profile.id,
      companyName: profile.companyName,
      jobPostingId: inserted.id,
      jobTitle: inserted.title,
      teamMemberIds: hiringManagers.ids,
      actor: { userId: session.userId },
    });
  }

  revalidatePublicData();
  await awardBadge(profile.id, "first_job_posted");
  if (screening) await awardBadge(profile.id, "screening_enabled");

  return NextResponse.json({ posting: inserted });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { generateUniqueJobPostingSlug, getJobPostingsForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";
import { INDUSTRIES } from "@/lib/industries";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
const WORK_AUTHORIZATIONS = ["citizen", "permanent_resident", "work_pass_holder", "needs_sponsorship"] as const;
const DRIVING_LICENSES = ["b2", "b", "d", "da", "e"] as const;
const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
// Only these two are reachable from Post a Job itself — pending (submit for
// review) or draft (save for later). The other five states in
// job_posting_status are only reached via the (not yet built) superadmin
// review flow or employer actions on an existing posting (close, etc.).
const CREATABLE_STATUSES = ["draft", "pending"] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalInt(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isInteger(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

type LanguageReq = { language: string; level: (typeof LANGUAGE_LEVELS)[number] };

function isLanguageArray(value: unknown): value is LanguageReq[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === "object" &&
        isNonEmptyString((v as Record<string, unknown>).language) &&
        (LANGUAGE_LEVELS as readonly string[]).includes((v as Record<string, unknown>).level as string),
    )
  );
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ postings: [] });

  const postings = await getJobPostingsForEmployer(access.profile.id);
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
  } = (body ?? {}) as Record<string, unknown>;

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
      city: isNonEmptyString(city) ? city.trim() : null,
      state: isNonEmptyString(state) ? state.trim() : null,
      postcode: isNonEmptyString(postcode) ? postcode.trim() : null,
      salaryMin: (salaryMin as number | null) ?? null,
      salaryMax: (salaryMax as number | null) ?? null,
      openings: (openings as number | undefined) ?? 1,
      skills: isStringArray(skills) ? skills : [],
      softSkills: isStringArray(softSkills) ? softSkills : [],
      niceToHaveSkills: isStringArray(niceToHaveSkills) ? niceToHaveSkills : [],
      minYearsExperience: (minYearsExperience as number | null) ?? null,
      minQualificationTier: isNonEmptyString(minQualificationTier) ? minQualificationTier : null,
      languages: isLanguageArray(languages) ? languages : [],
      workAuthorizations: isStringArray(workAuthorizations)
        ? (workAuthorizations as (typeof WORK_AUTHORIZATIONS)[number][])
        : [],
      drivingLicense: isNonEmptyString(drivingLicense)
        ? (drivingLicense as (typeof DRIVING_LICENSES)[number])
        : null,
    })
    .returning();

  return NextResponse.json({ posting: inserted });
}

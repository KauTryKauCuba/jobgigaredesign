import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
const WORK_ARRANGEMENTS = ["remote", "hybrid", "onsite"] as const;
const WORK_AUTHORIZATIONS = ["citizen", "permanent_resident", "work_pass_holder", "needs_sponsorship"] as const;
const DRIVING_LICENSES = ["b2", "b", "d", "da", "e"] as const;
const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
// Statuses an employer can set directly from the Manage Job list/form.
// pending/active/filled/rejected/flagged all require the (not yet built)
// superadmin review flow or an applicant-driven event, so they're excluded.
const SETTABLE_STATUSES = ["draft", "pending", "closed"] as const;

async function getOwnedProfile(userId: string) {
  const access = await getEmployerAccess(userId);
  return access ? { id: access.profile.id } : null;
}

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const profile = await getOwnedProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;
  const posting = await getJobPostingForEmployer(profile.id, id);
  if (!posting) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ posting });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const profile = await getOwnedProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;
  const existing = await getJobPostingForEmployer(profile.id, id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

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

  if (status !== undefined && !(SETTABLE_STATUSES as readonly string[]).includes(status as string)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (title !== undefined && !isNonEmptyString(title)) {
    return NextResponse.json({ error: "Enter a job title." }, { status: 400 });
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
  if (!isOptionalString(addressLine1) || !isOptionalString(addressLine2)) {
    return NextResponse.json({ error: "Invalid street address." }, { status: 400 });
  }
  if (!isOptionalString(city) || !isOptionalString(state) || !isOptionalString(postcode)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (postingName !== undefined) updates.postingName = isNonEmptyString(postingName) ? postingName.trim() : null;
  if (title !== undefined) updates.title = (title as string).trim();
  if (description !== undefined)
    updates.description = isNonEmptyString(description) ? sanitizeDescriptionHtml(description.trim()) : "";
  if (responsibilities !== undefined) {
    updates.responsibilities = isNonEmptyString(responsibilities) ? sanitizeDescriptionHtml(responsibilities.trim()) : "";
  }
  if (industry !== undefined) updates.industry = isNonEmptyString(industry) ? industry : null;
  if (employmentType !== undefined) updates.employmentType = employmentType;
  if (workArrangement !== undefined) updates.workArrangement = workArrangement;
  if (location !== undefined) updates.location = isNonEmptyString(location) ? location.trim() : "";
  if (addressLine1 !== undefined) updates.addressLine1 = isNonEmptyString(addressLine1) ? addressLine1.trim() : null;
  if (addressLine2 !== undefined) updates.addressLine2 = isNonEmptyString(addressLine2) ? addressLine2.trim() : null;
  if (city !== undefined) updates.city = isNonEmptyString(city) ? city.trim() : null;
  if (state !== undefined) updates.state = isNonEmptyString(state) ? state.trim() : null;
  if (postcode !== undefined) updates.postcode = isNonEmptyString(postcode) ? postcode.trim() : null;
  if (salaryMin !== undefined) updates.salaryMin = salaryMin;
  if (salaryMax !== undefined) updates.salaryMax = salaryMax;
  if (openings !== undefined) updates.openings = openings;
  if (skills !== undefined) updates.skills = skills;
  if (softSkills !== undefined) updates.softSkills = softSkills;
  if (niceToHaveSkills !== undefined) updates.niceToHaveSkills = niceToHaveSkills;
  if (minYearsExperience !== undefined) updates.minYearsExperience = minYearsExperience;
  if (minQualificationTier !== undefined) {
    updates.minQualificationTier = isNonEmptyString(minQualificationTier) ? minQualificationTier : null;
  }
  if (languages !== undefined) updates.languages = languages;
  if (workAuthorizations !== undefined) updates.workAuthorizations = workAuthorizations;
  if (drivingLicense !== undefined) {
    updates.drivingLicense = isNonEmptyString(drivingLicense) ? drivingLicense : null;
  }

  const [updated] = await db
    .update(jobPostings)
    .set(updates)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profile.id)))
    .returning();

  return NextResponse.json({ posting: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const profile = await getOwnedProfile(session.userId);
  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;
  await db
    .delete(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profile.id)));

  return NextResponse.json({ ok: true });
}

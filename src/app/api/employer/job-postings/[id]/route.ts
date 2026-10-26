import { normalizeLanguageRequirements } from "@/lib/languages";
import { parsePostingExtras } from "@/lib/posting-extras";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { awardBadge } from "@/lib/badges";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import {
  canViewJobPosting,
  getJobHiringManagers,
  getScopedEmployerAccess,
  parseHiringManagerIds,
  setJobHiringManagers,
} from "@/lib/hiring-scope";
import { hasFullAccess } from "@/lib/team-roles";
import { isUuid } from "@/lib/uuid";
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
import { jobAdFileCleanupForPostings } from "@/lib/job-ads";
import { aiInterviewMediaCleanupForPostings } from "@/lib/ai-interview";
import { getJobPostingForEmployer } from "@/lib/job-postings";
import { getSession } from "@/lib/session";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";

// Statuses an employer can set directly from the Manage Job list/form.
// pending/active/filled/rejected/flagged all require the (not yet built)
// superadmin review flow or an applicant-driven event, so they're excluded.
const SETTABLE_STATUSES = ["draft", "pending", "closed"] as const;

// Editing, closing and deleting a posting is for Owners/Admins only — a
// Hiring manager can view their assigned postings (GET) but not change them.
async function getEditableProfile(userId: string) {
  const access = await getEmployerAccess(userId);
  if (!access) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) } as const;
  if (!hasFullAccess(access.role)) {
    return {
      error: NextResponse.json({ error: "Only an owner or admin can change job postings." }, { status: 403 }),
    } as const;
  }
  return {
    profile: { id: access.profile.id, ownerUserId: access.profile.userId, companyName: access.profile.companyName },
  } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getScopedEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { id } = await params;
  if (!isUuid(id) || !canViewJobPosting(access.scope, id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const posting = await getJobPostingForEmployer(access.profile.id, id);
  if (!posting) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const managers = (await getJobHiringManagers([posting.id])).get(posting.id) ?? [];
  return NextResponse.json({ posting: { ...posting, hiringManagerIds: managers.map((m) => m.teamMemberId) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const editable = await getEditableProfile(session.userId);
  if ("error" in editable) return editable.error;
  const { profile } = editable;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
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
  if (customScreeningQuestions !== undefined && !isCustomQuestionArray(customScreeningQuestions)) {
    return NextResponse.json({ error: "Invalid custom screening questions." }, { status: 400 });
  }
  if (screeningPreferred !== undefined && !isPreferredKeys(screeningPreferred)) {
    return NextResponse.json({ error: "Invalid preferred requirements." }, { status: 400 });
  }
  if (skillSuggestions !== undefined && !isSkillSuggestions(skillSuggestions)) {
    return NextResponse.json({ error: "Invalid skill suggestions." }, { status: 400 });
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
  if (area !== undefined) updates.area = isNonEmptyString(area) ? area.trim() : null;
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
  if (languages !== undefined) {
    updates.languages = normalizeLanguageRequirements(languages as { language: string; dialect?: string | null; level: string }[]);
  }
  if (workAuthorizations !== undefined) updates.workAuthorizations = workAuthorizations;
  if (drivingLicense !== undefined) {
    updates.drivingLicense = isNonEmptyString(drivingLicense) ? drivingLicense : null;
  }
  if (customScreeningQuestions !== undefined && isCustomQuestionArray(customScreeningQuestions)) {
    updates.customScreeningQuestions = customScreeningQuestions;
  }
  if (screeningPreferred !== undefined && isPreferredKeys(screeningPreferred)) {
    updates.screeningPreferred = screeningPreferred;
  }
  if (skillSuggestions !== undefined && isSkillSuggestions(skillSuggestions)) {
    updates.skillSuggestions = skillSuggestions;
  }
  if (askMinYearsExperience !== undefined) updates.askMinYearsExperience = askMinYearsExperience === true;
  if (askMinQualificationTier !== undefined) updates.askMinQualificationTier = askMinQualificationTier === true;
  if (askDrivingLicense !== undefined) updates.askDrivingLicense = askDrivingLicense === true;
  if (askLanguages !== undefined) updates.askLanguages = askLanguages === true;
  if (askWorkAuthorizations !== undefined) updates.askWorkAuthorizations = askWorkAuthorizations === true;
  if (screeningEnabled !== undefined) {
    updates.screeningEnabled = screeningEnabled === true;
  }
  // Authoritative, same as the create route: whenever the posting ends up
  // with screening off — whether this request just turned it off, or it was
  // already off and this request only touched a requirement field without
  // resending screeningEnabled — the requirement fields get wiped too, so a
  // screening-disabled posting can never end up with stale requirement data.
  const screeningEnabledAfterUpdate = updates.screeningEnabled ?? existing.screeningEnabled;
  if (!screeningEnabledAfterUpdate) {
    updates.minYearsExperience = null;
    updates.minQualificationTier = null;
    // (Languages are kept — they're shown on the posting regardless.)
    updates.workAuthorizations = [];
    updates.drivingLicense = null;
    updates.customScreeningQuestions = [];
    updates.screeningPreferred = [];
  }

  // Benefits, start date, working hours and contact person — only the ones sent.
  const extras = await parsePostingExtras((body ?? {}) as Record<string, unknown>, profile);
  if (!extras.ok) return NextResponse.json({ error: extras.error }, { status: 400 });
  Object.assign(updates, extras.values);
  // Only when sent — from the Post a job form, or the posting page's Hiring managers card.
  const hiringManagers = await parseHiringManagerIds(profile.id, ((body ?? {}) as Record<string, unknown>).hiringManagerIds);
  if (!hiringManagers.ok) return NextResponse.json({ error: hiringManagers.error }, { status: 400 });

  const [updated] = await db
    .update(jobPostings)
    .set(updates)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profile.id)))
    .returning();

  if (hiringManagers.ids) {
    await setJobHiringManagers({
      employerProfileId: profile.id,
      companyName: profile.companyName,
      jobPostingId: updated.id,
      jobTitle: updated.title,
      teamMemberIds: hiringManagers.ids,
      actor: { userId: session.userId },
    });
  }

  if (screeningEnabledAfterUpdate) await awardBadge(profile.id, "screening_enabled");

  const managers = (await getJobHiringManagers([updated.id])).get(updated.id) ?? [];
  return NextResponse.json({ posting: { ...updated, hiringManagerIds: managers.map((m) => m.teamMemberId) } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const editable = await getEditableProfile(session.userId);
  if ("error" in editable) return editable.error;
  const { profile } = editable;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [own] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.employerProfileId, profile.id)))
    .limit(1);
  if (!own) return NextResponse.json({ ok: true });
  // Its job ad and AI interview rows cascade with it; their files don't, so
  // they're removed once the posting is really gone.
  const cleanups = await Promise.all([jobAdFileCleanupForPostings([own.id]), aiInterviewMediaCleanupForPostings([own.id])]);
  await db.delete(jobPostings).where(eq(jobPostings.id, own.id));
  await Promise.all(cleanups.map((cleanup) => cleanup()));

  return NextResponse.json({ ok: true });
}

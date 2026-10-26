import { NextResponse } from "next/server";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerAddresses, employerOnboardingDrafts, employerProfiles, users } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { hasFullAccess } from "@/lib/team-roles";
import { awardBadge, isProfileBoosted } from "@/lib/badges";
import { DEFAULT_COMPANY_LIMIT, getCompanyLimitInfo } from "@/lib/company-limit";
import { INDUSTRIES } from "@/lib/industries";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { isValidMalaysianPhone } from "@/lib/phone";
import {
  AWARD_TITLE_MAX,
  DRESS_CODES,
  GALLERY_PHOTO_URL,
  LEADER_FIELD_MAX,
  LEADER_PHOTO_URL,
  MAX_AWARDS,
  MAX_GALLERY_PHOTOS,
  MAX_LEADERS,
  parseFacilities,
} from "@/lib/company-workplace";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession, setActiveEmployerCompany } from "@/lib/session";
import { isSsmDocumentUrl, saveSsmDocument } from "@/lib/ssm-document-storage";
import { isBase64DataUrl, saveBannerUpload, saveBase64Upload } from "@/lib/uploads";

// Thrown inside the save transaction when the account is already at its
// company limit (rolls the insert back).
class CompanyLimitReached extends Error {
  constructor(public limit: number) {
    super("Company limit reached");
  }
}

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
const COMPANY_TYPES = ["Startup", "SME", "MNC", "GLC", "Government"] as const;
const CURRENT_YEAR = new Date().getFullYear();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type NewsItem = { title: string; url: string };

function isNewsItemArray(value: unknown): value is NewsItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        isNonEmptyString((item as Record<string, unknown>).title) &&
        isNonEmptyString((item as Record<string, unknown>).url),
    )
  );
}

type AddressInput = {
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  area?: string | null;
  city: string;
  state: (typeof MALAYSIA_STATES)[number];
  postcode: string;
  // Optional — the address new job postings start with. Normalised on save
  // to exactly one per company (the first one marked, else the first).
  isJobDefault?: boolean;
};

function isValidAddressArray(value: unknown): value is AddressInput[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const a = item as Record<string, unknown>;
      return (
        isNonEmptyString(a.label) &&
        isNonEmptyString(a.addressLine1) &&
        isOptionalString(a.addressLine2) &&
        isOptionalString(a.area) &&
        (typeof a.area !== "string" || a.area.trim().length <= 80) &&
        isNonEmptyString(a.city) &&
        typeof a.state === "string" &&
        (MALAYSIA_STATES as readonly string[]).includes(a.state) &&
        typeof a.postcode === "string" &&
        /^\d{5}$/.test(a.postcode.trim())
      );
    })
  );
}

// The workplace fields (photos, facilities, dress code, awards, leaders) —
// each optional; omitted ones are left as they are. Returns the cleaned-up
// values to save, or the first problem found.
function parseWorkplace(input: Record<string, unknown>):
  | { ok: true; values: Partial<Pick<typeof employerProfiles.$inferInsert, "galleryPhotos" | "facilities" | "dressCode" | "awards" | "leaders">> }
  | { ok: false; error: string } {
  const values: Partial<Pick<typeof employerProfiles.$inferInsert, "galleryPhotos" | "facilities" | "dressCode" | "awards" | "leaders">> = {};
  const { galleryPhotos, facilities, dressCode, awards, leaders } = input;

  if (galleryPhotos !== undefined) {
    if (
      !Array.isArray(galleryPhotos) ||
      galleryPhotos.length > MAX_GALLERY_PHOTOS ||
      !galleryPhotos.every((u) => typeof u === "string" && GALLERY_PHOTO_URL.test(u))
    ) {
      return { ok: false, error: `Invalid photos — add up to ${MAX_GALLERY_PHOTOS}.` };
    }
    values.galleryPhotos = [...new Set(galleryPhotos as string[])];
  }
  if (facilities !== undefined) {
    const parsed = parseFacilities(facilities);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    values.facilities = parsed.value;
  }
  if (dressCode !== undefined) {
    if (dressCode !== null && !(DRESS_CODES as readonly unknown[]).includes(dressCode)) {
      return { ok: false, error: "Invalid dress code." };
    }
    values.dressCode = (dressCode as string | null) ?? null;
  }
  if (awards !== undefined) {
    if (!Array.isArray(awards) || awards.length > MAX_AWARDS) return { ok: false, error: `Add up to ${MAX_AWARDS} awards.` };
    const cleaned: { title: string; year: number | null }[] = [];
    for (const item of awards) {
      const a = (item ?? {}) as Record<string, unknown>;
      if (!isNonEmptyString(a.title) || a.title.trim().length > AWARD_TITLE_MAX) {
        return { ok: false, error: "Give each award a name (up to 120 characters)." };
      }
      const year = a.year === null || a.year === undefined ? null : a.year;
      if (year !== null && !(typeof year === "number" && Number.isInteger(year) && year >= 1900 && year <= CURRENT_YEAR)) {
        return { ok: false, error: `Award years must be between 1900 and ${CURRENT_YEAR}.` };
      }
      cleaned.push({ title: a.title.trim(), year });
    }
    values.awards = cleaned;
  }
  if (leaders !== undefined) {
    if (!Array.isArray(leaders) || leaders.length > MAX_LEADERS) return { ok: false, error: `Add up to ${MAX_LEADERS} people.` };
    const cleaned: { name: string; title: string; photoUrl: string | null }[] = [];
    for (const item of leaders) {
      const l = (item ?? {}) as Record<string, unknown>;
      if (!isNonEmptyString(l.name) || l.name.trim().length > LEADER_FIELD_MAX) {
        return { ok: false, error: "Give each person a name." };
      }
      if (!isNonEmptyString(l.title) || l.title.trim().length > LEADER_FIELD_MAX) {
        return { ok: false, error: "Give each person a role, e.g. Founder & CEO." };
      }
      const photoUrl = l.photoUrl ?? null;
      if (photoUrl !== null && !(typeof photoUrl === "string" && LEADER_PHOTO_URL.test(photoUrl))) {
        return { ok: false, error: "Invalid leadership photo — please upload it again." };
      }
      cleaned.push({ name: l.name.trim(), title: l.title.trim(), photoUrl: photoUrl as string | null });
    }
    values.leaders = cleaned;
  }
  return { ok: true, values };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    avatarUrl,
    contactName,
    contactRole,
    contactPosition,
    contactPhone,
    contactEmail,
    companyName,
    ssmNumber,
    ssmDocumentUrl,
    industry,
    industryCategory,
    companySize,
    addresses,
    companyDescription,
    logoUrl,
    benefits,
    websiteUrl,
    companyEmail,
    companyPhone,
    companyLinkedin,
    companyFacebook,
    companyInstagram,
    foundedYear,
    companyType,
    officePhotoUrl,
    bannerUrl,
    recentNews,
    createNew,
  } = (body ?? {}) as Record<string, unknown>;

  // `createNew` registers an additional company ("Add a company") instead of
  // editing the current one — checked against this account's company limit
  // before anything (uploads included) is saved.
  const creating = createNew === true;
  if (creating) {
    const { canAdd, limit } = await getCompanyLimitInfo(session.userId);
    if (!canAdd) {
      return NextResponse.json(
        { error: `You've reached your limit of ${limit} companies. Contact JobGiga to add more.` },
        { status: 403 },
      );
    }
  }
  // Existing company (owner or invited team member editing "Company
  // Profile") vs. a brand-new one — first-time onboarding, or "Add a
  // company". Resolved up front: Hiring managers and Panel members don't
  // edit the company itself, whatever the request contains.
  const access = creating ? null : await getEmployerAccess(session.userId);
  if (access && !hasFullAccess(access.role)) {
    return NextResponse.json({ error: "Only an owner or admin can edit the company profile." }, { status: 403 });
  }

  if (!isOptionalString(avatarUrl) || (typeof avatarUrl === "string" && avatarUrl.length > 6_000_000)) {
    return NextResponse.json({ error: "Invalid profile photo." }, { status: 400 });
  }
  if (!isOptionalString(companyDescription)) {
    return NextResponse.json({ error: "Invalid company description." }, { status: 400 });
  }
  if (!isOptionalString(logoUrl) || (typeof logoUrl === "string" && logoUrl.length > 6_000_000)) {
    return NextResponse.json({ error: "Invalid company logo." }, { status: 400 });
  }
  if (!Array.isArray(benefits) || !benefits.every(isNonEmptyString)) {
    return NextResponse.json({ error: "Invalid benefits list." }, { status: 400 });
  }
  if (!isOptionalString(websiteUrl)) {
    return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
  }
  if (isNonEmptyString(companyEmail) && !isValidEmail(companyEmail)) {
    return NextResponse.json({ error: "Enter a valid company email." }, { status: 400 });
  }
  if (!isOptionalString(companyPhone) || (isNonEmptyString(companyPhone) && !isValidMalaysianPhone(companyPhone))) {
    return NextResponse.json({ error: "Enter a valid company phone number, e.g. 03-1234 5678." }, { status: 400 });
  }
  if (!isOptionalString(companyLinkedin)) {
    return NextResponse.json({ error: "Invalid company LinkedIn link." }, { status: 400 });
  }
  if (!isOptionalString(companyFacebook)) {
    return NextResponse.json({ error: "Invalid company Facebook link." }, { status: 400 });
  }
  if (!isOptionalString(companyInstagram)) {
    return NextResponse.json({ error: "Invalid company Instagram link." }, { status: 400 });
  }
  if (
    foundedYear !== null &&
    foundedYear !== undefined &&
    !(typeof foundedYear === "number" && Number.isInteger(foundedYear) && foundedYear >= 1800 && foundedYear <= CURRENT_YEAR)
  ) {
    return NextResponse.json({ error: "Invalid founded year." }, { status: 400 });
  }
  if (
    companyType !== null &&
    companyType !== undefined &&
    !(typeof companyType === "string" && (COMPANY_TYPES as readonly string[]).includes(companyType))
  ) {
    return NextResponse.json({ error: "Invalid company type." }, { status: 400 });
  }
  if (!isOptionalString(officePhotoUrl) || (typeof officePhotoUrl === "string" && officePhotoUrl.length > 6_000_000)) {
    return NextResponse.json({ error: "Invalid office photo." }, { status: 400 });
  }
  // Cover banner: a freshly picked image (data URL), the already-saved one
  // (our own /uploads/banners/ path), null to remove it, or omitted to leave
  // it as it is — never an arbitrary outside URL.
  if (
    bannerUrl !== undefined &&
    bannerUrl !== null &&
    !(
      typeof bannerUrl === "string" &&
      ((isBase64DataUrl(bannerUrl) && bannerUrl.startsWith("data:image/") && bannerUrl.length <= 14_000_000) ||
        /^\/uploads\/banners\/[\w-]+\.webp$/.test(bannerUrl))
    )
  ) {
    return NextResponse.json({ error: "Invalid cover banner." }, { status: 400 });
  }
  if (recentNews !== undefined && recentNews !== null && !isNewsItemArray(recentNews)) {
    return NextResponse.json({ error: "Invalid recent news." }, { status: 400 });
  }
  const workplace = parseWorkplace((body ?? {}) as Record<string, unknown>);
  if (!workplace.ok) return NextResponse.json({ error: workplace.error }, { status: 400 });
  if (!isNonEmptyString(contactName)) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!isNonEmptyString(contactRole)) {
    return NextResponse.json({ error: "Enter your role at the company." }, { status: 400 });
  }
  if (!isNonEmptyString(contactPosition)) {
    return NextResponse.json({ error: "Enter your position at the company." }, { status: 400 });
  }
  if (!isNonEmptyString(contactPhone)) {
    return NextResponse.json({ error: "Enter your phone number." }, { status: 400 });
  }
  if (!isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  }
  if (!isNonEmptyString(companyName)) {
    return NextResponse.json({ error: "Enter your company name." }, { status: 400 });
  }
  if (!isNonEmptyString(ssmNumber)) {
    return NextResponse.json({ error: "Enter your SSM registration number." }, { status: 400 });
  }
  // A freshly picked file (data URL, PDF or image), the already-saved one
  // (its private /api/ssm-documents/ URL — checked below to be this
  // company's own), null to remove it, or omitted to leave it as it is.
  if (
    ssmDocumentUrl !== undefined &&
    ssmDocumentUrl !== null &&
    !(
      typeof ssmDocumentUrl === "string" &&
      ((isBase64DataUrl(ssmDocumentUrl) &&
        /^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(ssmDocumentUrl) &&
        ssmDocumentUrl.length <= 14_000_000) ||
        isSsmDocumentUrl(ssmDocumentUrl))
    )
  ) {
    return NextResponse.json({ error: "Invalid SSM document — upload a PDF, JPG, PNG or WebP, up to 10 MB." }, { status: 400 });
  }
  if (!isNonEmptyString(industry)) {
    return NextResponse.json({ error: "Enter your industry." }, { status: 400 });
  }
  if (
    typeof industryCategory !== "string" ||
    !(INDUSTRIES as readonly string[]).includes(industryCategory)
  ) {
    return NextResponse.json({ error: "Choose your industry category." }, { status: 400 });
  }
  if (!isValidAddressArray(addresses)) {
    return NextResponse.json({ error: "Enter at least one complete company address." }, { status: 400 });
  }
  if (
    typeof companySize !== "string" ||
    !COMPANY_SIZES.includes(companySize as (typeof COMPANY_SIZES)[number])
  ) {
    return NextResponse.json({ error: "Choose a company size." }, { status: 400 });
  }

  // Every image field above arrives as either a `data:...;base64,...`
  // string (freshly picked by the browser) or an existing `/uploads/...`
  // URL (unchanged from a previous save) — only the former needs writing to
  // disk. Storing the base64 string itself in Postgres is what caused the
  // Manage Jobs/Applicants/poster-status bloat found earlier this session.
  const resolvedAvatarUrl = isBase64DataUrl(avatarUrl) ? await saveBase64Upload(avatarUrl, "avatars") : avatarUrl;
  const resolvedLogoUrl = isBase64DataUrl(logoUrl) ? await saveBase64Upload(logoUrl, "logos") : logoUrl;
  const resolvedOfficePhotoUrl = isBase64DataUrl(officePhotoUrl)
    ? await saveBase64Upload(officePhotoUrl, "office-photos")
    : officePhotoUrl;
  let resolvedBannerUrl: string | null | undefined;
  try {
    resolvedBannerUrl = isBase64DataUrl(bannerUrl) ? await saveBannerUpload(bannerUrl) : (bannerUrl as string | null | undefined);
  } catch {
    return NextResponse.json({ error: "Couldn't read that cover banner — try a JPG or PNG." }, { status: 400 });
  }

  // `access` (above) is resolved before `values` since the SSM document's
  // verification state depends on what was already stored for it.
  const storedSsmDocumentUrl = access?.profile.ssmDocumentUrl ?? null;

  // First-time onboarding saves a picked SSM document with the draft (so it
  // survives a refresh) — that file is this user's own upload too. Only
  // ever one the draft route saved for them; it never accepts other URLs.
  let draftSsmDocumentUrl: unknown = null;
  if (!access && !creating) {
    const [draft] = await db
      .select({ data: employerOnboardingDrafts.data })
      .from(employerOnboardingDrafts)
      .where(eq(employerOnboardingDrafts.userId, session.userId))
      .limit(1);
    draftSsmDocumentUrl = (draft?.data as Record<string, unknown> | undefined)?.ssmDocumentUrl ?? null;
  }

  // An existing document URL must be this company's own — the file route
  // grants access to whichever company references a file, so accepting
  // someone else's URL here would hand over their certificate.
  if (
    typeof ssmDocumentUrl === "string" &&
    !isBase64DataUrl(ssmDocumentUrl) &&
    ssmDocumentUrl !== storedSsmDocumentUrl &&
    ssmDocumentUrl !== draftSsmDocumentUrl
  ) {
    return NextResponse.json({ error: "Invalid SSM document — please upload it again." }, { status: 400 });
  }
  const trimmedSsmDocumentUrl =
    ssmDocumentUrl === undefined
      ? storedSsmDocumentUrl
      : isBase64DataUrl(ssmDocumentUrl)
        ? await saveSsmDocument(ssmDocumentUrl)
        : (ssmDocumentUrl as string | null);
  // A newly uploaded (or changed) document always restarts review — even a
  // previously "verified" company drops back to "pending" the moment its
  // SSM document is replaced, since a superadmin hasn't seen the new file
  // yet. Leaving the document untouched keeps whatever status it already had.
  // A changed SSM number restarts review too — the document was checked
  // against the old number.
  const ssmNeedsReview =
    trimmedSsmDocumentUrl !== (access?.profile.ssmDocumentUrl ?? null) ||
    (!!access && ssmNumber.trim() !== access.profile.ssmNumber);
  const ssmVerificationStatus = ssmNeedsReview
    ? trimmedSsmDocumentUrl
      ? ("pending" as const)
      : ("unverified" as const)
    : (access?.profile.ssmVerificationStatus ?? "unverified");

  const values = {
    userId: session.userId,
    avatarUrl: isNonEmptyString(resolvedAvatarUrl) ? resolvedAvatarUrl.trim() : null,
    contactName: contactName.trim(),
    contactRole: contactRole.trim(),
    contactPosition: contactPosition.trim(),
    contactPhone: contactPhone.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    companyName: companyName.trim(),
    ssmNumber: ssmNumber.trim(),
    ssmDocumentUrl: trimmedSsmDocumentUrl,
    ssmVerificationStatus,
    ...(ssmNeedsReview ? { ssmVerifiedAt: null, ssmRejectionReason: null } : {}),
    industry: industry.trim(),
    industryCategory,
    companySize,
    companyDescription: isNonEmptyString(companyDescription)
      ? sanitizeDescriptionHtml(companyDescription.trim())
      : null,
    logoUrl: isNonEmptyString(resolvedLogoUrl) ? resolvedLogoUrl.trim() : null,
    benefits: benefits.map((b) => b.trim()),
    websiteUrl: isNonEmptyString(websiteUrl) ? websiteUrl.trim() : null,
    companyEmail: isNonEmptyString(companyEmail) ? companyEmail.trim().toLowerCase() : null,
    companyPhone: isNonEmptyString(companyPhone) ? companyPhone.trim() : null,
    companyLinkedin: isNonEmptyString(companyLinkedin) ? companyLinkedin.trim() : null,
    companyFacebook: isNonEmptyString(companyFacebook) ? companyFacebook.trim() : null,
    companyInstagram: isNonEmptyString(companyInstagram) ? companyInstagram.trim() : null,
    foundedYear: typeof foundedYear === "number" ? foundedYear : null,
    companyType: isNonEmptyString(companyType) ? companyType : null,
    officePhotoUrl: isNonEmptyString(resolvedOfficePhotoUrl) ? resolvedOfficePhotoUrl.trim() : null,
    // Omitted = keep the current banner (spreading `undefined` leaves the column untouched).
    ...(resolvedBannerUrl !== undefined ? { bannerUrl: resolvedBannerUrl } : {}),
    recentNews: isNewsItemArray(recentNews)
      ? recentNews.map((item) => ({ title: item.title.trim(), url: item.url.trim() }))
      : [],
    ...workplace.values,
    updatedAt: new Date(),
  };

  const saved = await db.transaction(async (tx) => {
    let profileId: string;
    if (access) {
      // Update the shared row in place. `values.userId` must NOT be written
      // here — it's the company's original owner, and a team member saving
      // an edit should never reassign that just by submitting this form.
      // Destructured only to exclude it from updateValues, per the comment above.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _ownerUserId, ...allUpdateValues } = values;
      // The contact fields (name, photo, role, position, phone, email) are the
      // company registrant's own details — only they can change them. A
      // teammate saving Company Profile keeps whatever's already there, so a
      // stale or tampered form can never overwrite someone else's details.
      // (Teammates edit their own via /api/employer/me.)
      const isRegistrant = access.profile.userId === session.userId;
      const updateValues = isRegistrant
        ? allUpdateValues
        : (({ avatarUrl, contactName, contactRole, contactPosition, contactPhone, contactEmail, ...rest }) => {
            void [avatarUrl, contactName, contactRole, contactPosition, contactPhone, contactEmail];
            return rest;
          })(allUpdateValues);
      const [updated] = await tx
        .update(employerProfiles)
        .set(updateValues)
        .where(eq(employerProfiles.id, access.profile.id))
        .returning({ id: employerProfiles.id });
      profileId = updated.id;

      // Interview panels store interviewer *names* as a snapshot
      // (job_applications.interview_details.interviewers), so a rename here
      // would otherwise leave every already-scheduled interview showing the
      // old name. Swap old -> new in place, preserving each panel's order.
      const oldName = access.profile.contactName.trim();
      if (isRegistrant && oldName && oldName !== values.contactName) {
        await tx.execute(sql`
          UPDATE job_applications AS ja
          SET interview_details = jsonb_set(
            ja.interview_details,
            '{interviewers}',
            (
              SELECT jsonb_agg(CASE WHEN e.value = to_jsonb(${oldName}::text) THEN to_jsonb(${values.contactName}::text) ELSE e.value END ORDER BY e.ord)
              FROM jsonb_array_elements(ja.interview_details->'interviewers') WITH ORDINALITY AS e(value, ord)
            )
          )
          FROM job_postings AS jp
          WHERE ja.job_posting_id = jp.id
            AND jp.employer_profile_id = ${profileId}
            AND jsonb_typeof(ja.interview_details->'interviewers') = 'array'
            AND ja.interview_details->'interviewers' ? ${oldName}
        `);
      }
    } else {
      // A new company (first-time onboarding, or "Add a company") — this
      // user becomes its registrant and owner. The company limit is checked
      // again here with the account row locked, so two "Add a company"
      // requests at once (a double-click) can't both slip past it.
      const [owner] = await tx.select({ companyLimit: users.companyLimit }).from(users).where(eq(users.id, session.userId)).for("update");
      const [owned] = await tx.select({ n: count() }).from(employerProfiles).where(eq(employerProfiles.userId, session.userId));
      const limit = owner?.companyLimit ?? DEFAULT_COMPANY_LIMIT;
      if ((owned?.n ?? 0) >= limit) throw new CompanyLimitReached(limit);
      const [inserted] = await tx.insert(employerProfiles).values(values).returning({ id: employerProfiles.id });
      profileId = inserted.id;
    }

    // Addresses have no other table referencing their id (a job posting's
    // location is copied as plain text at pick time, not linked live), so a
    // full delete-and-recreate is simpler and just as safe as diffing rows.
    await tx.delete(employerAddresses).where(eq(employerAddresses.employerProfileId, profileId));
    // Exactly one default for job posts: the first one marked, else the first.
    const defaultIndex = Math.max(0, addresses.findIndex((a) => a.isJobDefault === true));
    // Rows are re-created in one statement, which would give them all the
    // same created_at — and the app orders addresses by it. A millisecond
    // apart keeps them in the order the employer entered them.
    const baseTime = Date.now();
    await tx.insert(employerAddresses).values(
      addresses.map((a, i) => ({
        employerProfileId: profileId,
        label: a.label.trim(),
        addressLine1: a.addressLine1.trim(),
        addressLine2: isNonEmptyString(a.addressLine2) ? a.addressLine2.trim() : null,
        area: isNonEmptyString(a.area) ? a.area.trim() : null,
        city: a.city.trim(),
        state: a.state,
        postcode: a.postcode.trim(),
        isJobDefault: i === defaultIndex,
        createdAt: new Date(baseTime + i),
      })),
    );

    await tx.delete(employerOnboardingDrafts).where(eq(employerOnboardingDrafts.userId, session.userId));
    return profileId;
  }).catch((err) => {
    if (err instanceof CompanyLimitReached) return err;
    throw err;
  });
  if (saved instanceof CompanyLimitReached) {
    return NextResponse.json(
      { error: `You've reached your limit of ${saved.limit} companies. Contact JobGiga to add more.` },
      { status: 403 },
    );
  }
  const profileId = saved;

  // Best-effort, after the main save succeeds — badges are supplementary,
  // never something that should fail the actual profile save. Required
  // fields are already validated above before the transaction even starts,
  // so reaching this point always means the profile is complete.
  await awardBadge(profileId, "profile_completed");
  if (values.logoUrl) await awardBadge(profileId, "logo_added");
  if (isProfileBoosted(values)) await awardBadge(profileId, "profile_boosted");

  // The stored banner path, so the form can swap the just-uploaded image data
  // for it (and not re-upload the same picture on its next save).
  // A brand-new company becomes the one the dashboard shows from now on.
  if (!access) await setActiveEmployerCompany(profileId);

  return NextResponse.json({
    ok: true,
    profileId,
    ...(resolvedBannerUrl !== undefined ? { bannerUrl: resolvedBannerUrl } : {}),
    ssmDocumentUrl: trimmedSsmDocumentUrl,
    ssmVerificationStatus,
  });
}

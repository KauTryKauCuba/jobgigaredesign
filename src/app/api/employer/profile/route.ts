import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerAddresses, employerOnboardingDrafts, employerProfiles } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { INDUSTRIES } from "@/lib/industries";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeHtml";
import { getSession } from "@/lib/session";

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
  city: string;
  state: (typeof MALAYSIA_STATES)[number];
  postcode: string;
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
        isNonEmptyString(a.city) &&
        typeof a.state === "string" &&
        (MALAYSIA_STATES as readonly string[]).includes(a.state) &&
        typeof a.postcode === "string" &&
        /^\d{5}$/.test(a.postcode.trim())
      );
    })
  );
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
    contactPhone,
    contactEmail,
    companyName,
    ssmNumber,
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
    recentNews,
  } = (body ?? {}) as Record<string, unknown>;

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
  if (!isOptionalString(companyPhone)) {
    return NextResponse.json({ error: "Invalid company phone number." }, { status: 400 });
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
  if (recentNews !== undefined && recentNews !== null && !isNewsItemArray(recentNews)) {
    return NextResponse.json({ error: "Invalid recent news." }, { status: 400 });
  }
  if (!isNonEmptyString(contactName)) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!isNonEmptyString(contactRole)) {
    return NextResponse.json({ error: "Enter your role at the company." }, { status: 400 });
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

  const values = {
    userId: session.userId,
    avatarUrl: isNonEmptyString(avatarUrl) ? avatarUrl.trim() : null,
    contactName: contactName.trim(),
    contactRole: contactRole.trim(),
    contactPhone: contactPhone.trim(),
    contactEmail: contactEmail.trim().toLowerCase(),
    companyName: companyName.trim(),
    ssmNumber: ssmNumber.trim(),
    industry: industry.trim(),
    industryCategory,
    companySize,
    companyDescription: isNonEmptyString(companyDescription)
      ? sanitizeDescriptionHtml(companyDescription.trim())
      : null,
    logoUrl: isNonEmptyString(logoUrl) ? logoUrl.trim() : null,
    benefits: benefits.map((b) => b.trim()),
    websiteUrl: isNonEmptyString(websiteUrl) ? websiteUrl.trim() : null,
    companyEmail: isNonEmptyString(companyEmail) ? companyEmail.trim().toLowerCase() : null,
    companyPhone: isNonEmptyString(companyPhone) ? companyPhone.trim() : null,
    companyLinkedin: isNonEmptyString(companyLinkedin) ? companyLinkedin.trim() : null,
    companyFacebook: isNonEmptyString(companyFacebook) ? companyFacebook.trim() : null,
    companyInstagram: isNonEmptyString(companyInstagram) ? companyInstagram.trim() : null,
    foundedYear: typeof foundedYear === "number" ? foundedYear : null,
    companyType: isNonEmptyString(companyType) ? companyType : null,
    officePhotoUrl: isNonEmptyString(officePhotoUrl) ? officePhotoUrl.trim() : null,
    recentNews: isNewsItemArray(recentNews)
      ? recentNews.map((item) => ({ title: item.title.trim(), url: item.url.trim() }))
      : [],
    updatedAt: new Date(),
  };

  // Existing company (owner or invited team member editing "Company
  // Profile") vs. a brand-new one being created for the first time —
  // resolved before the transaction since it decides insert vs. update.
  const access = await getEmployerAccess(session.userId);

  await db.transaction(async (tx) => {
    let profileId: string;
    if (access) {
      // Update the shared row in place. `values.userId` must NOT be written
      // here — it's the company's original owner, and a team member saving
      // an edit should never reassign that just by submitting this form.
      // Destructured only to exclude it from updateValues, per the comment above.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId: _ownerUserId, ...updateValues } = values;
      const [updated] = await tx
        .update(employerProfiles)
        .set(updateValues)
        .where(eq(employerProfiles.id, access.profile.id))
        .returning({ id: employerProfiles.id });
      profileId = updated.id;
    } else {
      // First-time onboarding — this user becomes the new company's owner.
      const [inserted] = await tx.insert(employerProfiles).values(values).returning({ id: employerProfiles.id });
      profileId = inserted.id;
    }

    // Addresses have no other table referencing their id (a job posting's
    // location is copied as plain text at pick time, not linked live), so a
    // full delete-and-recreate is simpler and just as safe as diffing rows.
    await tx.delete(employerAddresses).where(eq(employerAddresses.employerProfileId, profileId));
    await tx.insert(employerAddresses).values(
      addresses.map((a) => ({
        employerProfileId: profileId,
        label: a.label.trim(),
        addressLine1: a.addressLine1.trim(),
        addressLine2: isNonEmptyString(a.addressLine2) ? a.addressLine2.trim() : null,
        city: a.city.trim(),
        state: a.state,
        postcode: a.postcode.trim(),
      })),
    );

    await tx.delete(employerOnboardingDrafts).where(eq(employerOnboardingDrafts.userId, session.userId));
  });

  return NextResponse.json({ ok: true });
}

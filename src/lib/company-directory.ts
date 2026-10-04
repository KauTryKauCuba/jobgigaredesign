import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import { employerAddresses, employerProfiles, jobPostings } from "./db/schema";
import { getEmployerResponsiveness } from "./application-events";
import { getEarnedBadges, type BadgeKey } from "./badges";
import { isUuid } from "./uuid";

// The public "Find companies" directory. Only public-facing company details
// are ever selected here — never the registering contact's name, phone or
// email, which belong to the employer's account, not the company page.

// Correlated subqueries are written with explicit table names: in a
// single-table select Drizzle renders `${employerProfiles.id}` unqualified
// ("id"), which inside the subquery would bind to the subquery's own table.
const headlineLocation = sql<string | null>`(
  select ea.city || ', ' || ea.state
  from employer_addresses ea
  where ea.employer_profile_id = employer_profiles.id
  order by ea.created_at asc
  limit 1
)`;

const openRoles = sql<number>`(
  select count(*)::int from job_postings jp
  where jp.employer_profile_id = employer_profiles.id and jp.status = 'active'
)`;

// Earned badge keys (the card shows them in badge display order).
const badgeKeys = sql<BadgeKey[]>`(
  select coalesce(array_agg(eb.badge_key::text), '{}')
  from employer_badges eb
  where eb.employer_profile_id = employer_profiles.id
)`;

/** Every company, hiring ones first (most open roles), then A–Z. */
export async function getCompanyDirectory() {
  return db
    .select({
      id: employerProfiles.id,
      companyName: employerProfiles.companyName,
      logoUrl: employerProfiles.logoUrl,
      bannerUrl: employerProfiles.bannerUrl,
      industry: employerProfiles.industryCategory,
      companySize: employerProfiles.companySize,
      location: headlineLocation.as("location"),
      openRoles: openRoles.as("open_roles"),
      badgeKeys: badgeKeys.as("badge_keys"),
    })
    .from(employerProfiles)
    .orderBy(desc(openRoles), asc(employerProfiles.companyName));
}

export type DirectoryCompany = Awaited<ReturnType<typeof getCompanyDirectory>>[number];

/**
 * One company's public page: its details plus its currently open jobs.
 * Wrapped in React's cache() — the page and its generateMetadata both call
 * this, and should share one set of queries per request.
 */
export const getPublicCompany = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const [company] = await db
    .select({
      id: employerProfiles.id,
      companyName: employerProfiles.companyName,
      logoUrl: employerProfiles.logoUrl,
      bannerUrl: employerProfiles.bannerUrl,
      industry: employerProfiles.industryCategory,
      // The employer's own free-text description of their industry (e.g.
      // "Events Services"), as opposed to the fixed category above.
      industryDetail: employerProfiles.industry,
      companySize: employerProfiles.companySize,
      companyType: employerProfiles.companyType,
      // The company's general contact details — the profile form collects
      // these as "a way for candidates to reach you", unlike the registering
      // contact's own phone/email, which stay private.
      companyEmail: employerProfiles.companyEmail,
      companyPhone: employerProfiles.companyPhone,
      recentNews: employerProfiles.recentNews,
      joinedAt: employerProfiles.createdAt,
      foundedYear: employerProfiles.foundedYear,
      companyDescription: employerProfiles.companyDescription,
      benefits: employerProfiles.benefits,
      websiteUrl: employerProfiles.websiteUrl,
      companyLinkedin: employerProfiles.companyLinkedin,
      companyFacebook: employerProfiles.companyFacebook,
      companyInstagram: employerProfiles.companyInstagram,
      officePhotoUrl: employerProfiles.officePhotoUrl,
      location: headlineLocation.as("location"),
    })
    .from(employerProfiles)
    .where(eq(employerProfiles.id, id))
    .limit(1);
  if (!company) return null;

  const addressesQuery = db
    .select({
      id: employerAddresses.id,
      label: employerAddresses.label,
      addressLine1: employerAddresses.addressLine1,
      addressLine2: employerAddresses.addressLine2,
      city: employerAddresses.city,
      state: employerAddresses.state,
      postcode: employerAddresses.postcode,
    })
    .from(employerAddresses)
    .where(eq(employerAddresses.employerProfileId, id))
    .orderBy(asc(employerAddresses.createdAt));

  const jobsQuery = db
    .select({
      id: jobPostings.id,
      slug: jobPostings.slug,
      title: jobPostings.title,
      location: jobPostings.location,
      employmentType: jobPostings.employmentType,
      workArrangement: jobPostings.workArrangement,
      salaryMin: jobPostings.salaryMin,
      salaryMax: jobPostings.salaryMax,
      createdAt: jobPostings.createdAt,
    })
    .from(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, id), eq(jobPostings.status, "active")))
    .orderBy(desc(jobPostings.createdAt));

  const [addresses, jobs, badges, responsiveness] = await Promise.all([
    addressesQuery,
    jobsQuery,
    getEarnedBadges(id),
    getEmployerResponsiveness([id]),
  ]);
  return {
    company,
    addresses,
    jobs,
    badges,
    responsiveness: responsiveness.get(id) ?? null,
  };
});

export type PublicCompany = NonNullable<Awaited<ReturnType<typeof getPublicCompany>>>;

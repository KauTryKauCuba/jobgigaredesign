// Shared between scripts/seed.ts and the "Get/Remove dummy data" button's
// API routes (src/app/api/employer/dummy-companies) — the single source of
// truth for what the two ParcelTracker/WHALE dummy companies look like and
// how they're created, so the script and the in-app button can never drift
// apart on what counts as "dummy" or what gets recreated. Deliberately has
// no "server-only" import and takes `db` as a plain parameter (typed loosely
// as `any` — the seed script's standalone `drizzle(pool)` and the app's
// schema-typed `db` aren't quite the same generic instantiation, and this
// module has no business caring) so scripts/seed.ts can import it too; that
// script runs via tsx outside Next's build, where "server-only" throws.
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, like } from "drizzle-orm";
import { employerAddresses, employerProfiles, employerTeamMembers, users } from "./db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = NodePgDatabase<any>;

export const DUMMY_SEED_EMAIL_DOMAIN = "seed.jobgiga.test";
export const PARCELTRACKER_OWNER_EMAIL = `parceltracker-owner@${DUMMY_SEED_EMAIL_DOMAIN}`;
export const WHALE_OWNER_EMAIL = `whale-owner@${DUMMY_SEED_EMAIL_DOMAIN}`;

type DummyCompanyDef = {
  targetRole: "owner" | "admin";
  ownerEmail: string;
  ownerName: string;
  ownerContactRole: string;
  ownerContactPhone: string;
  company: Omit<typeof employerProfiles.$inferInsert, "userId" | "contactName" | "contactRole" | "contactPhone" | "contactEmail">;
  address: Omit<typeof employerAddresses.$inferInsert, "employerProfileId">;
};

const DUMMY_COMPANIES: DummyCompanyDef[] = [
  {
    targetRole: "owner",
    ownerEmail: PARCELTRACKER_OWNER_EMAIL,
    ownerName: "Rui Hao Chan",
    ownerContactRole: "Founder",
    ownerContactPhone: "+60 12-345 6789",
    company: {
      companyName: "ParcelTracker",
      ssmNumber: "202301012345",
      industry: "Business software for logistics",
      industryCategory: "Information Technology & Software",
      companySize: "51-200",
      companyDescription:
        "ParcelTracker builds the scanning, sorting, and tracking software that couriers and warehouse teams rely on to move parcels reliably. We work with logistics operators across Southeast Asia to replace paper-based tracking with real-time visibility.",
      logoUrl: "/logos/parceltracker.svg",
      benefits: ["Remote-friendly", "Health insurance", "Annual learning budget", "Flexible hours"],
      websiteUrl: "https://parceltracker.com",
      companyEmail: `hello@parceltracker.${DUMMY_SEED_EMAIL_DOMAIN}`,
      companyPhone: "+60 3-2345 6789",
      foundedYear: 2018,
      companyType: "Startup",
    },
    address: {
      label: "Headquarters",
      addressLine1: "Level 12, Menara Prestige",
      addressLine2: "1 Jalan Pinang",
      city: "Kuala Lumpur",
      state: "Wilayah Persekutuan Kuala Lumpur",
      postcode: "50450",
    },
  },
  {
    targetRole: "admin",
    ownerEmail: WHALE_OWNER_EMAIL,
    ownerName: "Mei Lin Tan",
    ownerContactRole: "Operations Director",
    ownerContactPhone: "+60 16-789 0123",
    company: {
      companyName: "WHALE",
      ssmNumber: "201901054321",
      industry: "Process documentation software",
      industryCategory: "Information Technology & Software",
      companySize: "11-50",
      companyDescription:
        "WHALE helps operations teams turn messy, tribal-knowledge processes into clear, easy-to-follow SOPs — used by manufacturing and F&B teams to document how work actually gets done.",
      logoUrl: "/logos/whale.svg",
      benefits: ["Hybrid work", "Health insurance", "Team offsites"],
      websiteUrl: "https://usewhale.io",
      companyEmail: `hello@usewhale.${DUMMY_SEED_EMAIL_DOMAIN}`,
      companyPhone: "+60 3-7890 1234",
      foundedYear: 2021,
      companyType: "SME",
    },
    address: {
      label: "Headquarters",
      addressLine1: "Suite 8-2, Wisma Tech",
      city: "Petaling Jaya",
      state: "Selangor",
      postcode: "46200",
    },
  },
];

// Removes every dummy company the given user currently has team access to —
// the whole company (cascading its address and every team member row,
// including the dummy owner's own), not just this user's membership, since
// these only ever exist as a fully synthetic, wholesale-replaceable fixture.
// Also removes the dummy owner accounts themselves (safe once their
// employerProfiles row is gone) — otherwise a later seedDummyCompanies call
// would hit users.email's unique constraint trying to recreate them.
// Returns how many companies were removed.
export async function removeDummyCompanies(db: AnyDb, targetUserId: string): Promise<number> {
  const rows = await db
    .select({ profileId: employerProfiles.id, ownerUserId: employerProfiles.userId })
    .from(employerTeamMembers)
    .innerJoin(employerProfiles, eq(employerProfiles.id, employerTeamMembers.employerProfileId))
    .innerJoin(users, eq(users.id, employerProfiles.userId))
    .where(and(eq(employerTeamMembers.userId, targetUserId), like(users.email, `%@${DUMMY_SEED_EMAIL_DOMAIN}`)));

  const profileIds = [...new Set(rows.map((r) => r.profileId))];
  const ownerUserIds = [...new Set(rows.map((r) => r.ownerUserId))];
  if (profileIds.length > 0) {
    await db.delete(employerProfiles).where(inArray(employerProfiles.id, profileIds));
  }
  if (ownerUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, ownerUserIds));
  }
  return profileIds.length;
}

// Creates both dummy companies fresh and grants targetUser access to each
// (Owner-level team access on ParcelTracker, Admin on WHALE — team access,
// not direct employerProfiles ownership, so this works no matter what
// targetUser already owns directly). Removes any of its own previous dummy
// companies first, so this is safe to call repeatedly ("Get dummy data"
// after a previous "Remove", or clicked twice) without piling up
// duplicates.
export async function seedDummyCompanies(db: AnyDb, targetUser: { id: string; name: string | null }, targetEmail: string): Promise<void> {
  await removeDummyCompanies(db, targetUser.id);

  for (const def of DUMMY_COMPANIES) {
    const [owner] = await db.insert(users).values({ email: def.ownerEmail, name: def.ownerName, role: "employer" }).returning();

    const [company] = await db
      .insert(employerProfiles)
      .values({
        ...def.company,
        userId: owner.id,
        contactName: def.ownerName,
        contactRole: def.ownerContactRole,
        contactPhone: def.ownerContactPhone,
        contactEmail: def.ownerEmail,
      })
      .returning();

    await db.insert(employerAddresses).values({ ...def.address, employerProfileId: company.id });

    await db.insert(employerTeamMembers).values([
      { employerProfileId: company.id, userId: owner.id, email: owner.email, role: "owner", status: "active", joinedAt: new Date() },
      {
        employerProfileId: company.id,
        userId: targetUser.id,
        email: targetEmail,
        role: def.targetRole,
        status: "active",
        joinedAt: new Date(),
      },
    ]);
  }
}

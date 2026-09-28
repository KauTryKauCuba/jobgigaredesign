import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { employerBadges } from "./db/schema";
import type { BadgeKey } from "./badge-definitions";

export type { BadgeKey } from "./badge-definitions";
export { BADGE_DEFINITIONS } from "./badge-definitions";

// Safe to call unconditionally whenever the qualifying condition is true —
// the unique (employerProfileId, badgeKey) constraint on employer_badges
// makes this idempotent, so only the very first call actually writes a row.
// Deliberately not awaited by callers as something that can fail the
// underlying action — badges are supplementary, not core data (see
// src/lib/db/schema.ts's employerBadges comment for why they're logged
// permanently rather than derived live).
export async function awardBadge(employerProfileId: string, key: BadgeKey): Promise<void> {
  await db.insert(employerBadges).values({ employerProfileId, badgeKey: key }).onConflictDoNothing();
}

export type EarnedBadge = { key: BadgeKey; earnedAt: Date };

export async function getEarnedBadges(employerProfileId: string): Promise<EarnedBadge[]> {
  const rows = await db
    .select({ badgeKey: employerBadges.badgeKey, earnedAt: employerBadges.earnedAt })
    .from(employerBadges)
    .where(eq(employerBadges.employerProfileId, employerProfileId));
  return rows.map((r) => ({ key: r.badgeKey, earnedAt: r.earnedAt }));
}

// The exact field list EmployerOnboardingForm.tsx's client-side
// `boostChecklist` checks — kept here too so the server-side "profile_boosted"
// award never drifts from what the UI checklist shows as complete.
export function isProfileBoosted(profile: {
  logoUrl: string | null;
  companyDescription: string | null;
  websiteUrl: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLinkedin: string | null;
  foundedYear: number | null;
  companyType: string | null;
}): boolean {
  return (
    !!profile.logoUrl &&
    !!profile.companyDescription &&
    !!profile.websiteUrl &&
    !!profile.companyEmail &&
    !!profile.companyPhone &&
    !!profile.companyLinkedin &&
    profile.foundedYear !== null &&
    !!profile.companyType
  );
}

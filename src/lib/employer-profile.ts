import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import {
  employerAddresses,
  employerProfiles,
  employerTeamActivity,
  employerTeamMembers,
  jobApplications,
  jobPostings,
  users,
} from "./db/schema";
import { getSession } from "./session";
import { employerHomePath, hasFullAccess, TEAM_ROLES, type TeamRole } from "./team-roles";

/**
 * Every company this account registered itself (employerProfiles.userId —
 * the registrant), oldest first. One account can register several, up to
 * its company limit (src/lib/company-limit.ts). A team member invited
 * afterward has no row here; use `getEmployerAccess`/`getEmployerProfileForUser`
 * below for "can this user use the employer dashboard, whoever they are."
 */
export async function getOwnedEmployerProfiles(userId: string) {
  return db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, userId))
    .orderBy(asc(employerProfiles.createdAt));
}

export type EmployerProfile = typeof employerProfiles.$inferSelect;

export type EmployerRole = TeamRole;

// `joinedAt` is when *this user* joined *this* company — the owned
// company's own createdAt for a direct owner (there may be no self-healed
// employerTeamMembers row yet to read it from), else the invited member's
// own joinedAt.
export type EmployerMembership = { profile: EmployerProfile; role: EmployerRole; joinedAt: Date };

/**
 * Every company this user belongs to — the ones they registered themselves
 * (oldest first), then every company they're an active invited member of,
 * oldest invite first. This is the full list the company switcher renders,
 * and what `getEmployerAccess` picks a "current" one from.
 */
// Wrapped in cache() — getEmployerAccess and getEmployerProfileForUser both
// call this, and a page can end up calling more than one of those per
// render, so without memoizing it re-ran this join (and getOwnedEmployerProfiles
// inside it) several times over per request.
export const getEmployerMemberships = cache(async (userId: string): Promise<EmployerMembership[]> => {
  const owned = await getOwnedEmployerProfiles(userId);
  const ownedIds = new Set(owned.map((p) => p.id));

  const rows = await db
    .select({ profile: employerProfiles, role: employerTeamMembers.role, joinedAt: employerTeamMembers.joinedAt })
    .from(employerTeamMembers)
    .innerJoin(employerProfiles, eq(employerProfiles.id, employerTeamMembers.employerProfileId))
    .where(and(eq(employerTeamMembers.userId, userId), eq(employerTeamMembers.status, "active")))
    .orderBy(asc(employerTeamMembers.invitedAt));

  const memberships: EmployerMembership[] = owned.map((p) => ({ profile: p, role: "owner" as const, joinedAt: p.createdAt }));
  for (const row of rows) {
    // An owned company's own self-heal membership row (see
    // getEmployerTeamMembers) would otherwise show up a second time here.
    if (ownedIds.has(row.profile.id)) continue;
    memberships.push({ profile: row.profile, role: row.role, joinedAt: row.joinedAt ?? row.profile.createdAt });
  }
  return memberships;
});

/**
 * The general-purpose "does this user belong to a company, and as what
 * role, right now" resolver. Every route/page that used to do
 * a direct lookup by registrant to mean "the employer" should use
 * this instead, so an invited teammate isn't treated as having no company.
 *
 * A person can belong to more than one company (their own plus an invite
 * elsewhere, or several invites) — `getEmployerMemberships` returns all of
 * them; this picks whichever one the session says is "current"
 * (`employerProfileId`, set by the company switcher via
 * `setActiveEmployerCompany`), falling back to the first membership
 * (first registered company, else the oldest invite) if the session hasn't picked one
 * yet or points at a company this user no longer belongs to. That fallback
 * is deliberately not persisted back into the cookie here — Next.js only
 * allows cookie mutation from a Server Action or Route Handler, and this
 * runs from plain Server Components too; every caller just gets the same
 * deterministic default on every request until they actually switch.
 */
export const getEmployerAccess = cache(async (userId: string): Promise<EmployerMembership | null> => {
  const memberships = await getEmployerMemberships(userId);
  if (memberships.length === 0) return null;

  const session = await getSession();
  if (session?.employerProfileId) {
    const current = memberships.find((m) => m.profile.id === session.employerProfileId);
    if (current) return current;
  }
  return memberships[0];
});

/**
 * `getEmployerAccess`, but only for an Owner or Admin — null for a Hiring
 * manager or Panel member. For routes that change the company account itself
 * (company profile, team, ads, posters, sample data), so a scoped teammate
 * gets the same "not found" as someone with no company at all.
 */
export async function getFullEmployerAccess(userId: string): Promise<EmployerMembership | null> {
  const access = await getEmployerAccess(userId);
  return access && hasFullAccess(access.role) ? access : null;
}

/**
 * For pages that are Owner/Admin only (Post a job, Poster generator, Company
 * Profile, Advertisement, Team): a Hiring manager or Panel member opening one
 * (an old link, a bookmark) is sent to their own dashboard home instead.
 */
export async function redirectScopedTeammate(userId: string) {
  const access = await getEmployerAccess(userId);
  if (access && !hasFullAccess(access.role)) redirect(employerHomePath(access.role));
}

/** Same return shape as `getEmployerProfile`, but resolved via `getEmployerAccess` — a drop-in replacement everywhere a page/route only needs the profile, not the caller's role within it. */
export async function getEmployerProfileForUser(userId: string): Promise<EmployerProfile | null> {
  const access = await getEmployerAccess(userId);
  return access?.profile ?? null;
}

/**
 * Links this user id to any pending team invite(s) sent to this email —
 * called right after sign-in/signup resolves a `users` row, for both the
 * OTP and Google flows, so "invite someone by email" actually connects to
 * their account the moment they show up with that email, whether they're a
 * brand-new user or already had an account from before the invite existed.
 * A no-op (and cheap — one indexed query) for the overwhelming majority of
 * sign-ins that were never invited to anything.
 */
/**
 * Whether this email has a team invite waiting — lets "Sign in" (which
 * otherwise refuses emails with no account yet) go through for an invited
 * teammate, since the invite email tells them to sign in.
 */
export async function hasPendingTeamInvite(email: string): Promise<boolean> {
  const [invite] = await db
    .select({ id: employerTeamMembers.id })
    .from(employerTeamMembers)
    .where(liveInviteFor(email))
    .limit(1);
  return !!invite;
}

// A pending invite for this email whose link hasn't expired (invites from
// before links expired have no expiry and still count).
function liveInviteFor(email: string) {
  return and(
    eq(employerTeamMembers.email, email.trim().toLowerCase()),
    eq(employerTeamMembers.status, "pending"),
    or(isNull(employerTeamMembers.inviteExpiresAt), gt(employerTeamMembers.inviteExpiresAt, new Date())),
  );
}

export async function activatePendingTeamInvites(userId: string, email: string) {
  const joined = await db
    .update(employerTeamMembers)
    .set({ userId, status: "active", joinedAt: new Date() })
    .where(liveInviteFor(email))
    .returning({ employerProfileId: employerTeamMembers.employerProfileId, email: employerTeamMembers.email, role: employerTeamMembers.role });
  // Shows up in the inviting company's Team activity.
  await Promise.all(
    joined.map((row) =>
      logTeamActivity({
        employerProfileId: row.employerProfileId,
        actorUserId: userId,
        actorLabel: row.email,
        action: "joined",
        targetEmail: row.email,
        toRole: row.role,
      }),
    ),
  );
}

// An employer's saved offices/branches, oldest (the one they set up during
// onboarding) first — the Company Profile page shows them in this order, and
// a job posting's "use a saved address" picker takes this same order.
export async function getEmployerAddresses(employerProfileId: string) {
  return db
    .select()
    .from(employerAddresses)
    .where(eq(employerAddresses.employerProfileId, employerProfileId))
    .orderBy(asc(employerAddresses.createdAt));
}

export type EmployerAddress = Awaited<ReturnType<typeof getEmployerAddresses>>[number];

// The company's team — the employer that created the account (via
// employerProfiles.userId) is self-healed into an "owner" row here the
// first time this is called for them, since employerTeamMembers didn't
// exist for any account created before this table did. Ordered owners
// first, then by who was invited earliest, so the page reads top-down as
// "most senior first" rather than shuffling on every load.
export async function getEmployerTeamMembers(employerProfileId: string, ownerUserId: string) {
  const [hasOwnerRow] = await db
    .select({ id: employerTeamMembers.id })
    .from(employerTeamMembers)
    .where(eq(employerTeamMembers.employerProfileId, employerProfileId))
    .limit(1);

  if (!hasOwnerRow) {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerUserId)).limit(1);
    if (owner) {
      await db
        .insert(employerTeamMembers)
        .values({
          employerProfileId,
          userId: owner.id,
          email: owner.email,
          role: "owner",
          status: "active",
          joinedAt: owner.createdAt,
        })
        .onConflictDoNothing();
    }
  }

  const rows = await db
    .select({
      id: employerTeamMembers.id,
      userId: employerTeamMembers.userId,
      email: employerTeamMembers.email,
      role: employerTeamMembers.role,
      position: employerTeamMembers.position,
      status: employerTeamMembers.status,
      invitedAt: employerTeamMembers.invitedAt,
      joinedAt: employerTeamMembers.joinedAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
      inviteExpiresAt: employerTeamMembers.inviteExpiresAt,
    })
    .from(employerTeamMembers)
    .leftJoin(users, eq(users.id, employerTeamMembers.userId))
    .where(eq(employerTeamMembers.employerProfileId, employerProfileId))
    .orderBy(asc(employerTeamMembers.invitedAt));

  // The company's registrant (ownerUserId) goes by employerProfiles.contactName
  // on this side of the app (set on My Profile/onboarding) — `users.name` is
  // only the Google-sign-in/account-level fallback, which can drift stale
  // once someone edits their employer contact name, same distinction
  // resolveNameForRole makes for Navbar/My Profile.
  // Same for their photo: the one uploaded on My Profile
  // (employerProfiles.avatarUrl, what the Navbar shows), falling back to the
  // Google account photo.
  const [ownerProfile] = await db
    .select({ contactName: employerProfiles.contactName, avatarUrl: employerProfiles.avatarUrl })
    .from(employerProfiles)
    .where(eq(employerProfiles.id, employerProfileId))
    .limit(1);

  const withOwnerName = ownerProfile
    ? rows.map((row) =>
        row.userId === ownerUserId
          ? { ...row, name: ownerProfile.contactName, avatarUrl: ownerProfile.avatarUrl ?? row.avatarUrl }
          : row,
      )
    : rows;

  return withOwnerName
    .map((row) => ({
      ...row,
      isRegistrant: row.userId === ownerUserId,
      // A pending invite whose link has run out — the Team page offers Resend.
      inviteExpired: row.status === "pending" && !!row.inviteExpiresAt && row.inviteExpiresAt.getTime() < Date.now(),
    }))
    // Most senior first: owners, admins, hiring managers, then panel.
    .sort((a, b) => TEAM_ROLES.indexOf(a.role) - TEAM_ROLES.indexOf(b.role));
}

export type EmployerTeamMember = Awaited<ReturnType<typeof getEmployerTeamMembers>>[number];

type TeamActivityAction =
  | "invited"
  | "resent_invite"
  | "role_changed"
  | "removed"
  | "declined"
  | "joined"
  | "job_assigned"
  | "job_unassigned";

// Called alongside every team-management write (invite, resend, role
// change, remove) — never awaited by the caller as a blocker on the user
// action itself succeeding, just recorded straight after it. `actorLabel`
// and `targetEmail` are snapshotted at call time so the log reads correctly
// even after the actor or the target member row is later gone/renamed.
export async function logTeamActivity(params: {
  employerProfileId: string;
  actorUserId: string | null;
  actorLabel: string;
  action: TeamActivityAction;
  targetEmail: string;
  fromRole?: EmployerRole;
  toRole?: EmployerRole;
  detail?: string | null;
}) {
  await db.insert(employerTeamActivity).values({
    employerProfileId: params.employerProfileId,
    actorUserId: params.actorUserId,
    actorLabel: params.actorLabel,
    action: params.action,
    targetEmail: params.targetEmail,
    fromRole: params.fromRole,
    toRole: params.toRole,
    detail: params.detail ?? null,
  });
}

// Newest first, capped — this backs the Team page's activity list, not a
// full audit export.
export async function getEmployerTeamActivity(employerProfileId: string, limit = 30) {
  return db
    .select()
    .from(employerTeamActivity)
    .where(eq(employerTeamActivity.employerProfileId, employerProfileId))
    .orderBy(desc(employerTeamActivity.createdAt))
    .limit(limit);
}

export type EmployerTeamActivityEntry = Awaited<ReturnType<typeof getEmployerTeamActivity>>[number];

// Display label for `logTeamActivity`'s `actorLabel` snapshot — name if set,
// else email, same fallback the team list itself uses for a member with no
// name yet.
export async function getActorLabel(userId: string): Promise<string> {
  const [user] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.name || user?.email || "Someone";
}

/**
 * For the marketing homepage's "companies hiring on JobGiga" social-proof
 * card — every employer who has actually posted at least one job, with
 * their live (active) count so the freshest, most active companies surface
 * first. Ordered by active postings, then total postings, so a company that
 * only ever made one draft still doesn't outrank someone actively hiring.
 */
export async function getEmployersWithPostings(limit: number) {
  const activeCount = sql<number>`count(*) filter (where ${jobPostings.status} = 'active')`.as("active_count");
  const totalCount = count(jobPostings.id).as("total_count");
  return db
    .select({
      companyName: employerProfiles.companyName,
      industry: employerProfiles.industryCategory,
      // Oldest saved address (their original onboarding one) as the
      // headline "City, State" — good enough for this teaser card, not
      // meant to represent every branch.
      location: sql<string>`(
        select ${employerAddresses.city} || ', ' || ${employerAddresses.state}
        from ${employerAddresses}
        where ${employerAddresses.employerProfileId} = ${employerProfiles.id}
        order by ${employerAddresses.createdAt} asc
        limit 1
      )`.as("location"),
      logoUrl: employerProfiles.logoUrl,
      activeCount,
      totalCount,
    })
    .from(employerProfiles)
    .innerJoin(jobPostings, eq(jobPostings.employerProfileId, employerProfiles.id))
    .groupBy(employerProfiles.id)
    .orderBy(desc(activeCount), desc(totalCount))
    .limit(limit);
}

/**
 * For the same "Companies already hiring here" card's second page — one row
 * per active posting (not grouped by company, unlike getEmployersWithPostings
 * above), newest first, so that page can answer "who just posted a job"
 * instead of "who's hiring overall".
 */
export async function getLatestActivePostings(limit: number) {
  return db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      createdAt: jobPostings.createdAt,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobPostings)
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(eq(jobPostings.status, "active"))
    .orderBy(desc(jobPostings.createdAt))
    .limit(limit);
}

/**
 * For the same card's third page — the latest shortlist/interview moves
 * across every employer, newest first. `updatedAt` is set explicitly by the
 * PATCH route on every status change (see api/employer/applications/[id]),
 * so it reliably means "when this application reached its current stage,"
 * not just "last touched for any reason." No candidate identity here — this
 * is proof employers are actively moving people through their pipeline, not
 * a peek at anyone's application.
 */
export async function getLatestShortlistAndInterviewActivity(limit: number) {
  return db
    .select({
      id: jobApplications.id,
      status: jobApplications.status,
      updatedAt: jobApplications.updatedAt,
      jobTitle: jobPostings.title,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
    .where(inArray(jobApplications.status, ["shortlisted", "interview"]))
    .orderBy(desc(jobApplications.updatedAt))
    .limit(limit);
}

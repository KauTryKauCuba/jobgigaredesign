import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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

/**
 * Everything from onboarding, for the dashboard's read-only profile summary
 * card. Direct-ownership only — this is the account that created the
 * company (employerProfiles.userId). A team member invited afterward has
 * no row here at all; use `getEmployerAccess`/`getEmployerProfileForUser`
 * below for "can this user use the employer dashboard, whoever they are."
 */
export async function getEmployerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export type EmployerProfile = NonNullable<Awaited<ReturnType<typeof getEmployerProfile>>>;

export type EmployerRole = "owner" | "admin";

// `joinedAt` is when *this user* joined *this* company — the owned
// company's own createdAt for a direct owner (there may be no self-healed
// employerTeamMembers row yet to read it from), else the invited member's
// own joinedAt.
export type EmployerMembership = { profile: EmployerProfile; role: EmployerRole; joinedAt: Date };

/**
 * Every company this user belongs to — the one they directly own (if any,
 * always first), then every company they're an active invited member of,
 * oldest invite first. A person can be on more than one (their own company
 * plus an invite elsewhere, or several invites with no company of their
 * own) — this is the full list the company switcher renders, and what
 * `getEmployerAccess` picks a "current" one from.
 */
export async function getEmployerMemberships(userId: string): Promise<EmployerMembership[]> {
  const owned = await getEmployerProfile(userId);

  const rows = await db
    .select({ profile: employerProfiles, role: employerTeamMembers.role, joinedAt: employerTeamMembers.joinedAt })
    .from(employerTeamMembers)
    .innerJoin(employerProfiles, eq(employerProfiles.id, employerTeamMembers.employerProfileId))
    .where(and(eq(employerTeamMembers.userId, userId), eq(employerTeamMembers.status, "active")))
    .orderBy(asc(employerTeamMembers.invitedAt));

  const memberships: EmployerMembership[] = [];
  if (owned) memberships.push({ profile: owned, role: "owner", joinedAt: owned.createdAt });
  for (const row of rows) {
    // The owned company's own self-heal membership row (see
    // getEmployerTeamMembers) would otherwise show up a second time here.
    if (owned && row.profile.id === owned.id) continue;
    memberships.push({ profile: row.profile, role: row.role, joinedAt: row.joinedAt ?? row.profile.createdAt });
  }
  return memberships;
}

/**
 * The general-purpose "does this user belong to a company, and as what
 * role, right now" resolver. Every route/page that used to do
 * `getEmployerProfile(session.userId)` to mean "the employer" should use
 * this instead, so an invited teammate isn't treated as having no company.
 *
 * A person can belong to more than one company (their own plus an invite
 * elsewhere, or several invites) — `getEmployerMemberships` returns all of
 * them; this picks whichever one the session says is "current"
 * (`employerProfileId`, set by the company switcher via
 * `setActiveEmployerCompany`), falling back to the first membership
 * (owned company, else the oldest invite) if the session hasn't picked one
 * yet or points at a company this user no longer belongs to. That fallback
 * is deliberately not persisted back into the cookie here — Next.js only
 * allows cookie mutation from a Server Action or Route Handler, and this
 * runs from plain Server Components too; every caller just gets the same
 * deterministic default on every request until they actually switch.
 */
export async function getEmployerAccess(userId: string): Promise<EmployerMembership | null> {
  const memberships = await getEmployerMemberships(userId);
  if (memberships.length === 0) return null;

  const session = await getSession();
  if (session?.employerProfileId) {
    const current = memberships.find((m) => m.profile.id === session.employerProfileId);
    if (current) return current;
  }
  return memberships[0];
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
export async function activatePendingTeamInvites(userId: string, email: string) {
  await db
    .update(employerTeamMembers)
    .set({ userId, status: "active", joinedAt: new Date() })
    .where(and(eq(employerTeamMembers.email, email.trim().toLowerCase()), eq(employerTeamMembers.status, "pending")));
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
      status: employerTeamMembers.status,
      invitedAt: employerTeamMembers.invitedAt,
      joinedAt: employerTeamMembers.joinedAt,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(employerTeamMembers)
    .leftJoin(users, eq(users.id, employerTeamMembers.userId))
    .where(eq(employerTeamMembers.employerProfileId, employerProfileId))
    .orderBy(asc(employerTeamMembers.invitedAt));

  return rows.sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
}

export type EmployerTeamMember = Awaited<ReturnType<typeof getEmployerTeamMembers>>[number];

type TeamActivityAction = "invited" | "resent_invite" | "role_changed" | "removed";

// Called alongside every team-management write (invite, resend, role
// change, remove) — never awaited by the caller as a blocker on the user
// action itself succeeding, just recorded straight after it. `actorLabel`
// and `targetEmail` are snapshotted at call time so the log reads correctly
// even after the actor or the target member row is later gone/renamed.
export async function logTeamActivity(params: {
  employerProfileId: string;
  actorUserId: string;
  actorLabel: string;
  action: TeamActivityAction;
  targetEmail: string;
  fromRole?: EmployerRole;
  toRole?: EmployerRole;
}) {
  await db.insert(employerTeamActivity).values({
    employerProfileId: params.employerProfileId,
    actorUserId: params.actorUserId,
    actorLabel: params.actorLabel,
    action: params.action,
    targetEmail: params.targetEmail,
    fromRole: params.fromRole,
    toRole: params.toRole,
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

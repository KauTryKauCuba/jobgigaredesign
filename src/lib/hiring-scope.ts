import "server-only";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import { employerTeamMembers, jobApplications, jobPostingHiringManagers, jobPostings, users } from "./db/schema";
import { getActorLabel, getEmployerAccess, logTeamActivity, type EmployerMembership } from "./employer-profile";
import { notify } from "./notifications";
import { hasFullAccess } from "./team-roles";
import { isUuid } from "./uuid";

/**
 * What part of the company's hiring the signed-in teammate can see.
 * Owners/Admins: everything. Hiring managers: the postings they're assigned
 * to, plus any candidate whose interview panel they're on. Panel members:
 * only the candidates whose interview panel they're on.
 */
export type HiringScope =
  | { kind: "all" }
  | { kind: "limited"; userId: string; jobPostingIds: string[] };

export type ScopedAccess = EmployerMembership & { scope: HiringScope };

/** The current company (see getEmployerAccess) plus the caller's hiring scope in it. */
export const getScopedEmployerAccess = cache(async (userId: string): Promise<ScopedAccess | null> => {
  const access = await getEmployerAccess(userId);
  if (!access) return null;
  if (hasFullAccess(access.role)) return { ...access, scope: { kind: "all" } };
  const jobPostingIds = access.role === "hiring_manager" ? await getAssignedJobPostingIds(access.profile.id, userId) : [];
  return { ...access, scope: { kind: "limited", userId, jobPostingIds } };
});

async function getAssignedJobPostingIds(employerProfileId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ jobPostingId: jobPostingHiringManagers.jobPostingId })
    .from(jobPostingHiringManagers)
    .innerJoin(employerTeamMembers, eq(employerTeamMembers.id, jobPostingHiringManagers.teamMemberId))
    .innerJoin(jobPostings, eq(jobPostings.id, jobPostingHiringManagers.jobPostingId))
    .where(
      and(
        eq(employerTeamMembers.userId, userId),
        eq(employerTeamMembers.employerProfileId, employerProfileId),
        eq(jobPostings.employerProfileId, employerProfileId),
      ),
    );
  return rows.map((r) => r.jobPostingId);
}

type ApplicationRef = { jobPostingId: string; interviewDetails: { interviewerUserIds?: string[] } | null };

function onPanel(scope: Extract<HiringScope, { kind: "limited" }>, application: ApplicationRef) {
  return (application.interviewDetails?.interviewerUserIds ?? []).includes(scope.userId);
}

/** Can see this application (its candidate, interview and evaluations). */
export function canViewApplication(scope: HiringScope, application: ApplicationRef): boolean {
  if (scope.kind === "all") return true;
  return scope.jobPostingIds.includes(application.jobPostingId) || onPanel(scope, application);
}

/** Can move this application through the pipeline (shortlist, schedule, reject…). Panel-only access can't. */
export function canManageApplication(scope: HiringScope, application: { jobPostingId: string }): boolean {
  return scope.kind === "all" || scope.jobPostingIds.includes(application.jobPostingId);
}

/** Can see this job posting (its page, applicants and stats). */
export function canViewJobPosting(scope: HiringScope, jobPostingId: string): boolean {
  return scope.kind === "all" || scope.jobPostingIds.includes(jobPostingId);
}

/** SQL filter matching canViewApplication — undefined for full access. Needs jobApplications + jobPostings joined. */
export function applicationScopeCondition(scope: HiringScope | undefined): SQL | undefined {
  if (!scope || scope.kind === "all") return undefined;
  const panel = sql`coalesce(${jobApplications.interviewDetails} -> 'interviewerUserIds', '[]'::jsonb) @> ${JSON.stringify([scope.userId])}::jsonb`;
  return scope.jobPostingIds.length > 0 ? or(inArray(jobPostings.id, scope.jobPostingIds), panel) : panel;
}

/** SQL filter matching canViewJobPosting — undefined for full access. */
export function jobPostingScopeCondition(scope: HiringScope | undefined): SQL | undefined {
  if (!scope || scope.kind === "all") return undefined;
  // An empty IN () isn't valid SQL — "no postings" is just false.
  return scope.jobPostingIds.length > 0 ? inArray(jobPostings.id, scope.jobPostingIds) : sql`false`;
}

export type JobHiringManager = {
  teamMemberId: string;
  userId: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  position: string | null;
  status: "active" | "pending";
};

/** Each posting's assigned Hiring managers, keyed by posting id (postings with none are absent). */
export async function getJobHiringManagers(jobPostingIds: string[]): Promise<Map<string, JobHiringManager[]>> {
  const result = new Map<string, JobHiringManager[]>();
  if (jobPostingIds.length === 0) return result;
  const rows = await db
    .select({
      jobPostingId: jobPostingHiringManagers.jobPostingId,
      teamMemberId: employerTeamMembers.id,
      userId: employerTeamMembers.userId,
      email: employerTeamMembers.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      position: employerTeamMembers.position,
      status: employerTeamMembers.status,
    })
    .from(jobPostingHiringManagers)
    .innerJoin(employerTeamMembers, eq(employerTeamMembers.id, jobPostingHiringManagers.teamMemberId))
    .leftJoin(users, eq(users.id, employerTeamMembers.userId))
    .where(
      and(
        inArray(jobPostingHiringManagers.jobPostingId, jobPostingIds),
        // A member moved off the role keeps no assignments (the team route
        // clears them), but this keeps any stragglers from counting.
        eq(employerTeamMembers.role, "hiring_manager"),
      ),
    )
    .orderBy(jobPostingHiringManagers.createdAt);
  for (const { jobPostingId, ...manager } of rows) {
    const list = result.get(jobPostingId) ?? [];
    list.push(manager);
    result.set(jobPostingId, list);
  }
  return result;
}

/** Each Hiring manager's assigned postings (id + title), keyed by team-member id. */
export async function getMemberJobAssignments(
  employerProfileId: string,
): Promise<Map<string, { id: string; title: string }[]>> {
  const rows = await db
    .select({
      teamMemberId: jobPostingHiringManagers.teamMemberId,
      id: jobPostings.id,
      title: jobPostings.title,
    })
    .from(jobPostingHiringManagers)
    .innerJoin(jobPostings, eq(jobPostings.id, jobPostingHiringManagers.jobPostingId))
    .where(eq(jobPostings.employerProfileId, employerProfileId))
    .orderBy(jobPostings.title);
  const result = new Map<string, { id: string; title: string }[]>();
  for (const { teamMemberId, ...job } of rows) {
    const list = result.get(teamMemberId) ?? [];
    list.push(job);
    result.set(teamMemberId, list);
  }
  return result;
}

type Actor = { userId: string };

async function logAndNotifyAssignments(params: {
  employerProfileId: string;
  companyName: string;
  actor: Actor;
  added: { email: string; userId: string | null; jobPostingId: string; jobTitle: string }[];
  removed: { email: string; jobTitle: string }[];
}) {
  if (params.added.length === 0 && params.removed.length === 0) return;
  const actorLabel = await getActorLabel(params.actor.userId);
  await Promise.all([
    ...params.added.map((a) =>
      logTeamActivity({
        employerProfileId: params.employerProfileId,
        actorUserId: params.actor.userId,
        actorLabel,
        action: "job_assigned",
        targetEmail: a.email,
        detail: a.jobTitle,
      }),
    ),
    ...params.removed.map((r) =>
      logTeamActivity({
        employerProfileId: params.employerProfileId,
        actorUserId: params.actor.userId,
        actorLabel,
        action: "job_unassigned",
        targetEmail: r.email,
        detail: r.jobTitle,
      }),
    ),
  ]);
  // Only people who've joined have an account to notify — a pending invite
  // sees their jobs once they accept.
  await Promise.all(
    params.added
      .filter((a) => a.userId)
      .map((a) =>
        notify(
          [a.userId],
          "employer",
          {
            type: "hiring_manager_assigned",
            title: `You're the hiring manager for ${a.jobTitle}`,
            body: `${params.companyName} · you'll be notified when someone applies.`,
            link: `/employer/applicants?jobId=${a.jobPostingId}`,
          },
          { exceptUserId: params.actor.userId },
        ),
      ),
  );
}

/**
 * Parses a `hiringManagerIds` request field: undefined = leave as-is, an
 * array of this company's Hiring-manager team-member ids = set to exactly
 * those, anything else = an error message. Checked before a posting is
 * written so a bad list never leaves a half-saved posting behind.
 */
export async function parseHiringManagerIds(
  employerProfileId: string,
  value: unknown,
): Promise<{ ok: true; ids: string[] | undefined } | { ok: false; error: string }> {
  if (value === undefined) return { ok: true, ids: undefined };
  if (!Array.isArray(value) || !value.every((v) => isUuid(v))) {
    return { ok: false, error: "Invalid hiring managers." };
  }
  const ids = [...new Set(value as string[])];
  if (ids.length === 0) return { ok: true, ids };
  const rows = await db
    .select({ id: employerTeamMembers.id })
    .from(employerTeamMembers)
    .where(
      and(
        eq(employerTeamMembers.employerProfileId, employerProfileId),
        eq(employerTeamMembers.role, "hiring_manager"),
        inArray(employerTeamMembers.id, ids),
      ),
    );
  if (rows.length !== ids.length) {
    return { ok: false, error: "Hiring managers must be on your team with the Hiring manager role." };
  }
  return { ok: true, ids };
}

/**
 * Sets exactly which Hiring managers cover one posting (from Post a job or
 * the posting's page). Ids that aren't this company's Hiring managers are
 * refused rather than ignored, so a stale picker can't silently drop one.
 */
export async function setJobHiringManagers(params: {
  employerProfileId: string;
  companyName: string;
  jobPostingId: string;
  jobTitle: string;
  teamMemberIds: string[];
  actor: Actor;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const wanted = [...new Set(params.teamMemberIds)];
  const managers = await db
    .select({ id: employerTeamMembers.id, email: employerTeamMembers.email, userId: employerTeamMembers.userId })
    .from(employerTeamMembers)
    .where(
      and(eq(employerTeamMembers.employerProfileId, params.employerProfileId), eq(employerTeamMembers.role, "hiring_manager")),
    );
  const byId = new Map(managers.map((m) => [m.id, m]));
  if (wanted.some((id) => !byId.has(id))) {
    return { ok: false, error: "Hiring managers must be on your team with the Hiring manager role." };
  }

  const current = await db
    .select({ teamMemberId: jobPostingHiringManagers.teamMemberId })
    .from(jobPostingHiringManagers)
    .where(eq(jobPostingHiringManagers.jobPostingId, params.jobPostingId));
  const currentIds = new Set(current.map((c) => c.teamMemberId));
  const toAdd = wanted.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !wanted.includes(id));

  if (toAdd.length > 0) {
    await db
      .insert(jobPostingHiringManagers)
      .values(toAdd.map((teamMemberId) => ({ jobPostingId: params.jobPostingId, teamMemberId })))
      .onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db
      .delete(jobPostingHiringManagers)
      .where(
        and(
          eq(jobPostingHiringManagers.jobPostingId, params.jobPostingId),
          inArray(jobPostingHiringManagers.teamMemberId, toRemove),
        ),
      );
  }

  await logAndNotifyAssignments({
    employerProfileId: params.employerProfileId,
    companyName: params.companyName,
    actor: params.actor,
    added: toAdd.map((id) => ({
      email: byId.get(id)!.email,
      userId: byId.get(id)!.userId,
      jobPostingId: params.jobPostingId,
      jobTitle: params.jobTitle,
    })),
    // Someone removed from the team entirely is already gone from byId (and
    // their rows cascade) — only log removals of current Hiring managers.
    removed: toRemove.filter((id) => byId.has(id)).map((id) => ({ email: byId.get(id)!.email, jobTitle: params.jobTitle })),
  });
  return { ok: true };
}

/**
 * Sets exactly which postings one Hiring manager covers (from the Team page —
 * when inviting them, or "Edit jobs" on their row).
 */
export async function setMemberJobAssignments(params: {
  employerProfileId: string;
  companyName: string;
  member: { id: string; email: string; userId: string | null };
  jobPostingIds: string[];
  actor: Actor;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const wanted = [...new Set(params.jobPostingIds)];
  const postings = wanted.length
    ? await db
        .select({ id: jobPostings.id, title: jobPostings.title })
        .from(jobPostings)
        .where(and(eq(jobPostings.employerProfileId, params.employerProfileId), inArray(jobPostings.id, wanted)))
    : [];
  if (postings.length !== wanted.length) return { ok: false, error: "Pick job postings from this company." };

  const current = await db
    .select({ jobPostingId: jobPostingHiringManagers.jobPostingId, title: jobPostings.title })
    .from(jobPostingHiringManagers)
    .innerJoin(jobPostings, eq(jobPostings.id, jobPostingHiringManagers.jobPostingId))
    .where(eq(jobPostingHiringManagers.teamMemberId, params.member.id));
  const currentIds = new Set(current.map((c) => c.jobPostingId));
  const toAdd = postings.filter((p) => !currentIds.has(p.id));
  const toRemove = current.filter((c) => !wanted.includes(c.jobPostingId));

  if (toAdd.length > 0) {
    await db
      .insert(jobPostingHiringManagers)
      .values(toAdd.map((p) => ({ jobPostingId: p.id, teamMemberId: params.member.id })))
      .onConflictDoNothing();
  }
  if (toRemove.length > 0) {
    await db
      .delete(jobPostingHiringManagers)
      .where(
        and(
          eq(jobPostingHiringManagers.teamMemberId, params.member.id),
          inArray(
            jobPostingHiringManagers.jobPostingId,
            toRemove.map((r) => r.jobPostingId),
          ),
        ),
      );
  }

  await logAndNotifyAssignments({
    employerProfileId: params.employerProfileId,
    companyName: params.companyName,
    actor: params.actor,
    added: toAdd.map((p) => ({ email: params.member.email, userId: params.member.userId, jobPostingId: p.id, jobTitle: p.title })),
    removed: toRemove.map((r) => ({ email: params.member.email, jobTitle: r.title })),
  });
  return { ok: true };
}

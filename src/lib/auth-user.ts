import "server-only";
import { and, eq } from "drizzle-orm";
import type { AuthUser, Role } from "@/components/AuthModal";
import { db } from "./db";
import {
  employerOnboardingDrafts,
  employerProfiles,
  employerTeamMembers,
  jobseekerOnboardingDrafts,
  jobseekerProfiles,
  users,
} from "./db/schema";
import { getSession } from "./session";

/**
 * Avatars are per-role — a user's employer photo and jobseeker photo are
 * independent, since the same account may want a professional look on one
 * side and a personal one on the other. Each role's onboarding profile
 * carries its own `avatarUrl`; the account-level `users.avatarUrl` (set
 * from Google sign-in) is only a fallback for whichever role hasn't set
 * its own photo yet.
 */
export async function resolveAvatarUrl(userId: string, role: Role, accountAvatarUrl: string | null) {
  const table = role === "employer" ? employerProfiles : jobseekerProfiles;
  const [profile] = await db
    .select({ avatarUrl: table.avatarUrl })
    .from(table)
    .where(eq(table.userId, userId))
    .limit(1);
  return profile?.avatarUrl ?? accountAvatarUrl;
}

/**
 * The display name is per-role too — a jobseeker's `fullName` and an
 * employer's `contactName` are independent fields, since the same account
 * (via role switching) may go by a different name on each side. The
 * account-level `users.name` (set from Google sign-in) is only a fallback
 * for whichever role hasn't completed onboarding yet.
 */
export async function resolveNameForRole(userId: string, role: Role, accountName: string | null) {
  const [profile] =
    role === "employer"
      ? await db
          .select({ name: employerProfiles.contactName })
          .from(employerProfiles)
          .where(eq(employerProfiles.userId, userId))
          .limit(1)
      : await db
          .select({ name: jobseekerProfiles.fullName })
          .from(jobseekerProfiles)
          .where(eq(jobseekerProfiles.userId, userId))
          .limit(1);
  return profile?.name ?? accountName;
}

/**
 * Which role(s) an existing account has actually engaged with — a completed
 * profile, a started-but-unfinished onboarding draft, or an active team
 * membership at someone else's company all count, since any of the three
 * means the user genuinely has a foot on that side already (not just
 * whatever role a stale/default session cookie happens to say). Used to
 * auto-detect the right role at sign-in instead of asking the user to
 * pick, the way `resolveAvatarUrl`/`resolveNameForRole` resolve per-role
 * display data. Empty means the account exists but hasn't touched either
 * side yet; two entries means it's a genuinely dual-role account and the
 * caller must ask which one to continue as.
 */
export async function resolveExistingRoles(userId: string): Promise<Role[]> {
  const [[employerProfile], [employerDraft], [employerMembership], [jobseekerProfile], [jobseekerDraft]] = await Promise.all([
    db.select({ id: employerProfiles.id }).from(employerProfiles).where(eq(employerProfiles.userId, userId)).limit(1),
    db
      .select({ userId: employerOnboardingDrafts.userId })
      .from(employerOnboardingDrafts)
      .where(eq(employerOnboardingDrafts.userId, userId))
      .limit(1),
    db
      .select({ id: employerTeamMembers.id })
      .from(employerTeamMembers)
      .where(and(eq(employerTeamMembers.userId, userId), eq(employerTeamMembers.status, "active")))
      .limit(1),
    db.select({ id: jobseekerProfiles.id }).from(jobseekerProfiles).where(eq(jobseekerProfiles.userId, userId)).limit(1),
    db
      .select({ userId: jobseekerOnboardingDrafts.userId })
      .from(jobseekerOnboardingDrafts)
      .where(eq(jobseekerOnboardingDrafts.userId, userId))
      .limit(1),
  ]);
  const roles: Role[] = [];
  if (employerProfile || employerDraft || employerMembership) roles.push("employer");
  if (jobseekerProfile || jobseekerDraft) roles.push("jobseeker");
  return roles;
}

/**
 * Just the filename/size, not the (potentially multi-MB) data URL itself —
 * enough for a page to show "you already have a resume on file" without
 * embedding the whole file into the server-rendered HTML. Returns null if
 * the jobseeker never attached one (onboarding allows skipping it).
 */
export async function getJobseekerResumeInfo(
  userId: string,
): Promise<{ fileName: string; fileSize: number | null } | null> {
  const [profile] = await db
    .select({ fileName: jobseekerProfiles.resumeFileName, fileSize: jobseekerProfiles.resumeFileSize })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  if (!profile?.fileName) return null;
  return { fileName: profile.fileName, fileSize: profile.fileSize };
}

/**
 * Server-side equivalent of what `/api/auth/me` returns — used to pass a
 * known-at-render-time `initialUser` into `<Navbar>` so it never has to show
 * a signed-out flash while its own client-side fetch resolves.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const [user] = await db
    .select({ email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;

  const [avatarUrl, name] = await Promise.all([
    resolveAvatarUrl(session.userId, session.role, user.avatarUrl),
    resolveNameForRole(session.userId, session.role, user.name),
  ]);
  return { email: user.email, name, avatarUrl, role: session.role };
}

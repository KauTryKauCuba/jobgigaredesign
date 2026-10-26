import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import type { AuthUser, Role } from "@/components/AuthModal";
import { db } from "./db";
import { getEmployerAccess, type EmployerRole } from "./employer-profile";
import {
  employerOnboardingDrafts,
  employerProfiles,
  employerTeamMembers,
  jobseekerOnboardingDrafts,
  jobseekerProfiles,
  users,
} from "./db/schema";
import { getRewardHints } from "./campaigns";
import { isPhoneVerificationAvailable, isPhoneVerifiedFor } from "./phone-verification";
import { companyHasSampleData } from "./sample-data";
import { getSession } from "./session";
import { isSuperadminEmail } from "./superadmin";

/**
 * Avatars are per-role — a user's employer photo and jobseeker photo are
 * independent, since the same account may want a professional look on one
 * side and a personal one on the other. Each role's onboarding profile
 * carries its own `avatarUrl`; the account-level `users.avatarUrl` (set
 * from Google sign-in) is only a fallback for whichever role hasn't set
 * its own photo yet.
 */
export async function resolveAvatarUrl(userId: string, role: Role, accountAvatarUrl: string | null) {
  if (role === "employer") {
    // The company currently selected — its registrant's photo if that's this
    // user (one account can register several companies), else the account's.
    const access = await getEmployerAccess(userId);
    if (!access) return (await onboardingDraftIdentity(userId, role)).avatarUrl ?? accountAvatarUrl;
    return (access.profile.userId === userId ? access.profile.avatarUrl : null) ?? accountAvatarUrl;
  }
  const [profile] = await db
    .select({ avatarUrl: jobseekerProfiles.avatarUrl })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  if (!profile) return (await onboardingDraftIdentity(userId, role)).avatarUrl ?? accountAvatarUrl;
  return profile.avatarUrl ?? accountAvatarUrl;
}

/**
 * Mid-onboarding there's no profile yet, but the form autosaves a draft —
 * so the name and photo typed there show in the navbar on every page (not
 * just on the onboarding page itself), instead of the Google account's.
 */
const onboardingDraftIdentity = cache(async (userId: string, role: Role): Promise<{ name: string | null; avatarUrl: string | null }> => {
  const table = role === "employer" ? employerOnboardingDrafts : jobseekerOnboardingDrafts;
  const [draft] = await db.select({ data: table.data }).from(table).where(eq(table.userId, userId)).limit(1);
  const data = (draft?.data ?? {}) as Record<string, unknown>;
  const name = role === "employer" ? data.contactName : data.fullName;
  // Only a stored picture — never a not-yet-uploaded data URL.
  const avatar = data.avatarUrl;
  return {
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    avatarUrl: typeof avatar === "string" && /^(\/uploads\/|https?:\/\/)/.test(avatar) ? avatar : null,
  };
});

/**
 * The display name is per-role too — a jobseeker's `fullName` and an
 * employer's `contactName` are independent fields, since the same account
 * (via role switching) may go by a different name on each side. The
 * account-level `users.name` (set from Google sign-in) is only a fallback
 * for whichever role hasn't completed onboarding yet.
 */
export async function resolveNameForRole(userId: string, role: Role, accountName: string | null) {
  if (role === "employer") {
    // Same per-company rule as resolveAvatarUrl.
    const access = await getEmployerAccess(userId);
    if (!access) return (await onboardingDraftIdentity(userId, role)).name ?? accountName;
    return (access.profile.userId === userId ? access.profile.contactName : null) ?? accountName;
  }
  const [profile] = await db
    .select({ name: jobseekerProfiles.fullName })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  if (!profile) return (await onboardingDraftIdentity(userId, role)).name ?? accountName;
  return profile.name ?? accountName;
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
/**
 * The signed-in employer's job title and team role at whichever company
 * they're currently acting for (see getEmployerAccess), plus that company's
 * logo — shown as a small badge on their avatar in the navbar. The owner's
 * title lives on their profile (contactPosition); an invited teammate's
 * lives on their own team-member row.
 */
export async function resolveEmployerBadge(
  userId: string,
): Promise<{ position: string | null; teamRole: EmployerRole; companyLogoUrl: string | null } | null> {
  const access = await getEmployerAccess(userId);
  if (!access) return null;
  if (access.role === "owner" && access.profile.userId === userId) {
    return { position: access.profile.contactPosition, teamRole: "owner", companyLogoUrl: access.profile.logoUrl };
  }
  const [member] = await db
    .select({ position: employerTeamMembers.position })
    .from(employerTeamMembers)
    .where(and(eq(employerTeamMembers.userId, userId), eq(employerTeamMembers.employerProfileId, access.profile.id)))
    .limit(1);
  return { position: member?.position ?? null, teamRole: access.role, companyLogoUrl: access.profile.logoUrl };
}

/**
 * Whether the signed-in person's own phone is verified — the jobseeker's
 * profile phone, or the employer owner's contact phone at the company they're
 * acting for. A teammate at someone else's company doesn't verify a phone (v1).
 */
export async function resolvePhoneVerified(userId: string, role: Role): Promise<boolean> {
  if (role === "employer") {
    const access = await getEmployerAccess(userId);
    if (!access || access.profile.userId !== userId) return false;
    return isPhoneVerifiedFor(userId, access.profile.contactPhone);
  }
  const [profile] = await db
    .select({ phone: jobseekerProfiles.phone })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, userId))
    .limit(1);
  return isPhoneVerifiedFor(userId, profile?.phone);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      phoneVerifyBannerDismissedAt: users.phoneVerifyBannerDismissedAt,
      sampleDataBannerDismissedAt: users.sampleDataBannerDismissedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;

  const [registrantAvatarUrl, registrantName, badge, access, phoneVerified] = await Promise.all([
    resolveAvatarUrl(session.userId, session.role, user.avatarUrl),
    resolveNameForRole(session.userId, session.role, user.name),
    session.role === "employer" ? resolveEmployerBadge(session.userId) : null,
    session.role === "employer" ? getEmployerAccess(session.userId) : null,
    resolvePhoneVerified(session.userId, session.role),
  ]);
  // Acting as a teammate at someone else's company: show their own teammate
  // details (account name/photo, edited on that company's My Profile) — not
  // the contact name/photo from a company they registered themselves.
  const actingAsTeammate = !!access && access.profile.userId !== session.userId;
  const name = actingAsTeammate ? (user.name ?? registrantName) : registrantName;
  const avatarUrl = actingAsTeammate ? (user.avatarUrl ?? registrantAvatarUrl) : registrantAvatarUrl;
  const mayVerifyPhone = (session.role === "jobseeker" || (!!access && access.role === "owner")) && isPhoneVerificationAvailable();
  // The "Get sample data" bar: same idea as the phone bar — worked out here,
  // from the same `access` already fetched above, so it's there on the first
  // frame instead of popping in after a client-side fetch (which used to
  // shove the page down on every refresh). Worked out alongside the reward
  // hints (neither needs the other), so the page waits for one round trip.
  const [hasSampleData, rewards] = await Promise.all([
    session.role === "employer" && !user.sampleDataBannerDismissedAt && access ? companyHasSampleData(access.profile.id) : true,
    // Reward campaigns: never for superadmins (they run them). A failure here
    // must never break the page — the dashboard just shows no reward bits.
    isSuperadminEmail(user.email)
      ? null
      : getRewardHints(session.userId, user.email, session.role, phoneVerified, mayVerifyPhone).catch((err) => {
          console.error("Failed to load reward hints", err);
          return null;
        }),
  ]);
  const showSampleDataBar = session.role === "employer" && !user.sampleDataBannerDismissedAt && !!access && !hasSampleData;
  return {
    id: session.userId,
    email: user.email,
    name,
    avatarUrl,
    role: session.role,
    position: badge?.position ?? null,
    teamRole: badge?.teamRole ?? null,
    companyLogoUrl: badge?.companyLogoUrl ?? null,
    phoneVerified,
    // The "Verify your phone number" bar: for the people who can verify
    // (jobseekers, and employers at their own company), until they do or
    // close it. Worked out here so it's there on the first frame.
    showPhoneVerifyBar: !phoneVerified && !user.phoneVerifyBannerDismissedAt && mayVerifyPhone,
    showSampleDataBar,
    rewards,
  };
}

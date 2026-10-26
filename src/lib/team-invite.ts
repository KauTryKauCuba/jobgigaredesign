import "server-only";
import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "./db";
import { employerProfiles, employerTeamMembers } from "./db/schema";
import type { TeamRole } from "./team-roles";
import { isUuid } from "./uuid";

// How long an invite link works for. Resend issues a fresh link (and a fresh
// 7 days); the old link stops working.
export const INVITE_TTL_DAYS = 7;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** A new invite link token — store `hash` + `expiresAt`, email the `token`. */
export function newInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return {
    token,
    hash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export type InviteLookup =
  | { state: "invalid" }
  | {
      state: "pending" | "expired" | "accepted";
      id: string;
      email: string;
      role: TeamRole;
      employerProfileId: string;
      companyName: string;
      companyLogoUrl: string | null;
      invitedByUserId: string | null;
    };

/** The invite behind a link, and whether it can still be accepted. */
export async function findInviteByToken(token: string): Promise<InviteLookup> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { state: "invalid" };
  const [row] = await db
    .select({
      id: employerTeamMembers.id,
      email: employerTeamMembers.email,
      role: employerTeamMembers.role,
      status: employerTeamMembers.status,
      expiresAt: employerTeamMembers.inviteExpiresAt,
      invitedByUserId: employerTeamMembers.invitedByUserId,
      employerProfileId: employerTeamMembers.employerProfileId,
      companyName: employerProfiles.companyName,
      companyLogoUrl: employerProfiles.logoUrl,
    })
    .from(employerTeamMembers)
    .innerJoin(employerProfiles, eq(employerProfiles.id, employerTeamMembers.employerProfileId))
    .where(eq(employerTeamMembers.inviteTokenHash, hashInviteToken(token)))
    .limit(1);
  if (!row) return { state: "invalid" };
  const state =
    row.status === "active" ? "accepted" : row.expiresAt && row.expiresAt.getTime() < Date.now() ? "expired" : "pending";
  return {
    state,
    id: row.id,
    email: row.email,
    role: row.role,
    employerProfileId: row.employerProfileId,
    companyName: row.companyName,
    companyLogoUrl: row.companyLogoUrl,
    invitedByUserId: row.invitedByUserId,
  };
}

// Hand-offs for the team-invite link (/invite/[id]):
// - INVITE_SIGNIN_COOKIE (readable by the page) tells the Navbar to open
//   Sign in, pre-filled with the invited email.
// - INVITE_COMPANY_COOKIE (httpOnly) remembers which company the invite was
//   for, so the sign-in that follows lands in *that* company rather than
//   whichever one the account would default to.
export const INVITE_SIGNIN_COOKIE = "invite_signin";
export const INVITE_COMPANY_COOKIE = "invite_company";
const MAX_AGE_SECONDS = 60 * 30;

export async function rememberInvite(invite: { email: string; companyName: string; employerProfileId: string }) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(INVITE_SIGNIN_COOKIE, JSON.stringify({ email: invite.email, company: invite.companyName }), {
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    secure,
  });
  cookieStore.set(INVITE_COMPANY_COOKIE, invite.employerProfileId, {
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    secure,
    httpOnly: true,
  });
}

/** For a cancelled/removed invite — Sign in opens showing why. */
export async function rememberInviteError(message: string) {
  const cookieStore = await cookies();
  cookieStore.set(INVITE_SIGNIN_COOKIE, JSON.stringify({ error: message }), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * After a sign-in: the company the invite link was for, if this user is now
 * an active member of it (call after activatePendingTeamInvites). Clears
 * the cookie either way so it's used once.
 */
export async function consumeInviteCompany(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const profileId = cookieStore.get(INVITE_COMPANY_COOKIE)?.value ?? null;
  if (!profileId) return null;
  cookieStore.delete(INVITE_COMPANY_COOKIE);
  if (!isUuid(profileId)) return null;
  const [membership] = await db
    .select({ id: employerTeamMembers.id })
    .from(employerTeamMembers)
    .where(
      and(
        eq(employerTeamMembers.employerProfileId, profileId),
        eq(employerTeamMembers.userId, userId),
        eq(employerTeamMembers.status, "active"),
      ),
    )
    .limit(1);
  return membership ? profileId : null;
}

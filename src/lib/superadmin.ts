import "server-only";
import { cache } from "react";
import { db } from "./db";
import { superadminMembers } from "./db/schema";

// Superadmin access is an email allowlist layered on top of a normal
// employer/jobseeker sign-in — not a third `role` in the schema/session.
// Two lists make it up:
//  - Owners: the SUPERADMIN_EMAILS env var. Always superadmins, can't be
//    removed from the panel (so nobody gets locked out), and the only ones
//    who can add or remove the second list.
//  - Admins: added on the panel's Admins page (superadmin_members). Full
//    access to everything else.
// Checked by email on every request (getAuthUser reads it fresh), so adding or
// removing someone takes effect on their next page load — no re-sign-in.
const OWNER_EMAILS = (process.env.SUPERADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/** The added admins' emails — read once per request, however many checks it runs. */
const getAdminEmails = cache(async (): Promise<string[]> => {
  const rows = await db.select({ email: superadminMembers.email }).from(superadminMembers);
  return rows.map((r) => r.email);
});

/** Everyone with superadmin access, owners first — who to alert when something needs attention. */
export async function getSuperadminEmails(): Promise<string[]> {
  return [...new Set([...OWNER_EMAILS, ...(await getAdminEmails())])];
}

export function getOwnerEmails(): string[] {
  return [...OWNER_EMAILS];
}

/** Owners only — the people who can add and remove admins. */
export function isSuperadminOwner(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.toLowerCase());
}

export async function isSuperadminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return OWNER_EMAILS.includes(normalized) || (await getAdminEmails()).includes(normalized);
}

import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { superadminMembers, users } from "./db/schema";
import { notify } from "./notifications";
import { getOwnerEmails } from "./superadmin";

// The superadmin panel's Admins page: the owners (SUPERADMIN_EMAILS, fixed)
// and the admins owners add or remove (superadmin_members). See superadmin.ts.

export type AdminAccount = { name: string | null; avatarUrl: string | null } | null;

export type AdminEntry = {
  /** superadmin_members id — null for owners, who can't be removed here. */
  id: string | null;
  email: string;
  kind: "owner" | "admin";
  /** The account signed up with this email, or null if nobody has yet. */
  account: AdminAccount;
  addedBy: string | null;
  addedAt: string | null;
};

export async function listSuperadmins(): Promise<AdminEntry[]> {
  const members = await db
    .select({
      id: superadminMembers.id,
      email: superadminMembers.email,
      createdAt: superadminMembers.createdAt,
      addedByName: users.name,
      addedByEmail: users.email,
    })
    .from(superadminMembers)
    .leftJoin(users, eq(users.id, superadminMembers.addedByUserId))
    .orderBy(desc(superadminMembers.createdAt));

  const owners = getOwnerEmails();
  const emails = [...owners, ...members.map((m) => m.email)];
  // Emails are stored as typed at sign-up, so match case-insensitively.
  const accounts = emails.length
    ? await db
        .select({ email: users.email, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(sql`lower(${users.email})`, emails))
    : [];
  const accountFor = (email: string): AdminAccount => {
    const a = accounts.find((acc) => acc.email.toLowerCase() === email);
    return a ? { name: a.name, avatarUrl: a.avatarUrl } : null;
  };

  return [
    ...owners.map((email): AdminEntry => ({ id: null, email, kind: "owner", account: accountFor(email), addedBy: null, addedAt: null })),
    ...members.map(
      (m): AdminEntry => ({
        id: m.id,
        email: m.email,
        kind: "admin",
        account: accountFor(m.email),
        addedBy: m.addedByName ?? m.addedByEmail ?? null,
        addedAt: m.createdAt.toISOString(),
      }),
    ),
  ];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addSuperadmin(
  rawEmail: string,
  addedByUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email.", status: 400 };
  if (getOwnerEmails().includes(email)) return { ok: false, error: "That email is already an owner.", status: 409 };

  const inserted = await db
    .insert(superadminMembers)
    .values({ email, addedByUserId })
    .onConflictDoNothing({ target: superadminMembers.email })
    .returning({ id: superadminMembers.id });
  if (inserted.length === 0) return { ok: false, error: "That email is already an admin.", status: 409 };

  // Tell them, if they already have an account; anyone who signs up later
  // just finds "Superadmin panel" in their account menu.
  const [account] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (account) {
    await notify([account.id], account.role, {
      type: "superadmin_added",
      title: "You've been given superadmin access",
      body: "Open the Superadmin panel from your account menu.",
      link: "/superadmin/dashboard",
    });
  }
  return { ok: true };
}

/** Removes an added admin. Owners aren't in this table, so they can't be removed this way. */
export async function removeSuperadmin(id: string): Promise<boolean> {
  const removed = await db.delete(superadminMembers).where(eq(superadminMembers.id, id)).returning({ id: superadminMembers.id });
  return removed.length > 0;
}

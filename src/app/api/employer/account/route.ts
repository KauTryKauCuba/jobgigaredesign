import { NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerProfiles, employerTeamMembers, users } from "@/lib/db/schema";
import { getEmployerProfile } from "@/lib/employer-profile";
import { clearSession, getSession } from "@/lib/session";

// Deletes the signed-in employer's own account. Two shapes, depending on
// whether this user directly owns a company (employerProfiles.userId — the
// account that originally created it, distinct from employerTeamMembers
// role):
//
// - Direct owner with other active team members still on the company:
//   blocked, same rule as removing the last owner from the Team page
//   (src/app/api/employer/team/[id]/route.ts) — there's no "transfer
//   ownership" feature, so deleting this account would strand the company
//   with no owner and no way for the remaining members to fix it.
// - Direct owner with no other active members: deleting the account also
//   deletes the whole company (job postings, applications, addresses, team
//   activity — everything cascades from employerProfiles.id). Safe since
//   no one else has access to lose.
// - Not a direct owner (an invited team member, or no company at all): just
//   deletes the user row; their employerTeamMembers row(s) elsewhere
//   cascade automatically (schema.ts: onDelete "cascade").
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { confirmEmail } = (body ?? {}) as Record<string, unknown>;

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (typeof confirmEmail !== "string" || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Email confirmation didn't match." }, { status: 400 });
  }

  const ownedProfile = await getEmployerProfile(session.userId);

  if (ownedProfile) {
    const [row] = await db
      .select({ n: count() })
      .from(employerTeamMembers)
      .where(
        and(
          eq(employerTeamMembers.employerProfileId, ownedProfile.id),
          eq(employerTeamMembers.status, "active"),
          ne(employerTeamMembers.userId, session.userId),
        ),
      );
    if ((row?.n ?? 0) > 0) {
      return NextResponse.json(
        { error: "Remove your other team members before deleting your account — there's no one else to hand the company to yet." },
        { status: 400 },
      );
    }
  }

  await db.transaction(async (tx) => {
    if (ownedProfile) {
      await tx.delete(employerProfiles).where(eq(employerProfiles.id, ownedProfile.id));
    }
    await tx.delete(users).where(eq(users.id, session.userId));
  });

  await clearSession();
  return NextResponse.json({ ok: true });
}

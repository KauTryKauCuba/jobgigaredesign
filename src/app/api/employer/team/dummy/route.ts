import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers, users } from "@/lib/db/schema";
import { buildDummyTeamEmail, buildDummyTeamLoginEmail, DUMMY_TEAM_EMAIL_DOMAIN, DUMMY_TEAM_ROSTER, slugifyName } from "@/lib/dummy-team";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

async function getEmployerProfileId(userId: string) {
  const access = await getEmployerAccess(userId);
  return access?.profile.id ?? null;
}

// Scoped by the employerTeamMembers.employerProfileId column itself (not by
// parsing the email), so the displayed email can stay a clean
// "name@dummy-team.jobgiga.test" with no embedded id, while cleanup still
// can't touch another employer's dummy teammates.
async function deleteDummyTeam(employerProfileId: string) {
  const dummyRows = await db
    .select({ userId: employerTeamMembers.userId })
    .from(employerTeamMembers)
    .where(
      and(
        eq(employerTeamMembers.employerProfileId, employerProfileId),
        like(employerTeamMembers.email, `%@${DUMMY_TEAM_EMAIL_DOMAIN}`),
        isNotNull(employerTeamMembers.userId),
      ),
    );
  const dummyUserIds = dummyRows.map((r) => r.userId).filter((id): id is string => id !== null);

  await db
    .delete(employerTeamMembers)
    .where(
      and(
        eq(employerTeamMembers.employerProfileId, employerProfileId),
        like(employerTeamMembers.email, `%@${DUMMY_TEAM_EMAIL_DOMAIN}`),
      ),
    );
  if (dummyUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, dummyUserIds));
  }
}

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const employerProfileId = await getEmployerProfileId(session.userId);
  if (!employerProfileId) return NextResponse.json({ error: "No employer profile." }, { status: 404 });

  // Idempotent — safe to call repeatedly (clicking "Get dummy data" twice,
  // or after a previous "Remove") without piling up duplicate rows.
  await deleteDummyTeam(employerProfileId);

  const rows: (typeof employerTeamMembers.$inferInsert)[] = [];
  for (const member of DUMMY_TEAM_ROSTER) {
    const slug = slugifyName(member.name);
    const displayEmail = buildDummyTeamEmail(slug);
    if (member.status === "active") {
      const [account] = await db
        .insert(users)
        .values({
          email: buildDummyTeamLoginEmail(slug, employerProfileId),
          name: member.name,
          avatarUrl: member.avatarUrl,
          role: "employer",
        })
        .returning();
      rows.push({
        employerProfileId,
        userId: account.id,
        email: displayEmail,
        role: "admin",
        position: member.position,
        status: "active",
        joinedAt: new Date(),
      });
    } else {
      rows.push({ employerProfileId, email: displayEmail, role: "admin", position: member.position, status: "pending" });
    }
  }
  await db.insert(employerTeamMembers).values(rows);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const employerProfileId = await getEmployerProfileId(session.userId);
  if (!employerProfileId) return NextResponse.json({ error: "No employer profile." }, { status: 404 });

  await deleteDummyTeam(employerProfileId);
  return NextResponse.json({ ok: true });
}

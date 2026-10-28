import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers, jobPostingHiringManagers, jobPostings, users } from "@/lib/db/schema";
import { DUMMY_POSTING_MARKER } from "@/lib/dummy-job-postings";
import { buildDummyTeamEmail, buildDummyTeamLoginEmail, DUMMY_TEAM_EMAIL_DOMAIN, DUMMY_TEAM_ROSTER, slugifyName } from "@/lib/dummy-team";
import { getFullEmployerAccess } from "@/lib/employer-profile";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";

async function getEmployerProfileId(userId: string) {
  const access = await getFullEmployerAccess(userId);
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
        role: member.role ?? "admin",
        position: member.position,
        hiringRole: member.hiringRole,
        phone: member.phone,
        status: "active",
        joinedAt: new Date(),
        profileCompletedAt: new Date(),
      });
    } else {
      rows.push({
        employerProfileId,
        email: displayEmail,
        role: member.role ?? "admin",
        position: member.position,
        status: "pending",
      });
    }
  }
  const inserted = await db
    .insert(employerTeamMembers)
    .values(rows)
    .returning({ id: employerTeamMembers.id, role: employerTeamMembers.role, email: employerTeamMembers.email });

  // Each sample Hiring manager gets the sample postings in their own area
  // (DUMMY_TEAM_ROSTER jobTitles), so the Team page, job pages and their own
  // limited view show what an assignment looks like. Only sample postings —
  // a company's real jobs are never assigned to a sample teammate.
  const dummyPostings = await db
    .select({ id: jobPostings.id, title: jobPostings.title })
    .from(jobPostings)
    .where(and(eq(jobPostings.employerProfileId, employerProfileId), eq(jobPostings.postingName, DUMMY_POSTING_MARKER)));
  const assignments = inserted.flatMap((member) => {
    if (member.role !== "hiring_manager") return [];
    const roster = DUMMY_TEAM_ROSTER.find((m) => buildDummyTeamEmail(slugifyName(m.name)) === member.email);
    return dummyPostings
      .filter((p) => roster?.jobTitles?.includes(p.title))
      .map((p) => ({ jobPostingId: p.id, teamMemberId: member.id }));
  });
  if (assignments.length > 0) {
    await db.insert(jobPostingHiringManagers).values(assignments).onConflictDoNothing();
  }

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
  revalidatePublicData();
  return NextResponse.json({ ok: true });
}

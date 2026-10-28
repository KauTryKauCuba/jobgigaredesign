import { NextResponse } from "next/server";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyAds, employerProfiles, employerTeamMembers, jobAds, users } from "@/lib/db/schema";
import { deleteCompanyAdFile } from "@/lib/company-ads";
import { getOwnedEmployerProfiles } from "@/lib/employer-profile";
import { deleteJobAdFile } from "@/lib/job-ads";
import { revalidatePublicData } from "@/lib/public-data";
import { clearSession, getSession } from "@/lib/session";

// Deletes the signed-in employer's own account. Two shapes, depending on
// whether this user registered any companies (employerProfiles.userId — the
// account that originally created it, distinct from employerTeamMembers
// role; one account can register several, and every one is checked):
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

  const ownedIds = (await getOwnedEmployerProfiles(session.userId)).map((p) => p.id);

  if (ownedIds.length > 0) {
    const [row] = await db
      .select({ n: count() })
      .from(employerTeamMembers)
      .where(
        and(
          inArray(employerTeamMembers.employerProfileId, ownedIds),
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

  // Ad rows cascade with their companies; their media files in private
  // storage don't, so note them now and remove them once the delete commits.
  const [companyAdFiles, jobAdFiles] =
    ownedIds.length > 0
      ? await Promise.all([
          db.select({ fileName: companyAds.fileName }).from(companyAds).where(inArray(companyAds.employerProfileId, ownedIds)),
          db.select({ fileName: jobAds.fileName }).from(jobAds).where(inArray(jobAds.employerProfileId, ownedIds)),
        ])
      : [[], []];

  await db.transaction(async (tx) => {
    if (ownedIds.length > 0) {
      await tx.delete(employerProfiles).where(inArray(employerProfiles.id, ownedIds));
    }
    await tx.delete(users).where(eq(users.id, session.userId));
  });

  await Promise.all([
    ...companyAdFiles.map((r) => deleteCompanyAdFile(r.fileName)),
    ...jobAdFiles.map((r) => deleteJobAdFile(r.fileName)),
  ]);

  revalidatePublicData();
  await clearSession();
  return NextResponse.json({ ok: true });
}

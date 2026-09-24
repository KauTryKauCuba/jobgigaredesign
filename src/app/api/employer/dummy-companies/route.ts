import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { removeDummyCompanies, seedDummyCompanies } from "@/lib/dummy-companies";
import { getSession } from "@/lib/session";

async function requireEmployerUser() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}

// Wired into the "Get dummy data" button (Jobs/Applicants/Interviews pages)
// alongside its existing dummy-postings/dummy-applicants creation — grants
// the current user access to the two ParcelTracker/WHALE dummy companies
// (same fixtures `npm run db:seed` creates), so clicking it after a
// previous "Remove" actually brings them back instead of leaving the
// company switcher one company short.
export async function POST() {
  const user = await requireEmployerUser();
  if (!user) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  await seedDummyCompanies(db, user, user.email);
  return NextResponse.json({ ok: true });
}

// Wired into the "Remove dummy data" button alongside its existing
// dummy-postings/dummy-applicants cleanup — removes any company the current
// user has team access to that's owned by a seed-domain account, i.e. the
// whole fake company, not just this user's access to it. These companies
// only ever exist as a fully synthetic fixture, so deleting them outright —
// rather than just this user's membership row — matches how the
// job-postings/applicants dummy data already behaves.
export async function DELETE() {
  const user = await requireEmployerUser();
  if (!user) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const removed = await removeDummyCompanies(db, user.id);
  return NextResponse.json({ removed });
}

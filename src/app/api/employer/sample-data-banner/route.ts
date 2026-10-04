import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { companyHasSampleData } from "@/lib/sample-data";
import { getSession } from "@/lib/session";

// Whether to show the "Get sample data" bar: only to an employer who hasn't
// closed it (on any device — it's stored on their account) and whose current
// company doesn't already have sample data.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") return NextResponse.json({ show: false });

  const [[user], access] = await Promise.all([
    db
      .select({ dismissedAt: users.sampleDataBannerDismissedAt })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
    getEmployerAccess(session.userId),
  ]);
  if (!user || user.dismissedAt || !access) return NextResponse.json({ show: false });

  return NextResponse.json({ show: !(await companyHasSampleData(access.profile.id)) });
}

// The bar's X — hides it for this account everywhere, for good.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  await db.update(users).set({ sampleDataBannerDismissedAt: new Date() }).where(eq(users.id, session.userId));
  return NextResponse.json({ ok: true });
}

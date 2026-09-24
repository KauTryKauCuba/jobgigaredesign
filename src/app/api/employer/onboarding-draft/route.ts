import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerOnboardingDrafts } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const [draft] = await db
    .select({ data: employerOnboardingDrafts.data })
    .from(employerOnboardingDrafts)
    .where(eq(employerOnboardingDrafts.userId, session.userId))
    .limit(1);

  return NextResponse.json({ draft: draft?.data ?? null });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return NextResponse.json({ error: "Invalid draft data." }, { status: 400 });
  }

  await db
    .insert(employerOnboardingDrafts)
    .values({ userId: session.userId, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: employerOnboardingDrafts.userId,
      set: { data, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  await db.delete(employerOnboardingDrafts).where(eq(employerOnboardingDrafts.userId, session.userId));

  return NextResponse.json({ ok: true });
}

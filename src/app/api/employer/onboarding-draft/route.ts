import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerOnboardingDrafts } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { isBase64DataUrl, saveBase64Upload, type UploadCategory } from "@/lib/uploads";

// This draft is a free-form JSON blob of the whole in-progress onboarding
// form, autosaved on every field change — including whichever of these
// image fields have been picked so far. Converting them here (rather than
// only at final submit) matters because autosave fires far more often than
// submit, and was the single most-repeated base64-in-Postgres write in the
// app.
const IMAGE_FIELDS: Record<string, UploadCategory> = {
  avatarUrl: "avatars",
  logoUrl: "logos",
  officePhotoUrl: "office-photos",
};

async function resolveImageFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved = { ...data };
  for (const [field, category] of Object.entries(IMAGE_FIELDS)) {
    const value = resolved[field];
    if (isBase64DataUrl(value)) resolved[field] = await saveBase64Upload(value, category);
  }
  return resolved;
}

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

  const resolvedData = await resolveImageFields(data as Record<string, unknown>);

  await db
    .insert(employerOnboardingDrafts)
    .values({ userId: session.userId, data: resolvedData, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: employerOnboardingDrafts.userId,
      set: { data: resolvedData, updatedAt: new Date() },
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

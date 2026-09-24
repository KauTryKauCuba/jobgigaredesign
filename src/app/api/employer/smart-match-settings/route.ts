import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerProfiles } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

const CRITERIA_KEYS = [
  "skills",
  "softSkills",
  "niceToHaveSkills",
  "experience",
  "industry",
  "workArrangement",
  "employmentType",
  "workAuthorization",
  "drivingLicense",
] as const;

function isValidCriteria(value: unknown): value is Record<(typeof CRITERIA_KEYS)[number], boolean> {
  if (!value || typeof value !== "object") return false;
  return CRITERIA_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === "boolean");
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { enabled, criteria } = (body ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid enabled value." }, { status: 400 });
    }
    updates.smartMatchEnabled = enabled;
  }
  if (criteria !== undefined) {
    if (!isValidCriteria(criteria)) {
      return NextResponse.json({ error: "Invalid criteria." }, { status: 400 });
    }
    updates.smartMatchCriteria = criteria;
  }

  await db.update(employerProfiles).set(updates).where(eq(employerProfiles.id, access.profile.id));
  return NextResponse.json({ ok: true });
}

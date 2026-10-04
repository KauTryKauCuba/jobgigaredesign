import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobseekerProfiles } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

// Turn new-job match alerts on or off: `{ enabled: boolean }`.
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { enabled } = (body ?? {}) as Record<string, unknown>;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Pass `enabled: true|false`." }, { status: 400 });
  }

  const [updated] = await db
    .update(jobseekerProfiles)
    .set({ jobAlertsEnabled: enabled, updatedAt: new Date() })
    .where(eq(jobseekerProfiles.userId, session.userId))
    .returning({ jobAlertsEnabled: jobseekerProfiles.jobAlertsEnabled });
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ enabled: updated.jobAlertsEnabled });
}

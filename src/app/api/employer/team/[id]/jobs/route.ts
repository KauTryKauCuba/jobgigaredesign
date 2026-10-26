import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers } from "@/lib/db/schema";
import { getFullEmployerAccess } from "@/lib/employer-profile";
import { setMemberJobAssignments } from "@/lib/hiring-scope";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

// Sets exactly which job postings a Hiring manager covers ("Edit jobs" on
// their Team row). Owners and Admins only.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getFullEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { jobPostingIds } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(jobPostingIds) || !jobPostingIds.every((v) => typeof v === "string" && isUuid(v))) {
    return NextResponse.json({ error: "Invalid job postings." }, { status: 400 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [member] = await db
    .select({
      id: employerTeamMembers.id,
      email: employerTeamMembers.email,
      userId: employerTeamMembers.userId,
      role: employerTeamMembers.role,
    })
    .from(employerTeamMembers)
    .where(and(eq(employerTeamMembers.id, id), eq(employerTeamMembers.employerProfileId, access.profile.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (member.role !== "hiring_manager") {
    return NextResponse.json({ error: "Only a Hiring manager is assigned to specific jobs." }, { status: 400 });
  }

  const result = await setMemberJobAssignments({
    employerProfileId: access.profile.id,
    companyName: access.profile.companyName,
    member,
    jobPostingIds: jobPostingIds as string[],
    actor: { userId: session.userId },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

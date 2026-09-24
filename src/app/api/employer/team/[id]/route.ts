import { NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers } from "@/lib/db/schema";
import { getActorLabel, getEmployerAccess, logTeamActivity } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

const TEAM_ROLES = ["owner", "admin"] as const;

async function requireTeamAccess() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getEmployerAccess(session.userId);
  return access ? { ...access, userId: session.userId } : null;
}

async function getOwnerCount(employerProfileId: string, excludingMemberId?: string) {
  const conditions = [eq(employerTeamMembers.employerProfileId, employerProfileId), eq(employerTeamMembers.role, "owner")];
  if (excludingMemberId) conditions.push(ne(employerTeamMembers.id, excludingMemberId));
  const [row] = await db
    .select({ n: count() })
    .from(employerTeamMembers)
    .where(and(...conditions));
  return row?.n ?? 0;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { role } = (body ?? {}) as Record<string, unknown>;
  if (typeof role !== "string" || !(TEAM_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { id } = await params;
  const [member] = await db
    .select()
    .from(employerTeamMembers)
    .where(and(eq(employerTeamMembers.id, id), eq(employerTeamMembers.employerProfileId, auth.profile.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Granting or revoking Owner is the one thing only an existing Owner can
  // do — an Admin can otherwise manage the team freely.
  if ((role === "owner" || member.role === "owner") && auth.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can change an owner's role." }, { status: 403 });
  }

  // A company can never end up with zero owners — block demoting the last
  // one rather than requiring the UI alone to prevent it.
  if (member.role === "owner" && role !== "owner") {
    const remainingOwners = await getOwnerCount(auth.profile.id, member.id);
    if (remainingOwners === 0) {
      return NextResponse.json({ error: "A company needs at least one owner." }, { status: 400 });
    }
  }

  await db
    .update(employerTeamMembers)
    .set({ role: role as (typeof TEAM_ROLES)[number] })
    .where(eq(employerTeamMembers.id, id));

  // Skip logging a no-op "changed" from X to X — the dropdown always fires
  // onChange even re-selecting the current value.
  if (role !== member.role) {
    await logTeamActivity({
      employerProfileId: auth.profile.id,
      actorUserId: auth.userId,
      actorLabel: await getActorLabel(auth.userId),
      action: "role_changed",
      targetEmail: member.email,
      fromRole: member.role,
      toRole: role as (typeof TEAM_ROLES)[number],
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const { id } = await params;
  const [member] = await db
    .select()
    .from(employerTeamMembers)
    .where(and(eq(employerTeamMembers.id, id), eq(employerTeamMembers.employerProfileId, auth.profile.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Removing an Owner is the same "only an Owner can touch Owner status"
  // rule as PATCH above.
  if (member.role === "owner" && auth.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can remove an owner." }, { status: 403 });
  }

  if (member.role === "owner") {
    const remainingOwners = await getOwnerCount(auth.profile.id, member.id);
    if (remainingOwners === 0) {
      return NextResponse.json({ error: "A company needs at least one owner." }, { status: 400 });
    }
  }

  await db.delete(employerTeamMembers).where(eq(employerTeamMembers.id, id));

  await logTeamActivity({
    employerProfileId: auth.profile.id,
    actorUserId: auth.userId,
    actorLabel: await getActorLabel(auth.userId),
    action: "removed",
    targetEmail: member.email,
    fromRole: member.role,
  });

  return NextResponse.json({ ok: true });
}

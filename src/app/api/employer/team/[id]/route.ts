import { NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerProfiles, employerTeamMembers, jobPostingHiringManagers, users } from "@/lib/db/schema";
import { getActorLabel, getFullEmployerAccess, logTeamActivity } from "@/lib/employer-profile";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { isTeamRole } from "@/lib/team-roles";
import { isUuid } from "@/lib/uuid";

// Managing the team is for Owners and Admins only.
async function requireTeamAccess() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getFullEmployerAccess(session.userId);
  return access ? { ...access, userId: session.userId } : null;
}

/**
 * The company's registrant (employerProfiles.userId) has owner access through
 * the company record itself, not their team row — so removing or demoting
 * them on the Team page must also hand the registration to someone else, or
 * they'd keep full access. It goes to the owner making the change, who
 * becomes the company's main contact with their own About you carried over
 * — name, email, photo, role, position and phone — never the previous
 * registrant's.
 */
async function handOverRegistration(
  profileId: string,
  toUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [[account], [membership]] = await Promise.all([
    db.select({ name: users.name, email: users.email, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, toUserId)).limit(1),
    db
      .select({
        position: employerTeamMembers.position,
        hiringRole: employerTeamMembers.hiringRole,
        phone: employerTeamMembers.phone,
      })
      .from(employerTeamMembers)
      .where(and(eq(employerTeamMembers.employerProfileId, profileId), eq(employerTeamMembers.userId, toUserId)))
      .limit(1),
  ]);
  if (!account) return { ok: false, error: "Couldn't find your account." };
  await db
    .update(employerProfiles)
    .set({
      userId: toUserId,
      contactName: account.name || account.email.split("@")[0],
      contactEmail: account.email,
      // Their own About you (from their team row) carries over as-is.
      contactPosition: membership?.position ?? "",
      contactRole: membership?.hiringRole ?? "",
      contactPhone: membership?.phone ?? "",
      avatarUrl: account.avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(employerProfiles.id, profileId));
  return { ok: true };
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
  if (!isTeamRole(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
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

  // Demoting the registrant only takes effect if the registration moves too
  // (see handOverRegistration).
  if (member.role === "owner" && role !== "owner" && member.userId === auth.profile.userId) {
    if (member.userId === auth.userId) {
      return NextResponse.json({ error: "Ask another owner to change your role." }, { status: 400 });
    }
    const handover = await handOverRegistration(auth.profile.id, auth.userId);
    if (!handover.ok) return NextResponse.json({ error: handover.error }, { status: 400 });
  }

  await db.update(employerTeamMembers).set({ role }).where(eq(employerTeamMembers.id, id));
  revalidatePublicData();
  // Job assignments only mean something for a Hiring manager — an Owner or
  // Admin already sees every posting, and a Panel member sees none.
  if (member.role === "hiring_manager" && role !== "hiring_manager") {
    await db.delete(jobPostingHiringManagers).where(eq(jobPostingHiringManagers.teamMemberId, id));
  }

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
      toRole: role,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
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

  if (member.userId && member.userId === auth.userId) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }
  // Removing the registrant only revokes their access if the registration
  // moves too (see handOverRegistration).
  if (member.userId && member.userId === auth.profile.userId) {
    const handover = await handOverRegistration(auth.profile.id, auth.userId);
    if (!handover.ok) return NextResponse.json({ error: handover.error }, { status: 400 });
  }

  await db.delete(employerTeamMembers).where(eq(employerTeamMembers.id, id));
  revalidatePublicData();

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

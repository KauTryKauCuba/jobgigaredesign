import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employerTeamMembers } from "@/lib/db/schema";
import {
  getActorLabel,
  getEmployerAccess,
  getEmployerTeamActivity,
  getEmployerTeamMembers,
  logTeamActivity,
} from "@/lib/employer-profile";
import { sendTeamInviteEmail } from "@/lib/email";
import { getSession } from "@/lib/session";

const TEAM_ROLES = ["owner", "admin"] as const;

async function requireTeamAccess() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getEmployerAccess(session.userId);
  return access ? { ...access, userId: session.userId } : null;
}

export async function GET() {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const [members, activity] = await Promise.all([
    getEmployerTeamMembers(auth.profile.id, auth.profile.userId),
    getEmployerTeamActivity(auth.profile.id),
  ]);
  return NextResponse.json({ members, activity });
}

export async function POST(request: Request) {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { email, role } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim().includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = typeof role === "string" ? role : "admin";
  if (!(TEAM_ROLES as readonly string[]).includes(normalizedRole)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  // Only an existing Owner can hand out Owner — an Admin can invite anyone,
  // just not at that top tier.
  if (normalizedRole === "owner" && auth.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can invite someone as an owner." }, { status: 403 });
  }

  // Owner rows are self-healed lazily by getEmployerTeamMembers — run it
  // first so the unique(employerProfileId, email) constraint below actually
  // catches "already invited/a member" instead of colliding with a
  // not-yet-created owner row.
  await getEmployerTeamMembers(auth.profile.id, auth.profile.userId);

  try {
    await db.insert(employerTeamMembers).values({
      employerProfileId: auth.profile.id,
      email: normalizedEmail,
      role: normalizedRole as (typeof TEAM_ROLES)[number],
      status: "pending",
    });
  } catch {
    return NextResponse.json({ error: "That email is already invited or on the team." }, { status: 409 });
  }

  const actorLabel = await getActorLabel(auth.userId);
  await logTeamActivity({
    employerProfileId: auth.profile.id,
    actorUserId: auth.userId,
    actorLabel,
    action: "invited",
    targetEmail: normalizedEmail,
    toRole: normalizedRole as (typeof TEAM_ROLES)[number],
  });

  // The invite row is real in the DB regardless of whether this send
  // succeeds — a flaky email provider shouldn't roll back a valid invite,
  // so this failure is swallowed rather than turning the request into a
  // 500 (the invited person can still be found on the Team page, and
  // "Resend" covers a send that silently never arrived).
  try {
    await sendTeamInviteEmail(normalizedEmail, auth.profile.companyName, actorLabel, normalizedRole as (typeof TEAM_ROLES)[number]);
  } catch (err) {
    console.error("Failed to send team invite email:", err);
  }

  const members = await getEmployerTeamMembers(auth.profile.id, auth.profile.userId);
  return NextResponse.json({ members });
}

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { awardBadge } from "@/lib/badges";
import { db } from "@/lib/db";
import { employerTeamMembers, jobPostings } from "@/lib/db/schema";
import {
  getActorLabel,
  getFullEmployerAccess,
  getEmployerTeamActivity,
  getEmployerTeamMembers,
  logTeamActivity,
} from "@/lib/employer-profile";
import { sendTeamInviteEmail } from "@/lib/email";
import { getMemberJobAssignments, setMemberJobAssignments } from "@/lib/hiring-scope";
import { getSession } from "@/lib/session";
import { newInviteToken } from "@/lib/team-invite";
import { isTeamRole } from "@/lib/team-roles";
import { isUuid } from "@/lib/uuid";

// The Team page (and inviting) is for Owners and Admins only.
async function requireTeamAccess() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getFullEmployerAccess(session.userId);
  return access ? { ...access, userId: session.userId } : null;
}

export async function GET() {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const [members, activity, assignments] = await Promise.all([
    getEmployerTeamMembers(auth.profile.id, auth.profile.userId),
    getEmployerTeamActivity(auth.profile.id),
    getMemberJobAssignments(auth.profile.id),
  ]);
  return NextResponse.json({ members, activity, jobAssignments: Object.fromEntries(assignments) });
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
  const { email, role, position, jobPostingIds } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim().includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = role === undefined ? "admin" : role;
  if (!isTeamRole(normalizedRole)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  // A Hiring manager can be given their jobs right away (optional).
  if (
    jobPostingIds !== undefined &&
    (!Array.isArray(jobPostingIds) || !jobPostingIds.every((v) => typeof v === "string" && isUuid(v)))
  ) {
    return NextResponse.json({ error: "Invalid job postings." }, { status: 400 });
  }
  const initialJobIds = normalizedRole === "hiring_manager" && Array.isArray(jobPostingIds) ? [...new Set(jobPostingIds as string[])] : [];
  // Checked before the invite is made, so a stale pick (a posting deleted in
  // another tab) is reported instead of the new Hiring manager silently
  // joining with no jobs.
  if (initialJobIds.length > 0) {
    const found = await db
      .select({ id: jobPostings.id })
      .from(jobPostings)
      .where(and(eq(jobPostings.employerProfileId, auth.profile.id), inArray(jobPostings.id, initialJobIds)));
    if (found.length !== initialJobIds.length) {
      return NextResponse.json({ error: "One of the chosen job postings no longer exists. Refresh and pick again." }, { status: 400 });
    }
  }
  if (position !== undefined && position !== null && typeof position !== "string") {
    return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  }
  const normalizedPosition = typeof position === "string" && position.trim() ? position.trim() : null;
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

  // The emailed link carries the token; only its hash is stored.
  const invite = newInviteToken();
  let memberId: string;
  try {
    const [inserted] = await db
      .insert(employerTeamMembers)
      .values({
        employerProfileId: auth.profile.id,
        email: normalizedEmail,
        role: normalizedRole,
        position: normalizedPosition,
        status: "pending",
        inviteTokenHash: invite.hash,
        inviteExpiresAt: invite.expiresAt,
        invitedByUserId: auth.userId,
      })
      .returning({ id: employerTeamMembers.id });
    memberId = inserted.id;
  } catch {
    return NextResponse.json({ error: "That email is already invited or on the team." }, { status: 409 });
  }

  await awardBadge(auth.profile.id, "team_builder");

  const actorLabel = await getActorLabel(auth.userId);
  await logTeamActivity({
    employerProfileId: auth.profile.id,
    actorUserId: auth.userId,
    actorLabel,
    action: "invited",
    targetEmail: normalizedEmail,
    toRole: normalizedRole,
  });

  if (initialJobIds.length > 0) {
    // Postings from another company are refused inside; the invite itself stands either way.
    await setMemberJobAssignments({
      employerProfileId: auth.profile.id,
      companyName: auth.profile.companyName,
      member: { id: memberId, email: normalizedEmail, userId: null },
      jobPostingIds: initialJobIds,
      actor: { userId: auth.userId },
    });
  }

  // The invite row is real in the DB regardless of whether this send
  // succeeds — a flaky email provider shouldn't roll back a valid invite,
  // so this failure is swallowed rather than turning the request into a
  // 500 (the invited person can still be found on the Team page, and
  // "Resend" covers a send that silently never arrived).
  try {
    await sendTeamInviteEmail(normalizedEmail, auth.profile.companyName, actorLabel, normalizedRole, invite.token);
  } catch (err) {
    console.error("Failed to send team invite email:", err);
  }

  const [members, assignments] = await Promise.all([
    getEmployerTeamMembers(auth.profile.id, auth.profile.userId),
    getMemberJobAssignments(auth.profile.id),
  ]);
  return NextResponse.json({ members, jobAssignments: Object.fromEntries(assignments) });
}

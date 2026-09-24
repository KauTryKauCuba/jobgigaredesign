import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers } from "@/lib/db/schema";
import { getActorLabel, getEmployerAccess, logTeamActivity } from "@/lib/employer-profile";
import { sendTeamInviteEmail } from "@/lib/email";
import { getSession } from "@/lib/session";

async function requireTeamAccess() {
  const session = await getSession();
  if (!session || session.role !== "employer") return null;
  const access = await getEmployerAccess(session.userId);
  return access ? { ...access, userId: session.userId } : null;
}

// Re-sends the invite email for a still-pending member — covers the case
// where the original send failed silently (see the swallowed try/catch in
// POST /api/employer/team) or just never reached them (spam folder, typo
// since fixed, etc).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeamAccess();
  if (!auth) return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });

  const { id } = await params;
  const [member] = await db
    .select()
    .from(employerTeamMembers)
    .where(and(eq(employerTeamMembers.id, id), eq(employerTeamMembers.employerProfileId, auth.profile.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (member.status !== "pending") {
    return NextResponse.json({ error: "That person has already joined." }, { status: 400 });
  }

  const actorLabel = await getActorLabel(auth.userId);
  try {
    await sendTeamInviteEmail(member.email, auth.profile.companyName, actorLabel, member.role);
  } catch (err) {
    console.error("Failed to resend team invite email:", err);
    return NextResponse.json({ error: "Couldn't send the invite email — try again shortly." }, { status: 502 });
  }

  await logTeamActivity({
    employerProfileId: auth.profile.id,
    actorUserId: auth.userId,
    actorLabel,
    action: "resent_invite",
    targetEmail: member.email,
    toRole: member.role,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers } from "@/lib/db/schema";
import { logTeamActivity } from "@/lib/employer-profile";
import { findInviteByToken } from "@/lib/team-invite";

// "Decline" on the invite page. Having the emailed link is proof enough of
// owning that inbox (same as a sign-in code), so this doesn't need a
// sign-in. Removes the pending invite and tells the team on its activity log.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  const invite = await findInviteByToken(token);

  if (invite.state === "pending") {
    await db.delete(employerTeamMembers).where(eq(employerTeamMembers.id, invite.id));
    await logTeamActivity({
      employerProfileId: invite.employerProfileId,
      // The invitee may have no account — attribute it to whoever sent it.
      actorUserId: invite.invitedByUserId,
      actorLabel: invite.email,
      action: "declined",
      targetEmail: invite.email,
    });
    return NextResponse.redirect(new URL(`/invite/${token}?declined=1`, origin), 303);
  }
  return NextResponse.redirect(new URL(`/invite/${token}`, origin), 303);
}

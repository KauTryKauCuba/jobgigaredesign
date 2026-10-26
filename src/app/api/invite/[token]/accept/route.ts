import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { activatePendingTeamInvites } from "@/lib/employer-profile";
import { clearSession, createSession, getSession } from "@/lib/session";
import { findInviteByToken, rememberInvite } from "@/lib/team-invite";

// The invite page's main button (/invite/[token]). A POST, never a plain
// link visit, so it only ever runs on a deliberate click.
// - Signed in as the invited email: joins and goes into that company.
// - Signed out, or as someone else: signs out (if needed) and opens Sign in
//   pre-filled with the invited email; signing in finishes joining.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  // 303 so the browser follows with a GET.
  const to = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  const invite = await findInviteByToken(token);
  if (invite.state === "invalid" || invite.state === "expired") return to(`/invite/${token}`);

  const session = await getSession();
  if (session) {
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
    if (account && account.email.toLowerCase() === invite.email.toLowerCase()) {
      if (invite.state === "pending") await activatePendingTeamInvites(session.userId, invite.email);
      // Into this company, on the employer side.
      await createSession({ userId: session.userId, role: "employer", employerProfileId: invite.employerProfileId });
      // A first-timer gets the "About you" welcome step from here.
      return to("/employer/dashboard");
    }
    await clearSession();
  }

  await rememberInvite({
    email: invite.email,
    companyName: invite.companyName,
    employerProfileId: invite.employerProfileId,
  });
  return to("/employer");
}

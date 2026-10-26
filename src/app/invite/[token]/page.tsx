import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import EmployerOnboardingBadges from "@/components/EmployerOnboardingBadges";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import SiteThemeLayer from "@/components/SiteThemeLayer";
import { gradientFrameClass } from "@/components/formStyles";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getActorLabel } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";
import { findInviteByToken, INVITE_TTL_DAYS } from "@/lib/team-invite";
import { TEAM_ROLE_DESCRIPTION, TEAM_ROLE_LABEL } from "@/lib/team-roles";

export const metadata: Metadata = { title: "Team invite · JobGiga", robots: { index: false } };

const primaryButton =
  "flex h-[44px] w-full items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90";
const secondaryButton =
  "flex h-[44px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]";

/**
 * The "Accept invite" link in a team-invite email. Opening it changes
 * nothing — joining, declining or switching account are explicit button
 * presses (POSTs to /api/invite/[token]/…), so an email scanner opening the
 * link can't accept, decline or sign anyone out.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ declined?: string }>;
}) {
  const [{ token }, { declined }] = await Promise.all([params, searchParams]);
  const [invite, session, authUser] = await Promise.all([findInviteByToken(token), getSession(), getAuthUser()]);

  const [account] = session
    ? await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1)
    : [];
  const signedInEmail = account?.email ?? null;

  let body: React.ReactNode;
  let heading: React.ReactNode;
  if (declined) {
    heading = "Invite declined.";
    body = (
      <Message text="You won't be added to the team. If that was a mistake, ask them to invite you again.">
        <Link href="/" className={secondaryButton}>
          Go to JobGiga
        </Link>
      </Message>
    );
  } else if (invite.state === "invalid") {
    heading = (
      <>
        This invite link
        <br />
        isn&rsquo;t valid.
      </>
    );
    body = (
      <Message
        text="It may have been cancelled, or replaced by a newer invite email. Ask your team to send you a new one."
      >
        <Link href="/" className={secondaryButton}>
          Go to JobGiga
        </Link>
      </Message>
    );
  } else if (invite.state === "expired") {
    heading = (
      <>
        This invite
        <br />
        has expired.
      </>
    );
    body = (
      <Message
        text={`Invite links work for ${INVITE_TTL_DAYS} days. Ask ${invite.companyName} to resend your invite — you'll get a fresh link by email.`}
      >
        <Link href="/" className={secondaryButton}>
          Go to JobGiga
        </Link>
      </Message>
    );
  } else {
    const inviter = invite.invitedByUserId ? await getActorLabel(invite.invitedByUserId) : null;
    const isInvitee = signedInEmail?.toLowerCase() === invite.email.toLowerCase();
    const accepted = invite.state === "accepted";
    heading = (
      <>
        {accepted ? "You've joined" : "You're invited to"}
        <br />
        {invite.companyName}.
      </>
    );
    body = (
      <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
        <div className="rounded-[19px] bg-white p-[22px] text-center sm:p-[28px]">
          {invite.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invite.companyLogoUrl}
              alt=""
              className="mx-auto h-[64px] w-[64px] rounded-[14px] border border-black/[0.06] bg-white object-contain"
            />
          ) : (
            <span className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-[14px] bg-brand-teal-soft text-2xl text-brand-teal-dark">
              {invite.companyName.charAt(0).toUpperCase()}
            </span>
          )}

          <p className="mt-[14px] text-sm leading-[20px] text-[#4B5468]">
            {accepted ? (
              <>This invite has already been accepted.</>
            ) : (
              <>
                {inviter ? `${inviter} invited you` : "You've been invited"} to join as{" "}
                <span className="font-semibold text-[#141B2E]">{TEAM_ROLE_LABEL[invite.role]}</span> —{" "}
                {TEAM_ROLE_DESCRIPTION[invite.role].charAt(0).toLowerCase() + TEAM_ROLE_DESCRIPTION[invite.role].slice(1)}
              </>
            )}
          </p>
          <p className="mt-[10px] text-xs text-[#9AA3B2]">Invite for {invite.email}</p>

          {signedInEmail && !isInvitee && (
            <p className="mt-[16px] rounded-[12px] border border-[#FBE7B3] bg-brand-gold-soft p-[12px] text-left text-xs leading-[18px] text-[#141B2E]">
              You&rsquo;re signed in as <span className="font-semibold">{signedInEmail}</span>, but this invite is for{" "}
              <span className="font-semibold">{invite.email}</span>. Switch account to continue — you&rsquo;ll be signed
              out of {signedInEmail} first.
            </p>
          )}

          <div className="mt-[20px] flex flex-col gap-[8px]">
            <form action={`/api/invite/${token}/accept`} method="post">
              <button type="submit" className={primaryButton}>
                {accepted
                  ? isInvitee
                    ? "Go to dashboard"
                    : "Sign in to continue"
                  : signedInEmail && !isInvitee
                    ? `Switch account to ${invite.email}`
                    : isInvitee
                      ? "Accept invite"
                      : "Accept and sign in"}
              </button>
            </form>
            {!accepted && (
              <form action={`/api/invite/${token}/decline`} method="post">
                <button type="submit" className={secondaryButton}>
                  Decline
                </button>
              </form>
            )}
          </div>
          {!accepted && !isInvitee && (
            <p className="mt-[12px] text-xs text-[#9AA3B2]">
              {signedInEmail ? "After switching, sign in" : "Sign in"} with {invite.email} to join — no account yet?
              One is created when you sign in.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Same look as onboarding and the Welcome step: big headline, floating
  // badges down the sides, the card underneath.
  return (
    <>
      {/* An employer-team page, so it wears the employer site theme. */}
      <SiteThemeLayer audience="employer" />
      <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
        <Navbar initialUser={authUser} onboarding />
        <div className="relative">
          <EmployerOnboardingBadges />
          <Hero
            showRoleToggle={false}
            heading={heading}
            subheadingClassName="mb-[40px]"
            subheading="Hiring together on JobGiga."
            belowNav={<div className="mx-auto w-full max-w-[460px] text-left">{body}</div>}
          />
        </div>
      </main>
    </>
  );
}

function Message({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
      <div className="rounded-[19px] bg-white p-[22px] text-center sm:p-[28px]">
        <p className="text-sm leading-[20px] text-[#4B5468]">{text}</p>
        <div className="mt-[20px]">{children}</div>
      </div>
    </div>
  );
}

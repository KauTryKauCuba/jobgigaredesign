import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveExistingRoles } from "@/lib/auth-user";
import { users } from "@/lib/db/schema";
import { activatePendingTeamInvites } from "@/lib/employer-profile";
import { getPostAuthRedirect } from "@/lib/onboarding";
import { createSession } from "@/lib/session";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/auth-messages";

const STATE_COOKIE = "google_oauth_state";
const ERROR_COOKIE = "google_auth_error";

type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleUserInfo = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  // A cookie, not a URL param — same reasoning as `post_google_role_choice`
  // below: "/" unconditionally redirects to "/employer" (see src/app/page.tsx),
  // which drops any query string before the Navbar ever gets a chance to read
  // it. The cookie survives that hop since it's resent on every request.
  //
  // `role`, when known, sends the visitor back to the landing page they
  // actually started from ("/employer" or "/jobseeker") instead of always
  // through "/" -> "/employer" — otherwise a failed sign-in attempt from the
  // jobseeker page always bounces to the employer page, and a subsequent
  // "Get started" click would default to creating an employer account.
  // Unknown only for the earliest failures (missing/malformed code or
  // state), before the role-carrying state param has even been decoded.
  async function fail(message: string, role?: "employer" | "jobseeker") {
    const path = role === "jobseeker" ? "/jobseeker" : role === "employer" ? "/employer" : "/";
    const url = new URL(path, siteUrl);
    const response = NextResponse.redirect(url);
    // Next's cookies.set already URI-encodes the value, so this is stored
    // (and later read back client-side) pre-encoded without double-encoding.
    response.cookies.set(ERROR_COOKIE, message, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60,
      path: "/",
    });
    return response;
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return fail("Google sign-in was cancelled.");

  let parsedState: { role: "employer" | "jobseeker"; intent: "sign-in" | "get-started"; nonce: string };
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
  } catch {
    return fail("Invalid sign-in state.");
  }

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  if (!expectedNonce || expectedNonce !== parsedState.nonce) {
    return fail("Sign-in session expired. Try again.", parsedState.role);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("Google sign-in is not configured.", parsedState.role);

  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    return fail(tokenData.error_description ?? "Couldn't complete Google sign-in.", parsedState.role);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) return fail("Couldn't fetch your Google account details.", parsedState.role);
  const googleUser = (await userRes.json()) as GoogleUserInfo;

  if (!googleUser.email || !googleUser.email_verified) {
    return fail("Your Google account's email isn't verified.", parsedState.role);
  }

  const normalizedEmail = googleUser.email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  // Mirror the email/OTP sign-in flow (see /api/auth/otp/request): signing in
  // must never silently create an account. Without this check, "Continue
  // with Google" on the sign-in modal doubled as sign-up for any Google
  // account, bypassing the "we couldn't find an account" error the email
  // path already enforces.
  if (!existing && parsedState.intent === "sign-in") {
    return fail(ACCOUNT_NOT_FOUND_MESSAGE, parsedState.role);
  }

  let user = existing;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        googleId: googleUser.sub,
        role: parsedState.role,
      })
      .returning();
  } else if (!user.googleId) {
    [user] = await db
      .update(users)
      .set({ googleId: googleUser.sub, avatarUrl: user.avatarUrl ?? googleUser.picture })
      .where(eq(users.id, user.id))
      .returning();
  }

  // Connects any pending "invite this email to my team" row to this actual
  // account — must run before resolveExistingRoles below, so an invited
  // teammate signing in for the first time is correctly detected as having
  // employer access right away instead of on their next sign-in.
  await activatePendingTeamInvites(user.id, normalizedEmail);

  // Only the sign-in flow needs this — it never lets the user pick a role,
  // so an existing account's role must be auto-detected (or, if genuinely
  // dual-role, asked about) here instead. "Get started" always carries an
  // explicit, deliberate choice (via the toggle, or a locked flow's preset
  // role) that must be honored as-is — including when it's an existing
  // account using "Get started" specifically to add a second role.
  let sessionRole = parsedState.role;
  let needsRoleChoice = false;
  if (existing && parsedState.intent === "sign-in") {
    const existingRoles = await resolveExistingRoles(user.id);
    if (existingRoles.length === 1) sessionRole = existingRoles[0];
    else if (existingRoles.length > 1) needsRoleChoice = true;
  }

  await createSession({ userId: user.id, role: sessionRole });

  if (needsRoleChoice) {
    // Wherever this provisional sign-in ends up landing — "/" redirects to
    // "/employer", which can itself redirect again to "/employer/onboarding"
    // — a URL query param doesn't survive a chain of server-side redirects.
    // A cookie does, since it's resent automatically on every request to
    // this origin regardless of how many hops happen in between; the
    // Navbar (rendered on every page) reads and clears it client-side.
    cookieStore.set("post_google_role_choice", "1", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60,
      path: "/",
    });
  }

  const destination = await getPostAuthRedirect();

  return NextResponse.redirect(new URL(destination, siteUrl));
}

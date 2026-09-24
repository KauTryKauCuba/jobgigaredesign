import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 500 });
  }

  const { searchParams, origin } = new URL(request.url);
  const role = searchParams.get("role");
  const validRole = role === "employer" || role === "jobseeker" ? role : "employer";
  const intent = searchParams.get("intent");
  // Sign-in doesn't let the user pick a role at all (auto-detected from the
  // account instead), so the callback needs to know it's free to override
  // — or ask, for a dual-role account — rather than treating `validRole`
  // above as a real explicit choice the way a "get started" click is.
  const validIntent = intent === "sign-in" ? "sign-in" : "get-started";

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ role: validRole, intent: validIntent, nonce })).toString(
    "base64url",
  );

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/auth/google/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authUrl.toString());
}

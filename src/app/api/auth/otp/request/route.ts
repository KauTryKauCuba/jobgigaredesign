import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveExistingRoles } from "@/lib/auth-user";
import { otpCodes, users } from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/email";
import { generateOtp, hashOtp, otpExpiry } from "@/lib/otp";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/auth-messages";
import { hasPendingTeamInvite } from "@/lib/employer-profile";
import { clientIp } from "@/lib/phone-verification";
import { rateLimited } from "@/lib/rate-limit";

const RESEND_COOLDOWN_MS = 30 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// A single cap per email let anyone use it up for someone else's address and
// lock them out of signing in. So the everyday cap counts one email from one
// IP, a stranger elsewhere can't touch it, and the overall per-email ceiling
// (each code allows a few guesses, so this caps guessing) sits well above it.
const MAX_CODES_PER_EMAIL_PER_IP = 10;
const MAX_CODES_PER_EMAIL = 30;
// One address asking for codes to many inboxes.
const MAX_CODES_PER_IP = 60;
const TOO_MANY = "Too many codes requested. Try again in an hour.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, role } = (body ?? {}) as { email?: unknown; role?: unknown };
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (role !== undefined && role !== "employer" && role !== "jobseeker") {
    return NextResponse.json({ error: "Choose an account type." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();
  // Unknown behind no proxy (local dev): then only the per-email ceiling applies.
  const ip = clientIp(request);
  if (ip && rateLimited(`otp-ip:${ip}`, MAX_CODES_PER_IP, HOUR_MS)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  // Sign-in omits `role` entirely — the account itself should say which
  // side to use rather than making a returning user pick every time.
  let resolvedRole: "employer" | "jobseeker";
  if (role === "employer" || role === "jobseeker") {
    resolvedRole = role;
  } else {
    const [existingUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (!existingUser) {
      // An invited teammate's first sign-in — the invite email tells them
      // to "sign in", so don't turn them away for not having an account yet.
      // The account is created (as an employer) when they verify the code.
      if (!(await hasPendingTeamInvite(normalizedEmail))) {
        return NextResponse.json({ error: ACCOUNT_NOT_FOUND_MESSAGE }, { status: 404 });
      }
      resolvedRole = "employer";
    } else {
      const existingRoles = await resolveExistingRoles(existingUser.id);
      if (existingRoles.length > 1) {
        // Genuinely ambiguous — hand it back to the client to ask, rather
        // than guessing which side the user actually wants right now.
        return NextResponse.json({ needsRoleChoice: true });
      }
      resolvedRole = existingRoles[0] ?? existingUser.role;
    }
  }

  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalizedEmail), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a moment before requesting another code." },
      { status: 429 },
    );
  }

  const [{ sent }] = await db
    .select({ sent: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalizedEmail), gte(otpCodes.createdAt, new Date(Date.now() - HOUR_MS))));
  if (sent >= MAX_CODES_PER_EMAIL) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  if (ip && rateLimited(`otp-email-ip:${normalizedEmail}:${ip}`, MAX_CODES_PER_EMAIL_PER_IP, HOUR_MS)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const code = generateOtp();

  try {
    await sendOtpEmail(normalizedEmail, code);
  } catch {
    return NextResponse.json(
      { error: "Couldn't send the code. Try again in a moment." },
      { status: 502 },
    );
  }

  await db.insert(otpCodes).values({
    email: normalizedEmail,
    codeHash: hashOtp(code, normalizedEmail),
    role: resolvedRole,
    expiresAt: otpExpiry(),
  });

  return NextResponse.json({ ok: true, role: resolvedRole });
}

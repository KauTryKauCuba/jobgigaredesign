import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveExistingRoles } from "@/lib/auth-user";
import { otpCodes, users } from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/email";
import { generateOtp, hashOtp, otpExpiry } from "@/lib/otp";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/auth-messages";

const RESEND_COOLDOWN_MS = 30 * 1000;

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
      return NextResponse.json({ error: ACCOUNT_NOT_FOUND_MESSAGE }, { status: 404 });
    }
    const existingRoles = await resolveExistingRoles(existingUser.id);
    if (existingRoles.length > 1) {
      // Genuinely ambiguous — hand it back to the client to ask, rather
      // than guessing which side the user actually wants right now.
      return NextResponse.json({ needsRoleChoice: true });
    }
    resolvedRole = existingRoles[0] ?? existingUser.role;
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

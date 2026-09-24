import { NextResponse } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { otpCodes, users } from "@/lib/db/schema";
import { activatePendingTeamInvites } from "@/lib/employer-profile";
import { getPostAuthRedirect } from "@/lib/onboarding";
import { hashOtp, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, code, role } = (body ?? {}) as {
    email?: unknown;
    code?: unknown;
    role?: unknown;
  };
  if (typeof email !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "Missing email or code." }, { status: 400 });
  }
  if (role !== "employer" && role !== "jobseeker") {
    return NextResponse.json({ error: "Choose an account type." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();

  const [record] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalizedEmail), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!record) {
    return NextResponse.json(
      { error: "No code found for this email. Request a new one." },
      { status: 400 },
    );
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "That code has expired. Request a new one." },
      { status: 400 },
    );
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }

  if (hashOtp(code, normalizedEmail) !== record.codeHash) {
    // Atomic increment (not attempts: record.attempts + 1) so concurrent
    // verify requests for the same code can't race and under-count attempts.
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, record.id));
    return NextResponse.json({ error: "That code isn't right." }, { status: 400 });
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, record.id));

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  let user = existing;
  if (!user) {
    [user] = await db.insert(users).values({ email: normalizedEmail, role }).returning();
  }

  // Connects any pending "invite this email to my team" row to this actual
  // account — whether they're brand new or had an account from before the
  // invite was sent. Must happen before getPostAuthRedirect() below, or an
  // invited teammate would get bounced to /employer/onboarding on this very
  // first post-auth redirect.
  await activatePendingTeamInvites(user.id, normalizedEmail);

  await createSession({ userId: user.id, role });

  const redirectTo = await getPostAuthRedirect();

  return NextResponse.json({
    user: { email: user.email, name: user.name, avatarUrl: user.avatarUrl, role },
    redirectTo,
  });
}

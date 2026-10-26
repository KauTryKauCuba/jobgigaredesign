import { NextResponse } from "next/server";
import { toMalaysianMobileE164 } from "@/lib/phone";
import {
  canVerifyPhone,
  checkSendAllowed,
  clientIp,
  isPhoneVerificationAvailable,
  isPhoneVerifiedFor,
  recordAttempt,
  sendVerificationCode,
} from "@/lib/phone-verification";
import { getSession } from "@/lib/session";

// Texts a code to the phone number the person typed. Jobseekers and a
// company's owner only; Malaysian mobiles only.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await canVerifyPhone(session))) {
    return NextResponse.json({ error: "Phone verification is for jobseekers and company owners." }, { status: 403 });
  }
  if (!isPhoneVerificationAvailable()) {
    return NextResponse.json({ error: "Phone verification isn't available right now." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { phone, channel: rawChannel } = (body ?? {}) as Record<string, unknown>;
  // A text by default; "call" phones and reads the code out (the fallback).
  const channel = rawChannel === "call" ? "call" : "sms";
  const e164 = typeof phone === "string" ? toMalaysianMobileE164(phone) : null;
  if (!e164) {
    return NextResponse.json({ error: "Enter a Malaysian mobile number — only mobiles can get a text." }, { status: 400 });
  }
  if (await isPhoneVerifiedFor(session.userId, phone as string)) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const ip = clientIp(request);
  const allowed = await checkSendAllowed(session.userId, e164, channel, ip);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error, retryAfterSeconds: allowed.retryAfterSeconds }, { status: allowed.status });
  }
  // Counted before sending, so a failing send can't be retried without limit either.
  await recordAttempt(session.userId, e164, channel === "call" ? "call" : "send", ip);
  const sent = await sendVerificationCode(e164, channel);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json({ ok: true });
}

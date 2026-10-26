import { NextResponse } from "next/server";
import { ensureCampaignClaim } from "@/lib/campaigns";
import { toMalaysianMobileE164 } from "@/lib/phone";
import {
  canVerifyPhone,
  checkCheckAllowed,
  checkVerificationCode,
  markPhoneVerified,
  recordAttempt,
} from "@/lib/phone-verification";
import { getSession } from "@/lib/session";

// Checks the code the person typed; if it's right, the number is verified.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await canVerifyPhone(session))) {
    return NextResponse.json({ error: "Phone verification is for jobseekers and company owners." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { phone, code } = (body ?? {}) as Record<string, unknown>;
  const e164 = typeof phone === "string" ? toMalaysianMobileE164(phone) : null;
  if (!e164) return NextResponse.json({ error: "Enter a Malaysian mobile number." }, { status: 400 });
  if (typeof code !== "string" || !/^\d{4,8}$/.test(code.trim())) {
    return NextResponse.json({ error: "Enter the 6-digit code from the text." }, { status: 400 });
  }

  const allowed = await checkCheckAllowed(session.userId);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await recordAttempt(session.userId, e164, "check");

  const result = await checkVerificationCode(e164, code.trim());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await markPhoneVerified(session.userId, e164);
  // A running reward campaign gives its reward now (the page refresh that
  // follows shows the "You've earned a reward" popup).
  await ensureCampaignClaim(session.userId, session.role).catch((err) => console.error("Campaign claim after verifying failed", err));
  return NextResponse.json({ ok: true, verified: true });
}

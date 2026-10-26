import { NextResponse } from "next/server";
import { toMalaysianMobileE164 } from "@/lib/phone";
import { canVerifyPhone, isPhoneVerificationAvailable, isPhoneVerifiedFor } from "@/lib/phone-verification";
import { getSession } from "@/lib/session";

// For the phone field: can this number be verified here, and is it already?
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const phone = new URL(request.url).searchParams.get("phone") ?? "";
  const isMobile = toMalaysianMobileE164(phone) !== null;
  const canVerify = (await canVerifyPhone(session)) && isPhoneVerificationAvailable();
  return NextResponse.json({
    canVerify,
    isMobile,
    verified: canVerify && isMobile ? await isPhoneVerifiedFor(session.userId, phone) : false,
  });
}

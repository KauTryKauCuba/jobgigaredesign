import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

// The "Verify your phone number" bar's X — hides it for this account
// everywhere, for good. (Whether it shows is worked out in getAuthUser.)
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await db.update(users).set({ phoneVerifyBannerDismissedAt: new Date() }).where(eq(users.id, session.userId));
  return NextResponse.json({ ok: true });
}

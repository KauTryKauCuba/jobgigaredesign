import { NextResponse } from "next/server";
import { markRewardSeen } from "@/lib/campaigns";
import { getSession } from "@/lib/session";

// The "You've earned a reward" popup was closed — don't show it again.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  await markRewardSeen(session.userId, body?.id);
  return NextResponse.json({ ok: true });
}

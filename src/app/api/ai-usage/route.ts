import { NextResponse } from "next/server";
import { getAiUsageForUser } from "@/lib/ai-usage";
import { getSession } from "@/lib/session";

// Backs the avatar dropdown's inline "AI Usage" summary — just the totals,
// not the full recent-calls list, since it renders inside a 220px menu, not
// a dedicated page.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { totalCalls, totalTokens } = await getAiUsageForUser(session.userId);
  return NextResponse.json({ totalCalls, totalTokens });
}

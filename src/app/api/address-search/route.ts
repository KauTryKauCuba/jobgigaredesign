import { NextResponse } from "next/server";
import { searchAddresses } from "@/lib/address-search";
import { getSession } from "@/lib/session";

// Address suggestions while typing a street or building (see address-search.ts).
// Signed-in only, so it isn't an open proxy to OpenStreetMap's free service.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 200) return NextResponse.json({ suggestions: [] });

  try {
    return NextResponse.json({ suggestions: await searchAddresses(q) });
  } catch {
    // Search down or slow — the address can still be typed in by hand.
    return NextResponse.json({ suggestions: [], unavailable: true });
  }
}

import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/place-search";
import { getSession } from "@/lib/session";

// Towns and areas while a jobseeker types where they are / want to work (see
// place-search.ts). Signed-in only, so it isn't an open proxy to
// OpenStreetMap's free service.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) return NextResponse.json({ places: [] });
  return NextResponse.json(await searchPlaces(q));
}

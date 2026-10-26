import { NextResponse } from "next/server";
import { lookupAddressArea } from "@/lib/address-area";
import { getSession } from "@/lib/session";

// The neighbourhood for a street address + postcode (see address-area.ts).
// Signed-in only — every call may reach OpenStreetMap, whose free service
// this mustn't turn into an open proxy for.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const street = (params.get("street") ?? "").trim();
  const postcode = params.get("postcode") ?? "";
  if (!street || street.length > 200 || !/^\d{5}$/.test(postcode)) {
    return NextResponse.json({ error: "Enter a street address and a 5-digit postcode." }, { status: 400 });
  }

  try {
    return NextResponse.json({ area: await lookupAddressArea(street, postcode) });
  } catch {
    // Lookup service down or slow — the employer can type the area in.
    return NextResponse.json({ area: null, unavailable: true });
  }
}

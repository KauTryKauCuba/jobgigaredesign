import { NextResponse } from "next/server";
import { lookupPostcode } from "@/lib/postcodes";

// Public reference data (Malaysia's postcode → town/state list), looked up
// here rather than shipped to the browser, so address forms can fill in the
// city and state from a postcode without a ~240 KB download.
export async function GET(_request: Request, { params }: { params: Promise<{ postcode: string }> }) {
  const { postcode } = await params;
  if (!/^\d{5}$/.test(postcode)) {
    return NextResponse.json({ error: "A postcode is 5 digits." }, { status: 400 });
  }
  return NextResponse.json(
    { matches: lookupPostcode(postcode) },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}

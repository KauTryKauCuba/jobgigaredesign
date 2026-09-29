import { NextResponse } from "next/server";
import { getEmployerProfile } from "@/lib/employer-profile";
import { computeMatchResults } from "@/lib/match-results";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const profile = await getEmployerProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({ results: await computeMatchResults(profile) });
}

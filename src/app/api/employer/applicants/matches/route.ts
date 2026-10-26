import { NextResponse } from "next/server";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { computeMatchResults } from "@/lib/match-results";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const access = await getScopedEmployerAccess(session.userId);
  if (!access) {
    return NextResponse.json({ results: [] });
  }

  // A Hiring manager's ranking covers only their own postings.
  return NextResponse.json({ results: await computeMatchResults(access.profile, access.scope) });
}

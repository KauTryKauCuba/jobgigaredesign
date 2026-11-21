import { NextResponse } from "next/server";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { computeMatchResults } from "@/lib/match-results";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

const MAX_IDS = 50;

// Several applicants at once, for a reply's row of profile cards: loading the
// company's applications and match scores once, not once per card. Ids the
// user can't see are simply left out of the result.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getScopedEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every(isUuid)) {
    return NextResponse.json({ error: "Invalid applicant ids." }, { status: 400 });
  }

  const wanted = new Set<string>(ids);
  const [applications, matches] = await Promise.all([
    getApplicationsForEmployer(access.profile.id, access.scope),
    computeMatchResults(access.profile, access.scope),
  ]);
  const fitById = new Map(matches.map((m) => [m.applicationId, { score: m.score, eligible: m.eligible }]));
  const items = Object.fromEntries(
    applications
      .filter((a) => wanted.has(a.application.id))
      .map((a) => [a.application.id, { applicant: a, fit: fitById.get(a.application.id) ?? null }]),
  );
  return NextResponse.json({ items });
}

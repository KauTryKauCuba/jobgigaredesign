import { NextResponse } from "next/server";
import { getEmployerMemberships } from "@/lib/employer-profile";
import { getSession, setActiveEmployerCompany } from "@/lib/session";

// The only way `session.employerProfileId` ever changes — the company
// switcher's "pick a company" action. Re-validates membership server-side
// rather than trusting the id the client sends: without this, editing the
// request body could park someone's session on a company they don't belong
// to, and everything downstream (getEmployerAccess) would then trust it.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { employerProfileId } = (body ?? {}) as Record<string, unknown>;
  if (typeof employerProfileId !== "string") {
    return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
  }

  const memberships = await getEmployerMemberships(session.userId);
  const target = memberships.find((m) => m.profile.id === employerProfileId);
  if (!target) return NextResponse.json({ error: "You don't have access to that company." }, { status: 403 });

  await setActiveEmployerCompany(employerProfileId);
  return NextResponse.json({ ok: true });
}

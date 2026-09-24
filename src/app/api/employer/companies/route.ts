import { NextResponse } from "next/server";
import { getEmployerMemberships } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

// Backs the company switcher — every company this employer belongs to, plus
// which one is "current" (mirrors getEmployerAccess's own resolution, so the
// switcher's highlighted item always matches what the rest of the dashboard
// is actually showing).
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  const memberships = await getEmployerMemberships(session.userId);
  const current = session.employerProfileId
    ? (memberships.find((m) => m.profile.id === session.employerProfileId) ?? memberships[0])
    : memberships[0];

  return NextResponse.json({
    companies: memberships.map((m) => ({
      id: m.profile.id,
      companyName: m.profile.companyName,
      logoUrl: m.profile.logoUrl,
      role: m.role,
      ownerName: m.profile.contactName,
      industry: m.profile.industry,
      companySize: m.profile.companySize,
      joinedAt: m.joinedAt,
    })),
    currentId: current?.profile.id ?? null,
  });
}

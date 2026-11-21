import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { getSeekerMatchDetail } from "@/lib/match-map";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isUuid } from "@/lib/uuid";

// The Matching page's jobseeker view: one jobseeker scored against every
// live posting, with what of their profile matching uses (and doesn't).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !(await isSuperadminEmail(authUser.email))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const detail = await getSeekerMatchDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(detail);
}

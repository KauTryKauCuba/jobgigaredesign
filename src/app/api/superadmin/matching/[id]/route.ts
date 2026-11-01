import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { getPostingMatchDetail } from "@/lib/match-map";
import { isSuperadminEmail } from "@/lib/superadmin";

// The Matching page's explorer: one posting scored against every jobseeker,
// with each part of the score and why.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !(await isSuperadminEmail(authUser.email))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const detail = await getPostingMatchDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(detail);
}

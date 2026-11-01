import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminOwner } from "@/lib/superadmin";
import { listSuperadmins, removeSuperadmin } from "@/lib/superadmin-admins";
import { isUuid } from "@/lib/uuid";

// Removes an added admin — their access ends on their next page load. Owners
// only, and owners themselves can't be removed here (they live in the env).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminOwner(authUser.email)) {
    return NextResponse.json({ error: "Only owners can remove admins." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id) || !(await removeSuperadmin(id))) {
    return NextResponse.json({ error: "That admin was already removed." }, { status: 404 });
  }
  return NextResponse.json({ admins: await listSuperadmins() });
}

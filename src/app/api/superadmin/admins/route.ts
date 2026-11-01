import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { getSession } from "@/lib/session";
import { isSuperadminOwner } from "@/lib/superadmin";
import { addSuperadmin, listSuperadmins } from "@/lib/superadmin-admins";

// Adds a superadmin by email. Owners only (SUPERADMIN_EMAILS) — added admins
// can use the panel but not change who else can.
export async function POST(request: Request) {
  const [authUser, session] = await Promise.all([getAuthUser(), getSession()]);
  if (!authUser || !session || !isSuperadminOwner(authUser.email)) {
    return NextResponse.json({ error: "Only owners can add admins." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const email = (body as { email?: unknown })?.email;
  if (typeof email !== "string") return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  const result = await addSuperadmin(email, session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ admins: await listSuperadmins() });
}

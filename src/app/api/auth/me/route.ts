import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveAvatarUrl, resolveNameForRole } from "@/lib/auth-user";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const [user] = await db
    .select({ email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return NextResponse.json({ user: null });

  const [avatarUrl, name] = await Promise.all([
    resolveAvatarUrl(session.userId, session.role, user.avatarUrl),
    resolveNameForRole(session.userId, session.role, user.name),
  ]);

  return NextResponse.json({ user: { ...user, name, avatarUrl, role: session.role } });
}

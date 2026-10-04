import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolveAvatarUrl, resolveEmployerBadge, resolveNameForRole } from "@/lib/auth-user";
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

  const [avatarUrl, name, badge] = await Promise.all([
    resolveAvatarUrl(session.userId, session.role, user.avatarUrl),
    resolveNameForRole(session.userId, session.role, user.name),
    session.role === "employer" ? resolveEmployerBadge(session.userId) : null,
  ]);

  return NextResponse.json({
    user: {
      id: session.userId,
      ...user,
      name,
      avatarUrl,
      role: session.role,
      position: badge?.position ?? null,
      teamRole: badge?.teamRole ?? null,
    },
  });
}

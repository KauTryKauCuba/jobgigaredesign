import { getAuthUser } from "@/lib/auth-user";
import { getSession } from "@/lib/session";
import { isSuperadminEmail } from "@/lib/superadmin";

export async function requireSuperadmin(): Promise<{ id: string } | null> {
  const [authUser, session] = await Promise.all([getAuthUser(), getSession()]);
  return authUser && session && isSuperadminEmail(authUser.email) ? { id: session.userId } : null;
}

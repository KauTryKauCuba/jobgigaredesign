import "server-only";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { users } from "./db/schema";

const COOKIE_NAME = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  role: "employer" | "jobseeker";
  // Which company an employer is currently "looking at" — only meaningful
  // for role "employer", and only set once they've either used the company
  // switcher or been resolved to a default (see getEmployerAccess). Absent
  // for every jobseeker session and for an employer who's never had a
  // reason to disambiguate (the common single-company case).
  employerProfileId?: string;
};

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  let role: "employer" | "jobseeker";
  let employerProfileId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    if (payload.role !== "employer" && payload.role !== "jobseeker") return null;
    userId = payload.userId;
    role = payload.role;
    if (typeof payload.employerProfileId === "string") employerProfileId = payload.employerProfileId;
  } catch {
    return null;
  }

  // The cookie is a self-contained JWT with no DB check baked in — if the
  // underlying user row is gone (a dev DB reset, an admin deleting the
  // account, etc.) it still verifies fine. Left unchecked, that stranded a
  // visitor in a "signed in but nothing to attach to" state: pages that
  // gate on a profile existing (getOnboardingRedirect) would send them to
  // onboarding, but submitting it hit a foreign-key violation on
  // employerProfiles/jobseekerProfiles.userId with no clear error — stuck
  // on the onboarding form with no way out. Not clearing the cookie itself
  // here since Next.js only allows cookie mutation from a Server Action or
  // Route Handler, and getSession() is called from plain Server Components
  // too — treating it as signed-out is enough; a real sign-in overwrites it.
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  return { userId, role, employerProfileId };
}

// Re-signs the session cookie with a different "current company" — the only
// way `employerProfileId` ever changes. Callable only from a Route Handler
// or Server Action (same cookie-mutation restriction as createSession);
// getEmployerAccess deliberately never calls this itself so it stays safe
// to call from plain Server Components too (see its own comment).
export async function setActiveEmployerCompany(employerProfileId: string) {
  const session = await getSession();
  if (!session || session.role !== "employer") throw new Error("Not signed in as an employer.");
  await createSession({ ...session, employerProfileId });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

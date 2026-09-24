import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { jobseekerProfiles } from "./db/schema";
import { getEmployerAccess } from "./employer-profile";
import { getSession } from "./session";

/**
 * Where a signed-in user should be sent to finish onboarding, or null if
 * they're signed out or already have a profile. Checked on every page that
 * requires a completed profile, not just at the moment of sign-in/signup —
 * onboarding is compulsory.
 */
export async function getOnboardingRedirect(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "employer") {
    // Owns a company (went through onboarding themselves) OR belongs to
    // one as an invited team member — either way, no onboarding needed.
    // Checking ownership alone here used to force every invited teammate
    // into /employer/onboarding on every single page load, forever, since
    // they'd never have a profile of their own to be found.
    const access = await getEmployerAccess(session.userId);
    return access ? null : "/employer/onboarding";
  }

  const [profile] = await db
    .select({ id: jobseekerProfiles.id })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  return profile ? null : "/jobseeker/onboarding";
}

/**
 * Where to actually send someone right after signing in or switching role —
 * unlike `getOnboardingRedirect`, this never returns null, so callers don't
 * fall back to "/" (which always lands on the employer marketing page
 * regardless of role). Onboarding first if it's not done; otherwise straight
 * to that role's dashboard. Deliberately not "/employer" or "/jobseeker" —
 * those are the public marketing pages and, unlike this, never auto-redirect
 * a signed-in visitor anywhere.
 */
export async function getPostAuthRedirect(): Promise<string> {
  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) return onboardingRedirect;

  const session = await getSession();
  return session?.role === "employer" ? "/employer/dashboard" : "/jobseeker/dashboard";
}

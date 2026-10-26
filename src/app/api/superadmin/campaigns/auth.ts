import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { CampaignError } from "@/lib/campaigns";
import { getSession } from "@/lib/session";
import { isSuperadminEmail } from "@/lib/superadmin";

export async function requireSuperadmin(): Promise<{ id: string; email: string } | null> {
  const [authUser, session] = await Promise.all([getAuthUser(), getSession()]);
  return authUser && session && isSuperadminEmail(authUser.email) ? { id: session.userId, email: authUser.email } : null;
}

export const notAuthorized = () => NextResponse.json({ error: "Not authorized." }, { status: 403 });

/** Runs a campaign action, turning its CampaignError into a friendly JSON error. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CampaignError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Campaign request failed", err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

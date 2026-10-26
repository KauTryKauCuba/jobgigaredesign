import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth-user";
import { getCompanyLimitInfo, MAX_COMPANY_LIMIT } from "@/lib/company-limit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isSuperadminEmail } from "@/lib/superadmin";
import { isUuid } from "@/lib/uuid";

// Sets how many companies one account may register: a whole number, or
// null to go back to the default. Lowering it below what they already have
// deletes nothing — they just can't add more until they're under it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { limit } = (body ?? {}) as Record<string, unknown>;
  if (limit !== null && !(typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= MAX_COMPANY_LIMIT)) {
    return NextResponse.json({ error: `Enter a whole number from 1 to ${MAX_COMPANY_LIMIT}.` }, { status: 400 });
  }

  const [updated] = await db.update(users).set({ companyLimit: limit }).where(eq(users.id, id)).returning({ id: users.id });
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ companyLimit: await getCompanyLimitInfo(id) });
}

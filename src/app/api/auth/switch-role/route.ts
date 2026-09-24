import { NextResponse } from "next/server";
import { getPostAuthRedirect } from "@/lib/onboarding";
import { createSession, getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { role } = (body ?? {}) as { role?: unknown };
  if (role !== "employer" && role !== "jobseeker") {
    return NextResponse.json({ error: "Choose an account type." }, { status: 400 });
  }

  await createSession({ userId: session.userId, role });

  const redirectTo = await getPostAuthRedirect();

  return NextResponse.json({ ok: true, redirectTo });
}

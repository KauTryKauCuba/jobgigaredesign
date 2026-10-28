import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employerTeamMembers, users } from "@/lib/db/schema";
import { getEmployerAccess } from "@/lib/employer-profile";
import { CONTACT_ROLES } from "@/lib/positions";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { isBase64DataUrl, saveBase64Upload } from "@/lib/uploads";

const MAX_NAME_LENGTH = 80;
const MAX_POSITION_LENGTH = 120;
const MAX_PHONE_LENGTH = 30;
// ~3 MB image, base64-encoded.
const MAX_AVATAR_DATA_URL_LENGTH = 4_200_000;

/**
 * An invited teammate's own My Profile — their name and photo (on their
 * account) and their position at the company they're acting for (on their
 * team-member row). The company registrant's details live on the company
 * record instead and are edited through /api/employer/profile, which is why
 * this refuses the registrant.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const access = await getEmployerAccess(session.userId);
  if (!access) return NextResponse.json({ error: "No company found." }, { status: 404 });
  if (access.profile.userId === session.userId) {
    return NextResponse.json({ error: "Edit your details from the company contact form." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Keep your name under ${MAX_NAME_LENGTH} characters.` }, { status: 400 });
  }

  if (body.position !== null && body.position !== undefined && typeof body.position !== "string") {
    return NextResponse.json({ error: "Invalid position." }, { status: 400 });
  }
  const position = typeof body.position === "string" ? body.position.trim() : "";
  if (position.length > MAX_POSITION_LENGTH) {
    return NextResponse.json({ error: `Keep your position under ${MAX_POSITION_LENGTH} characters.` }, { status: 400 });
  }

  // Same required fields as the registrant's About you.
  const hiringRole = typeof body.hiringRole === "string" ? body.hiringRole.trim() : "";
  if (!(CONTACT_ROLES as readonly string[]).includes(hiringRole)) {
    return NextResponse.json({ error: "Choose your role." }, { status: 400 });
  }
  if (!position) return NextResponse.json({ error: "Choose your position." }, { status: 400 });
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) return NextResponse.json({ error: "Enter your phone number." }, { status: 400 });
  if (phone.length > MAX_PHONE_LENGTH || !/^[0-9+\-\s()]+$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  // undefined = leave the photo alone; null/"" = remove it; a data URL = new upload.
  let avatarUrl: string | null | undefined;
  if (body.avatarUrl === null || body.avatarUrl === "") {
    avatarUrl = null;
  } else if (isBase64DataUrl(body.avatarUrl)) {
    if (body.avatarUrl.length > MAX_AVATAR_DATA_URL_LENGTH || !/^data:image\/(png|jpe?g);base64,/.test(body.avatarUrl)) {
      return NextResponse.json({ error: "Use a JPG or PNG photo up to 3 MB." }, { status: 400 });
    }
    avatarUrl = await saveBase64Upload(body.avatarUrl, "avatars");
  } else if (body.avatarUrl !== undefined) {
    return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name, ...(avatarUrl !== undefined ? { avatarUrl } : {}) })
      .where(eq(users.id, session.userId));
    await tx
      .update(employerTeamMembers)
      // Saving from the welcome step (or My Profile) completes "About you".
      .set({ position, hiringRole, phone, profileCompletedAt: new Date() })
      .where(
        and(
          eq(employerTeamMembers.employerProfileId, access.profile.id),
          eq(employerTeamMembers.userId, session.userId),
        ),
      );
  });
  revalidatePublicData();

  return NextResponse.json({ ok: true });
}

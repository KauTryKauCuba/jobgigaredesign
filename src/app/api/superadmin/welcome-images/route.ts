import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-user";
import { revalidatePublicData } from "@/lib/public-data";
import { getSession } from "@/lib/session";
import { isSuperadminEmail } from "@/lib/superadmin";
import {
  getWelcomeImages,
  resetWelcomeImage,
  setWelcomeImage,
  WELCOME_IMAGE_MAX_BYTES,
  WELCOME_ROLES,
  type WelcomeRole,
} from "@/lib/welcome-images";

function isWelcomeRole(value: unknown): value is WelcomeRole {
  return typeof value === "string" && (WELCOME_ROLES as readonly string[]).includes(value);
}

async function requireSuperadmin() {
  const [authUser, session] = await Promise.all([getAuthUser(), getSession()]);
  return authUser && session && isSuperadminEmail(authUser.email) ? { id: session.userId } : null;
}

// Replace a landing page's welcome popup image. Multipart: role
// ("employer" | "jobseeker") and image (JPG, PNG or WebP).
export async function POST(request: Request) {
  const authUser = await requireSuperadmin();
  if (!authUser) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  let role: unknown;
  let file: File | null;
  try {
    const form = await request.formData();
    role = form.get("role");
    const image = form.get("image");
    file = image instanceof File && image.size > 0 ? image : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!isWelcomeRole(role)) return NextResponse.json({ error: "Choose employer or jobseeker." }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > WELCOME_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large (max 10 MB)." }, { status: 413 });
  }

  try {
    await setWelcomeImage(role, Buffer.from(await file.arrayBuffer()), authUser.id);
  } catch {
    return NextResponse.json({ error: "We couldn't read that image — try a JPG or PNG." }, { status: 400 });
  }
  revalidatePublicData();
  return NextResponse.json({ images: await getWelcomeImages() });
}

// Back to the built-in image. ?role=employer|jobseeker
export async function DELETE(request: Request) {
  const authUser = await requireSuperadmin();
  if (!authUser) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const role = new URL(request.url).searchParams.get("role");
  if (!isWelcomeRole(role)) return NextResponse.json({ error: "Choose employer or jobseeker." }, { status: 400 });
  await resetWelcomeImage(role);
  revalidatePublicData();
  return NextResponse.json({ images: await getWelcomeImages() });
}

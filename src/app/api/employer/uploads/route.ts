import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { saveBufferUpload } from "@/lib/uploads";

const MAX_BYTES = 10 * 1024 * 1024;

// How each kind of company-profile photo is stored: gallery photos keep
// their shape (just made web-sized), leadership photos are square headshots.
const KINDS = {
  gallery: { category: "gallery", width: 1600, height: 1600, fit: "inside" },
  leader: { category: "leaders", width: 400, height: 400, fit: "cover" },
} as const;

/**
 * Uploads one company-profile photo the moment it's picked (office/team
 * gallery, leadership headshot) and returns its URL — the profile form then
 * just holds short URLs, which also survive a refresh during onboarding.
 * Multipart: kind ("gallery" | "leader"), image (JPG, PNG or WebP).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let kind: unknown;
  let file: File | null;
  try {
    const form = await request.formData();
    kind = form.get("kind");
    const image = form.get("image");
    file = image instanceof File && image.size > 0 ? image : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (kind !== "gallery" && kind !== "leader") return NextResponse.json({ error: "Invalid photo type." }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP photo." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large (max 10 MB)." }, { status: 413 });

  const { category, width, height, fit } = KINDS[kind];
  try {
    const { default: sharp } = await import("sharp");
    const output = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // phone photos' EXIF orientation
      .resize(width, height, { fit, position: "centre", withoutEnlargement: fit === "inside" })
      .webp({ quality: 82 })
      .toBuffer();
    return NextResponse.json({ url: await saveBufferUpload(output, "image/webp", category) });
  } catch {
    return NextResponse.json({ error: "We couldn't read that photo — try a JPG or PNG." }, { status: 400 });
  }
}

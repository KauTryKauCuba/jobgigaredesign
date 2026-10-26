import { NextResponse } from "next/server";
import {
  listThemes,
  removeThemeBannerImage,
  setThemeBannerImage,
  THEME_BANNER_IMAGE_MAX_BYTES,
} from "@/lib/site-themes";
import { isUuid } from "@/lib/uuid";
import { requireSuperadmin } from "../../auth";

// The small picture beside the banner text. Multipart: image (JPG, PNG or WebP).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let file: File | null;
  try {
    const image = (await request.formData()).get("image");
    file = image instanceof File && image.size > 0 ? image : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > THEME_BANNER_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large (max 5 MB)." }, { status: 413 });
  }

  let theme;
  try {
    theme = await setThemeBannerImage(id, Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "We couldn't read that image — try a JPG or PNG." }, { status: 400 });
  }
  if (!theme) return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });
  return NextResponse.json({ theme, themes: await listThemes() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const theme = await removeThemeBannerImage(id);
  if (!theme) return NextResponse.json({ error: "That theme no longer exists." }, { status: 404 });
  return NextResponse.json({ theme, themes: await listThemes() });
}

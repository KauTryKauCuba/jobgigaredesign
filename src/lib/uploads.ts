import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Where uploaded files actually live: `public/uploads/<category>/<file>`.
// Next's own public-folder static handling serves most of these (same
// `/uploads/...` URL), but in production (`next start`) that only works for
// files that existed when the server booted — it scans public/ once at
// startup and never re-checks disk after. A fallback route handler at
// src/app/uploads/[...path]/route.ts catches everything uploaded after
// that, which in practice is every file a user uploads on the running app.
// See that route's comment for the full story. On the VPS this directory is
// a mounted Docker volume so files survive redeploys; in local dev it's
// just a folder on disk. Either way, files land in the same relative path.
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export type UploadCategory = "logos" | "avatars" | "office-photos" | "resumes" | "posters" | "banners";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function extensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? "bin";
}

// Writes raw bytes to disk under a category folder and returns the public
// URL path to reference it by (e.g. "/uploads/posters/<uuid>.png") — the
// single choke point every upload/write site goes through, so the DB never
// stores more than this short string.
export async function saveBufferUpload(buffer: Buffer, mimeType: string, category: UploadCategory): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, category);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${extensionForMime(mimeType)}`;
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/${category}/${fileName}`;
}

// Same, for callers that still have a `data:<mime>;base64,<data>` string
// (every existing "pick a file" flow in this app reads the file into one of
// these client-side and sends it as a plain JSON field) — decodes it once
// here and throws the base64 string away rather than ever persisting it.
export async function saveBase64Upload(dataUrl: string, category: UploadCategory): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Not a valid base64 data URL.");
  const [, mimeType, base64Data] = match;
  return saveBufferUpload(Buffer.from(base64Data, "base64"), mimeType, category);
}

// A company cover banner: whatever size/shape was picked, center-cropped to
// exactly 3:1 and saved as a light 1500x500 WebP — so every banner fits the
// same slots and a phone photo straight off the camera doesn't weigh 8 MB.
export async function saveBannerUpload(dataUrl: string): Promise<string> {
  const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Not a valid image.");
  const { default: sharp } = await import("sharp");
  const output = await sharp(Buffer.from(match[2], "base64"))
    .rotate() // honour phone photos' EXIF orientation
    .resize(1500, 500, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();
  return saveBufferUpload(output, "image/webp", "banners");
}

export function isBase64DataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

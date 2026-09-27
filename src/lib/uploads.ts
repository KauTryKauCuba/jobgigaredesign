import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Where uploaded files actually live: `public/uploads/<category>/<file>`,
// served automatically by Next's built-in static file handling (this app
// runs a plain `next start`, which reads `public/` from disk on every
// request — no custom serving route needed). On the VPS this directory is
// a mounted Docker volume so files survive redeploys; in local dev it's
// just a folder on disk. Either way, files land in the same relative path.
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export type UploadCategory = "logos" | "avatars" | "office-photos" | "resumes" | "posters";

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

export function isBase64DataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

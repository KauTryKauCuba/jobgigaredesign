import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Private storage for SSM certificates — outside public/ (same `storage/`
// volume as video pitches), so a document is only reachable through the
// permission-checked route at src/app/api/ssm-documents/[file], never as a
// public file. The DB stores that route's URL, so links keep working as-is.
const SSM_DOCUMENT_DIR = path.join(process.cwd(), "storage", "ssm-documents");
const URL_PREFIX = "/api/ssm-documents/";

export const SSM_DOCUMENT_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXTENSION_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(SSM_DOCUMENT_CONTENT_TYPES).map(([ext, mime]) => [mime, ext]),
);

/** "<uuid>.<ext>" — the only file names this storage ever holds. */
export function isSsmDocumentFileName(fileName: string) {
  return /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(fileName);
}

export function isSsmDocumentUrl(value: string) {
  return value.startsWith(URL_PREFIX) && isSsmDocumentFileName(value.slice(URL_PREFIX.length));
}

export function ssmDocumentUrl(fileName: string) {
  return `${URL_PREFIX}${fileName}`;
}

export function ssmDocumentFilePath(fileName: string) {
  return path.join(SSM_DOCUMENT_DIR, path.basename(fileName));
}

/** Saves a `data:` URL (PDF/JPG/PNG/WebP, already validated by the caller) and returns its protected URL. */
export async function saveSsmDocument(dataUrl: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  const ext = match ? EXTENSION_BY_MIME[match[1].toLowerCase()] : undefined;
  if (!match || !ext) throw new Error("Not a valid SSM document.");
  await mkdir(SSM_DOCUMENT_DIR, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await writeFile(path.join(SSM_DOCUMENT_DIR, fileName), Buffer.from(match[2], "base64"));
  return ssmDocumentUrl(fileName);
}

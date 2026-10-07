import { stat, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// A safety net under /uploads/*, the same URL Next's own public-folder
// static handling already serves. It exists because of a real gap in that
// handling: in production (`next start`, not `next dev`), Next scans the
// public/ folder ONCE at server boot and only ever serves files from that
// fixed list — see node_modules/next/dist/server/lib/router-utils/
// filesystem.js, the `opts.dev` branch that live-checks disk is dev-only.
// A file uploaded by a user while the server is already running (every
// company logo/banner/resume upload, on the running VPS) is invisible to
// that list and 404s, forever, until the next deploy restarts the process.
// `npm run dev` never reproduces this — it live-checks disk unconditionally.
//
// This route reads straight from disk on every request, so it always finds
// what's actually there. Next tries its public-folder match first; only
// when that misses (a file unknown to its startup scan) does the request
// fall through to this route, so this never duplicates work for files Next
// already serves correctly.
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Resolve against UPLOADS_ROOT and confirm the result is still inside it —
  // blocks "../../" traversal regardless of how the segments were encoded.
  const filePath = path.join(UPLOADS_ROOT, ...segments);
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file.");
    const bytes = await readFile(filePath);
    const contentType = CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        // Every filename is a randomUUID (see saveBufferUpload in
        // src/lib/uploads.ts) — never reused or overwritten in place — so
        // this is safe to cache hard, unlike the "public, max-age=0" Next's
        // own public-folder handling defaults to.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}

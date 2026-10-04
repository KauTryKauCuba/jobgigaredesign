import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { getSession } from "@/lib/session";
import { resolvePitchAccess, videoPitchFilePath } from "@/lib/video-pitch";

/**
 * Streams a video pitch to the jobseeker who owns it, or to an employer they
 * applied to. Supports HTTP Range requests — required for seeking, and for
 * iPhone/iPad Safari to play video at all.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Not signed in.", { status: 401 });

  const { id } = await params;
  const access = await resolvePitchAccess(id, session);
  if (!access.ok) return new Response("Not found.", { status: 404 });

  const filePath = videoPitchFilePath(access.pitch.fileName);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Not found.", { status: 404 });
  }

  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    // Private: never cached by shared proxies/CDNs.
    "Cache-Control": "private, max-age=3600",
  };

  const range = request.headers.get("range");
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      // "bytes=-500" = the last 500 bytes.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}

import "server-only";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { getAuthUser } from "./auth-user";
import { getEmployerMemberships } from "./employer-profile";
import { getSession } from "./session";
import { isSuperadminEmail } from "./superadmin";

/** Whether the signed-in user may see an unreviewed ad: its company's own team, or a superadmin. */
export async function canSeeUnreviewedAd(employerProfileId: string) {
  const [session, authUser] = await Promise.all([getSession(), getAuthUser()]);
  if (!session || !authUser) return false;
  if (isSuperadminEmail(authUser.email)) return true;
  const memberships = await getEmployerMemberships(session.userId);
  return memberships.some((m) => m.profile.id === employerProfileId);
}

/**
 * Streams an ad's image or video from private storage. Supports HTTP Range
 * requests — required for seeking, and for iPhone/iPad Safari to play video
 * at all. The URL carries the file name (?v=), so a replaced ad gets a new
 * URL — public (approved) media can be cached; anything unreviewed never is.
 */
export async function serveAdMedia(
  request: Request,
  file: { filePath: string; mediaType: "image" | "video"; isPublic: boolean },
) {
  let size: number;
  try {
    size = (await stat(file.filePath)).size;
  } catch {
    return new Response("Not found.", { status: 404 });
  }

  const headers = {
    "Content-Type": file.mediaType === "video" ? "video/mp4" : "image/webp",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": file.isPublic ? "public, max-age=86400" : "private, no-store",
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
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file.filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(file.filePath)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}

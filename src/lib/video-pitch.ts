import "server-only";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { mkdir, rm, stat } from "fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  employerProfiles,
  jobApplications,
  jobPostings,
  jobseekerProfiles,
  users,
  videoPitches,
  videoPitchViews,
} from "./db/schema";
import { getEmployerAccess } from "./employer-profile";
import { notify } from "./notifications";
import { isSuperadminEmail } from "./superadmin";
import { isUuid } from "./uuid";

import { SAMPLE_VIDEO_PITCH_FILE, VIDEO_PITCH_DIR, videoPitchFilePath } from "./video-pitch-storage";

export { VIDEO_PITCH_DIR, videoPitchFilePath };

export const MAX_PITCH_SECONDS = 60;
// A little slack over 60s for recorder/encoder rounding.
const MAX_INPUT_SECONDS = 65;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * The ffmpeg binary to run. On the server, FFMPEG_BIN points at the system
 * ffmpeg the Docker image installs (apk) — so the build never depends on
 * ffmpeg-static's download from github.com. Locally, ffmpeg-static (an
 * optional dependency) provides it; loaded lazily so a missing package
 * can't break this module.
 */
async function resolveFfmpegPath(): Promise<string | null> {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  try {
    const mod = await import("ffmpeg-static");
    return (mod.default as unknown as string | null) ?? null;
  } catch {
    return null;
  }
}

async function runFfmpeg(args: string[]): Promise<{ stderr: string }> {
  const ffmpegPath = await resolveFfmpegPath();
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this server."));
    execFile(ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve({ stderr });
    });
  });
}

function parseDurationSeconds(ffmpegOutput: string): number | null {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(ffmpegOutput);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/**
 * Converts any recorded/uploaded video (WebM from Chrome/Android, MP4/MOV
 * from iPhone, large camera-app files) into one small format that plays on
 * every device: H.264/AAC MP4, shorter side 480px, ~1 Mbps, max 60s, with
 * the index up front so playback starts before the whole file downloads.
 */
export async function transcodeVideoPitch(
  inputPath: string,
): Promise<{ ok: true; fileName: string; durationSeconds: number; sizeBytes: number } | { ok: false; error: string }> {
  // Probe first: ffmpeg with no output prints the input's details and exits
  // non-zero, which is expected here.
  let probeOutput = "";
  try {
    await runFfmpeg(["-hide_banner", "-i", inputPath]);
  } catch (err) {
    probeOutput = (err as { stderr?: string }).stderr ?? "";
  }
  const inputDuration = parseDurationSeconds(probeOutput);
  if (!/Stream #\d+:\d+.*Video:/.test(probeOutput)) {
    return { ok: false, error: "That file doesn't look like a video we can read. Try recording again." };
  }
  if (inputDuration !== null && inputDuration > MAX_INPUT_SECONDS) {
    return { ok: false, error: `Your video is longer than ${MAX_PITCH_SECONDS} seconds. Please keep it to one minute.` };
  }

  await mkdir(VIDEO_PITCH_DIR, { recursive: true });
  const fileName = `${randomUUID()}.mp4`;
  const outputPath = videoPitchFilePath(fileName);
  try {
    await runFfmpeg([
      "-hide_banner",
      "-y",
      "-i",
      inputPath,
      "-t",
      String(MAX_PITCH_SECONDS),
      // Shorter side to 480px (portrait phone videos stay portrait), even dimensions.
      "-vf",
      "scale='if(gt(iw,ih),-2,480)':'if(gt(iw,ih),480,-2)',setsar=1",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-maxrate",
      "1M",
      "-bufsize",
      "2M",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-ac",
      "1",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  } catch (err) {
    await rm(outputPath, { force: true });
    console.error("Video pitch transcode failed", (err as { stderr?: string }).stderr ?? err);
    return { ok: false, error: "We couldn't process that video. Try recording again." };
  }

  const { size } = await stat(outputPath);
  const durationSeconds = Math.max(1, Math.round(Math.min(inputDuration ?? MAX_PITCH_SECONDS, MAX_PITCH_SECONDS)));
  return { ok: true, fileName, durationSeconds, sizeBytes: size };
}

export async function deleteVideoPitchFile(fileName: string) {
  // The dummy-data sample clip is shared by many pitches — never removed.
  if (fileName === SAMPLE_VIDEO_PITCH_FILE) return;
  await rm(videoPitchFilePath(fileName), { force: true });
}

export async function getVideoPitchForProfile(jobseekerProfileId: string) {
  const [pitch] = await db
    .select()
    .from(videoPitches)
    .where(eq(videoPitches.jobseekerProfileId, jobseekerProfileId))
    .limit(1);
  if (!pitch) return null;
  const views = await db
    .select({ id: videoPitchViews.id })
    .from(videoPitchViews)
    .where(eq(videoPitchViews.videoPitchId, pitch.id));
  return { ...pitch, watchedByCount: views.length };
}

export type EmployerPitchSummary = {
  id: string;
  durationSeconds: number;
  intro: string | null;
  strengths: string[];
  watchedByMyCompany: boolean;
};

/**
 * Visible pitches for a set of jobseekers, as one employer company sees
 * them (incl. whether that company has already watched each) — keyed by
 * jobseeker profile id. Hidden pitches are left out entirely.
 */
export async function getPitchSummariesForEmployer(
  employerProfileId: string,
  jobseekerProfileIds: string[],
): Promise<Map<string, EmployerPitchSummary>> {
  const result = new Map<string, EmployerPitchSummary>();
  const ids = [...new Set(jobseekerProfileIds)];
  if (ids.length === 0) return result;
  const pitches = await db
    .select()
    .from(videoPitches)
    .where(and(inArray(videoPitches.jobseekerProfileId, ids), eq(videoPitches.visible, true)));
  if (pitches.length === 0) return result;
  const watched = await db
    .select({ videoPitchId: videoPitchViews.videoPitchId })
    .from(videoPitchViews)
    .where(
      and(
        inArray(
          videoPitchViews.videoPitchId,
          pitches.map((p) => p.id),
        ),
        eq(videoPitchViews.employerProfileId, employerProfileId),
      ),
    );
  const watchedIds = new Set(watched.map((w) => w.videoPitchId));
  for (const p of pitches) {
    result.set(p.jobseekerProfileId, {
      id: p.id,
      durationSeconds: p.durationSeconds,
      intro: p.intro,
      strengths: p.strengths,
      watchedByMyCompany: watchedIds.has(p.id),
    });
  }
  return result;
}

type PitchAccess =
  | { ok: true; pitch: typeof videoPitches.$inferSelect; viewer: "owner" }
  | { ok: true; pitch: typeof videoPitches.$inferSelect; viewer: "employer"; employerProfileId: string }
  | { ok: true; pitch: typeof videoPitches.$inferSelect; viewer: "superadmin" }
  | { ok: false };

/**
 * Who may watch a pitch: the jobseeker who owns it, or an employer (signed
 * in as their current company) that this jobseeker has applied to. Hidden
 * pitches are owner-only. Superadmins may also watch any pitch, for
 * moderation — but only as a fallback, so it never counts as an employer
 * "watch" and never notifies the jobseeker.
 */
export async function resolvePitchAccess(
  pitchId: string,
  session: { userId: string; role: "employer" | "jobseeker" },
): Promise<PitchAccess> {
  // A malformed id would otherwise make Postgres throw on the uuid cast (a 500).
  if (!isUuid(pitchId)) return { ok: false };
  const access = await resolveRegularPitchAccess(pitchId, session);
  if (access.ok) return access;

  const [viewer] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (!isSuperadminEmail(viewer?.email)) return { ok: false };
  const [pitch] = await db.select().from(videoPitches).where(eq(videoPitches.id, pitchId)).limit(1);
  return pitch ? { ok: true, pitch, viewer: "superadmin" } : { ok: false };
}

async function resolveRegularPitchAccess(
  pitchId: string,
  session: { userId: string; role: "employer" | "jobseeker" },
): Promise<PitchAccess> {
  const [row] = await db
    .select({ pitch: videoPitches, ownerUserId: jobseekerProfiles.userId })
    .from(videoPitches)
    .innerJoin(jobseekerProfiles, eq(videoPitches.jobseekerProfileId, jobseekerProfiles.id))
    .where(eq(videoPitches.id, pitchId))
    .limit(1);
  if (!row) return { ok: false };

  if (session.role === "jobseeker") {
    return row.ownerUserId === session.userId ? { ok: true, pitch: row.pitch, viewer: "owner" } : { ok: false };
  }

  if (!row.pitch.visible) return { ok: false };
  const access = await getEmployerAccess(session.userId);
  if (!access) return { ok: false };
  const [applied] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .where(
      and(
        eq(jobApplications.jobseekerProfileId, row.pitch.jobseekerProfileId),
        eq(jobPostings.employerProfileId, access.profile.id),
      ),
    )
    .limit(1);
  if (!applied) return { ok: false };
  return { ok: true, pitch: row.pitch, viewer: "employer", employerProfileId: access.profile.id };
}

/**
 * An employer company watched a pitch. Only the first watch per company
 * counts — that's when the jobseeker gets their notification.
 */
export async function recordPitchView(params: {
  pitch: typeof videoPitches.$inferSelect;
  employerProfileId: string;
  viewerUserId: string;
}) {
  const inserted = await db
    .insert(videoPitchViews)
    .values({
      videoPitchId: params.pitch.id,
      employerProfileId: params.employerProfileId,
      viewerUserId: params.viewerUserId,
    })
    .onConflictDoNothing()
    .returning({ id: videoPitchViews.id });
  if (inserted.length === 0) return;

  const [owner] = await db
    .select({ userId: jobseekerProfiles.userId, companyName: employerProfiles.companyName })
    .from(jobseekerProfiles)
    .innerJoin(employerProfiles, eq(employerProfiles.id, params.employerProfileId))
    .where(eq(jobseekerProfiles.id, params.pitch.jobseekerProfileId))
    .limit(1);
  if (!owner) return;
  await notify([owner.userId], "jobseeker", {
    type: "video_pitch_watched",
    title: `${owner.companyName} watched your video pitch`,
    body: "Employers you apply to can see it. Keep it fresh — you can re-record anytime.",
    link: "/jobseeker/profile#video-pitch",
  });
}

import "server-only";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { isUuid } from "./uuid";

// AI interview recordings live under storage/ai-interviews/<interview id>/ —
// the private volume (never public/), served only through authenticated
// routes. Entirely separate from video pitches.
export const AI_INTERVIEW_DIR = path.join(process.cwd(), "storage", "ai-interviews");

const FILE_NAME = /^[0-9a-f-]{36}\.(mp4|m4a)$/;

export function aiInterviewMediaPath(interviewId: string, fileName: string): string | null {
  if (!isUuid(interviewId) || !FILE_NAME.test(fileName)) return null;
  return path.join(AI_INTERVIEW_DIR, interviewId, fileName);
}

export async function deleteAiInterviewMedia(interviewId: string) {
  if (!isUuid(interviewId)) return;
  await rm(path.join(AI_INTERVIEW_DIR, interviewId), { recursive: true, force: true });
}

export async function deleteAiInterviewFile(interviewId: string, fileName: string | null) {
  if (!fileName) return;
  const filePath = aiInterviewMediaPath(interviewId, fileName);
  if (filePath) await rm(filePath, { force: true });
}

// FFMPEG_BIN is the system ffmpeg the Docker image installs; locally the
// ffmpeg-static package provides one (loaded lazily so a missing package
// can't break this module).
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
    // The binary path is only ever our own ffmpeg, never user input — so it
    // needn't make the build trace the whole project.
    execFile(/*turbopackIgnore: true*/ ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
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

// Probe: ffmpeg with no output prints the input's details and exits non-zero,
// which is expected here.
async function probe(inputPath: string) {
  let output = "";
  try {
    await runFfmpeg(["-hide_banner", "-i", inputPath]);
  } catch (err) {
    output = (err as { stderr?: string }).stderr ?? "";
  }
  return {
    durationSeconds: parseDurationSeconds(output),
    hasAudio: /Stream #\d+:\d+.*Audio:/.test(output),
    hasVideo: /Stream #\d+:\d+.*Video:/.test(output),
  };
}

export type SavedAnswerMedia = {
  fileName: string;
  kind: "video" | "audio";
  durationSeconds: number;
};

/**
 * Turns what the browser recorded (webm or mp4, Opus or AAC) into something
 * every employer's browser can play — H.264/AAC MP4 for video, AAC for
 * audio — capped at the answer's time limit, and saves it for this interview.
 */
export async function saveAnswerMedia(params: {
  interviewId: string;
  buffer: Buffer;
  wantsVideo: boolean;
  maxSeconds: number;
}): Promise<{ ok: true; media: SavedAnswerMedia } | { ok: false; error: string }> {
  const { interviewId, buffer, wantsVideo, maxSeconds } = params;
  const tempPath = path.join(os.tmpdir(), `aiv-${randomUUID()}`);
  try {
    await writeFile(tempPath, buffer);
    const info = await probe(tempPath);
    if (!info.hasAudio) return { ok: false, error: "We couldn't hear any sound in that recording. Try again." };
    // A little slack for recorder/encoder rounding.
    if (info.durationSeconds !== null && info.durationSeconds > maxSeconds + 5) {
      return { ok: false, error: `That answer is longer than ${maxSeconds} seconds. Record a shorter one.` };
    }
    const kind: "video" | "audio" = wantsVideo && info.hasVideo ? "video" : "audio";

    const dir = path.join(AI_INTERVIEW_DIR, interviewId);
    await mkdir(dir, { recursive: true });
    const fileName = `${randomUUID()}.${kind === "video" ? "mp4" : "m4a"}`;
    const outputPath = path.join(dir, fileName);
    const limit = String(maxSeconds + 1);
    try {
      await runFfmpeg(
        kind === "video"
          ? [
              "-hide_banner", "-y", "-i", tempPath, "-t", limit,
              "-vf", "scale='if(gt(iw,ih),-2,480)':'if(gt(iw,ih),480,-2)',setsar=1",
              "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-maxrate", "900k", "-bufsize", "1800k",
              "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart",
              outputPath,
            ]
          : ["-hide_banner", "-y", "-i", tempPath, "-t", limit, "-vn", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", outputPath],
      );
    } catch (err) {
      await rm(outputPath, { force: true });
      console.error("AI interview transcode failed", (err as { stderr?: string }).stderr ?? err);
      return { ok: false, error: "We couldn't process that recording. Try again." };
    }
    const durationSeconds = Math.max(1, Math.round(Math.min(info.durationSeconds ?? maxSeconds, maxSeconds)));
    return { ok: true, media: { fileName, kind, durationSeconds } };
  } finally {
    await rm(tempPath, { force: true });
  }
}

/** A 16 kHz mono WAV of a stored answer — the plain format MiMo's speech-to-text accepts. */
export async function extractWavForSpeechToText(interviewId: string, fileName: string): Promise<Buffer | null> {
  const source = aiInterviewMediaPath(interviewId, fileName);
  if (!source) return null;
  const tempPath = path.join(os.tmpdir(), `aiv-${randomUUID()}.wav`);
  try {
    await runFfmpeg(["-hide_banner", "-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", tempPath]);
    return await readFile(tempPath);
  } catch (err) {
    console.error("AI interview audio extraction failed", (err as { stderr?: string }).stderr ?? err);
    return null;
  } finally {
    await rm(tempPath, { force: true });
  }
}

export async function aiInterviewFileSize(interviewId: string, fileName: string): Promise<number | null> {
  const filePath = aiInterviewMediaPath(interviewId, fileName);
  if (!filePath) return null;
  try {
    return (await stat(filePath)).size;
  } catch {
    return null;
  }
}

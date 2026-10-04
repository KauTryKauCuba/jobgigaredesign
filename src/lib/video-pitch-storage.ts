// Plain filesystem helpers for video pitch files — no `server-only` or db
// imports, so the standalone seed script (scripts/seed.ts) can use them too.
import { copyFile, mkdir, stat } from "fs/promises";
import path from "path";

// Private storage — outside public/, so a video is only ever reachable
// through the permission-checked stream route, never as a guessable URL.
export const VIDEO_PITCH_DIR = path.join(process.cwd(), "storage", "video-pitches");

// One generated clip (assets/sample-video-pitch.mp4, 20s, captions only — no
// real person) shared by every dummy/seeded jobseeker with a pitch. Never
// deleted when a pitch row goes, since other dummy pitches point at it too.
export const SAMPLE_VIDEO_PITCH_FILE = "sample-video-pitch.mp4";
export const SAMPLE_VIDEO_PITCH_SECONDS = 20;
const SAMPLE_VIDEO_PITCH_SOURCE = path.join(process.cwd(), "assets", SAMPLE_VIDEO_PITCH_FILE);

export function videoPitchFilePath(fileName: string) {
  // fileName is always our own "<uuid>.mp4" (or the sample) — basename() guards anyway.
  return path.join(VIDEO_PITCH_DIR, path.basename(fileName));
}

/**
 * Copies the sample clip into private storage (once) and returns what a
 * video_pitches row needs to point at it.
 */
export async function installSampleVideoPitch() {
  await mkdir(VIDEO_PITCH_DIR, { recursive: true });
  const target = videoPitchFilePath(SAMPLE_VIDEO_PITCH_FILE);
  const existing = await stat(target).catch(() => null);
  if (!existing) await copyFile(SAMPLE_VIDEO_PITCH_SOURCE, target);
  const { size } = await stat(target);
  return { fileName: SAMPLE_VIDEO_PITCH_FILE, durationSeconds: SAMPLE_VIDEO_PITCH_SECONDS, sizeBytes: size };
}

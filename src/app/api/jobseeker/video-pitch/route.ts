import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobseekerProfiles, videoPitches, videoPitchViews } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  MAX_UPLOAD_BYTES,
  deleteVideoPitchFile,
  getVideoPitchForProfile,
  transcodeVideoPitch,
} from "@/lib/video-pitch";

const MAX_INTRO_LENGTH = 150;
const MAX_STRENGTHS = 3;

async function requireJobseekerProfile() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") return null;
  const [profile] = await db
    .select({
      id: jobseekerProfiles.id,
      professionalSkills: jobseekerProfiles.professionalSkills,
      softSkills: jobseekerProfiles.softSkills,
      otherSkills: jobseekerProfiles.otherSkills,
    })
    .from(jobseekerProfiles)
    .where(eq(jobseekerProfiles.userId, session.userId))
    .limit(1);
  return profile ?? null;
}

export async function GET() {
  const profile = await requireJobseekerProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  return NextResponse.json({ pitch: await getVideoPitchForProfile(profile.id) });
}

// Upload a new pitch (multipart field "video") — replaces any existing one,
// and resets who's watched it, since it's a new video.
export async function POST(request: Request) {
  const profile = await requireJobseekerProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("video");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "No video received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That video is too large (max 100 MB). Try a shorter clip." }, { status: 413 });
  }

  // ffmpeg needs a real file to read — staged in the OS temp dir, always cleaned up.
  const tempPath = path.join(os.tmpdir(), `pitch-${randomUUID()}`);
  try {
    await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
    const result = await transcodeVideoPitch(tempPath);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const existing = await getVideoPitchForProfile(profile.id);
    if (existing) {
      await db
        .update(videoPitches)
        .set({
          fileName: result.fileName,
          durationSeconds: result.durationSeconds,
          sizeBytes: result.sizeBytes,
          updatedAt: new Date(),
        })
        .where(eq(videoPitches.id, existing.id));
      await db.delete(videoPitchViews).where(eq(videoPitchViews.videoPitchId, existing.id));
      await deleteVideoPitchFile(existing.fileName);
    } else {
      await db.insert(videoPitches).values({
        jobseekerProfileId: profile.id,
        fileName: result.fileName,
        durationSeconds: result.durationSeconds,
        sizeBytes: result.sizeBytes,
      });
    }
    return NextResponse.json({ pitch: await getVideoPitchForProfile(profile.id) });
  } finally {
    await rm(tempPath, { force: true });
  }
}

// Update the skimmable details or visibility: { intro?, strengths?, visible? }.
export async function PATCH(request: Request) {
  const profile = await requireJobseekerProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  const existing = await getVideoPitchForProfile(profile.id);
  if (!existing) return NextResponse.json({ error: "Record a video pitch first." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { intro, strengths, visible } = (body ?? {}) as Record<string, unknown>;
  const changes: Partial<typeof videoPitches.$inferInsert> = {};

  if (intro !== undefined) {
    if (intro !== null && typeof intro !== "string") {
      return NextResponse.json({ error: "Invalid intro." }, { status: 400 });
    }
    const trimmed = (intro ?? "").trim();
    if (trimmed.length > MAX_INTRO_LENGTH) {
      return NextResponse.json({ error: `Keep your intro under ${MAX_INTRO_LENGTH} characters.` }, { status: 400 });
    }
    changes.intro = trimmed || null;
  }
  if (strengths !== undefined) {
    // Strengths are picked from the jobseeker's own profile skills — never
    // free text. Ones no longer on the profile (skill since removed) are
    // dropped rather than failing the whole save.
    const allowed = new Set([...profile.professionalSkills, ...profile.softSkills, ...profile.otherSkills]);
    if (
      !Array.isArray(strengths) ||
      strengths.length > MAX_STRENGTHS ||
      !strengths.every((s) => typeof s === "string")
    ) {
      return NextResponse.json({ error: `Pick up to ${MAX_STRENGTHS} strengths from your skills.` }, { status: 400 });
    }
    changes.strengths = [...new Set((strengths as string[]).filter((s) => allowed.has(s)))];
  }
  if (visible !== undefined) {
    if (typeof visible !== "boolean") return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
    changes.visible = visible;
  }
  if (Object.keys(changes).length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  await db
    .update(videoPitches)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(videoPitches.id, existing.id));
  return NextResponse.json({ pitch: await getVideoPitchForProfile(profile.id) });
}

// Delete the pitch entirely — the file is removed from disk, not just hidden.
export async function DELETE() {
  const profile = await requireJobseekerProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  const existing = await getVideoPitchForProfile(profile.id);
  if (!existing) return NextResponse.json({ ok: true });
  await db.delete(videoPitches).where(eq(videoPitches.id, existing.id));
  await deleteVideoPitchFile(existing.fileName);
  return NextResponse.json({ ok: true });
}

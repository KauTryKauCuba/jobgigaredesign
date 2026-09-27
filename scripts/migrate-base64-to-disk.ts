// One-time backfill: every column that used to store images/files as
// base64 data URLs directly in Postgres (see src/lib/uploads.ts for the new
// write path) gets its existing `data:...;base64,...` rows converted to
// real files on disk, with the column updated to the short `/uploads/...`
// URL. Safe to re-run — rows that don't start with "data:" (already
// migrated, or never set) are skipped.
//
// Run with: node --env-file=.env.local node_modules/.bin/tsx scripts/migrate-base64-to-disk.ts
// On the VPS, run inside the app container so it writes into the same
// mounted uploads volume the running app serves from:
//   docker compose exec app npx tsx scripts/migrate-base64-to-disk.ts
//
// Does not use `@/lib/db` or `@/lib/uploads` — both import `server-only`,
// which only resolves inside Next's build (same reason clear-db.ts/seed.ts
// talk to Postgres directly via `pg`/drizzle instead).
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like } from "drizzle-orm";
import { employerProfiles, jobPostingPosters, jobPostings, jobseekerProfiles } from "../src/lib/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

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

async function saveBase64ToDisk(dataUrl: string, category: string): Promise<string | null> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  const extension = EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? "bin";
  const dir = path.join(UPLOADS_ROOT, category);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  await writeFile(path.join(dir, fileName), Buffer.from(base64Data, "base64"));
  return `/uploads/${category}/${fileName}`;
}

async function migrateEmployerAvatarUrl(): Promise<number> {
  const rows = await db
    .select({ id: employerProfiles.id, value: employerProfiles.avatarUrl })
    .from(employerProfiles)
    .where(like(employerProfiles.avatarUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "avatars");
    if (!newUrl) continue;
    await db.update(employerProfiles).set({ avatarUrl: newUrl }).where(eq(employerProfiles.id, row.id));
    count++;
  }
  return count;
}

async function migrateEmployerLogoUrl(): Promise<number> {
  const rows = await db
    .select({ id: employerProfiles.id, value: employerProfiles.logoUrl })
    .from(employerProfiles)
    .where(like(employerProfiles.logoUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "logos");
    if (!newUrl) continue;
    await db.update(employerProfiles).set({ logoUrl: newUrl }).where(eq(employerProfiles.id, row.id));
    count++;
  }
  return count;
}

async function migrateEmployerOfficePhotoUrl(): Promise<number> {
  const rows = await db
    .select({ id: employerProfiles.id, value: employerProfiles.officePhotoUrl })
    .from(employerProfiles)
    .where(like(employerProfiles.officePhotoUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "office-photos");
    if (!newUrl) continue;
    await db.update(employerProfiles).set({ officePhotoUrl: newUrl }).where(eq(employerProfiles.id, row.id));
    count++;
  }
  return count;
}

async function migrateJobseekerAvatarUrl(): Promise<number> {
  const rows = await db
    .select({ id: jobseekerProfiles.id, value: jobseekerProfiles.avatarUrl })
    .from(jobseekerProfiles)
    .where(like(jobseekerProfiles.avatarUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "avatars");
    if (!newUrl) continue;
    await db.update(jobseekerProfiles).set({ avatarUrl: newUrl }).where(eq(jobseekerProfiles.id, row.id));
    count++;
  }
  return count;
}

async function migrateJobseekerResumeUrl(): Promise<number> {
  const rows = await db
    .select({ id: jobseekerProfiles.id, value: jobseekerProfiles.resumeUrl })
    .from(jobseekerProfiles)
    .where(like(jobseekerProfiles.resumeUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "resumes");
    if (!newUrl) continue;
    await db.update(jobseekerProfiles).set({ resumeUrl: newUrl }).where(eq(jobseekerProfiles.id, row.id));
    count++;
  }
  return count;
}

async function migrateJobPostingPosterUrl(): Promise<number> {
  const rows = await db
    .select({ id: jobPostings.id, value: jobPostings.posterUrl })
    .from(jobPostings)
    .where(like(jobPostings.posterUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value!, "posters");
    if (!newUrl) continue;
    await db.update(jobPostings).set({ posterUrl: newUrl }).where(eq(jobPostings.id, row.id));
    count++;
  }
  return count;
}

async function migrateJobPostingPostersHistoryUrl(): Promise<number> {
  const rows = await db
    .select({ id: jobPostingPosters.id, value: jobPostingPosters.posterUrl })
    .from(jobPostingPosters)
    .where(like(jobPostingPosters.posterUrl, "data:%"));
  let count = 0;
  for (const row of rows) {
    const newUrl = await saveBase64ToDisk(row.value, "posters");
    if (!newUrl) continue;
    await db.update(jobPostingPosters).set({ posterUrl: newUrl }).where(eq(jobPostingPosters.id, row.id));
    count++;
  }
  return count;
}

async function main() {
  const results: [string, number][] = [
    ["employerProfiles.avatarUrl", await migrateEmployerAvatarUrl()],
    ["employerProfiles.logoUrl", await migrateEmployerLogoUrl()],
    ["employerProfiles.officePhotoUrl", await migrateEmployerOfficePhotoUrl()],
    ["jobseekerProfiles.avatarUrl", await migrateJobseekerAvatarUrl()],
    ["jobseekerProfiles.resumeUrl", await migrateJobseekerResumeUrl()],
    ["jobPostings.posterUrl", await migrateJobPostingPosterUrl()],
    ["jobPostingPosters.posterUrl", await migrateJobPostingPostersHistoryUrl()],
  ];

  console.log("Migrated rows:");
  for (const [label, count] of results) console.log(`  ${label}: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());

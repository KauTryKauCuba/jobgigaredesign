import "server-only";
import { rm } from "fs/promises";
import path from "path";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { siteSettings } from "./db/schema";
import { saveBufferUpload } from "./uploads";

// The landing pages' welcome popup image (see WelcomeModal) — one per page.
// The superadmin can replace either from their dashboard; with none set, the
// built-in picture in public/welcome/ is shown.
export const WELCOME_ROLES = ["employer", "jobseeker"] as const;
export type WelcomeRole = (typeof WELCOME_ROLES)[number];

export const DEFAULT_WELCOME_IMAGES: Record<WelcomeRole, string> = {
  employer: "/welcome/employer.svg",
  jobseeker: "/welcome/jobseeker.svg",
};

export const WELCOME_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// Stored square (the popup is 1:1) at twice its largest on-screen size.
const WELCOME_IMAGE_SIZE = 1200;

const settingKey = (role: WelcomeRole) => `welcome_image.${role}`;
type StoredImage = { url: string };

export type WelcomeImage = { url: string; custom: boolean; updatedAt: string | null };

export async function getWelcomeImages(): Promise<Record<WelcomeRole, WelcomeImage>> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(inArray(siteSettings.key, WELCOME_ROLES.map(settingKey)));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const image = (role: WelcomeRole): WelcomeImage => {
    const row = byKey.get(settingKey(role));
    const url = (row?.value as StoredImage | undefined)?.url;
    return url
      ? { url, custom: true, updatedAt: row!.updatedAt.toISOString() }
      : { url: DEFAULT_WELCOME_IMAGES[role], custom: false, updatedAt: null };
  };
  return { employer: image("employer"), jobseeker: image("jobseeker") };
}

export async function getWelcomeImageUrl(role: WelcomeRole): Promise<string> {
  return (await getWelcomeImages())[role].url;
}

// Only ever our own /uploads/welcome/<uuid>.webp — the path is rebuilt from
// the file name alone, so a stored value can't point a delete anywhere else.
async function deleteWelcomeFile(url: string | undefined) {
  const match = url?.match(/^\/uploads\/welcome\/([\w-]+\.webp)$/);
  if (!match) return;
  await rm(path.join(process.cwd(), "public", "uploads", "welcome", match[1]), { force: true });
}

async function storedUrl(role: WelcomeRole) {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, settingKey(role))).limit(1);
  return (row?.value as StoredImage | undefined)?.url;
}

/** Any image → an upright, centre-cropped square WebP, saved as this page's welcome image. */
export async function setWelcomeImage(role: WelcomeRole, bytes: Buffer, userId: string): Promise<string> {
  const { default: sharp } = await import("sharp");
  const output = await sharp(bytes)
    .rotate()
    .resize(WELCOME_IMAGE_SIZE, WELCOME_IMAGE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
  const url = await saveBufferUpload(output, "image/webp", "welcome");
  const previous = await storedUrl(role);
  const value: StoredImage = { url };
  await db
    .insert(siteSettings)
    .values({ key: settingKey(role), value, updatedByUserId: userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedByUserId: userId, updatedAt: new Date() },
    });
  if (previous !== url) await deleteWelcomeFile(previous);
  return url;
}

/** Back to the built-in picture. */
export async function resetWelcomeImage(role: WelcomeRole) {
  const previous = await storedUrl(role);
  await db.delete(siteSettings).where(eq(siteSettings.key, settingKey(role)));
  await deleteWelcomeFile(previous);
}

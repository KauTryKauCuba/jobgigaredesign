import "server-only";
import { rm } from "fs/promises";
import path from "path";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "./db";
import { siteThemes } from "./db/schema";
import { saveBufferUpload } from "./uploads";
import { isUuid } from "./uuid";
import {
  DEFAULT_THEME_COLORS,
  EMPTY_BANNER,
  findPreset,
  type SiteTheme,
  type ThemeAudience,
  type ThemeInput,
} from "./site-themes-shared";

export const THEME_PREVIEW_COOKIE = "jg_theme_preview";
// Holds "<theme id>:<updated ms>" — the banner stays hidden until that theme changes.
export const bannerDismissCookie = (audience: ThemeAudience) => `jg_theme_banner_${audience}`;
export const THEME_BANNER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BANNER_IMAGE_SIZE = 160;

type Row = typeof siteThemes.$inferSelect;

function toTheme(row: Row): SiteTheme {
  return {
    id: row.id,
    audience: row.audience,
    name: row.name,
    presetKey: row.presetKey,
    colors: row.colors,
    banner: { ...EMPTY_BANNER, ...row.banner },
    effect: row.effect,
    effectScope: row.effectScope,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listThemes(): Promise<SiteTheme[]> {
  const rows = await db.select().from(siteThemes).orderBy(desc(siteThemes.isActive), asc(siteThemes.createdAt));
  return rows.map(toTheme);
}

export async function getTheme(id: string): Promise<SiteTheme | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(siteThemes).where(eq(siteThemes.id, id)).limit(1);
  return row ? toTheme(row) : null;
}

async function getActiveTheme(audience: ThemeAudience): Promise<SiteTheme | null> {
  const [row] = await db
    .select()
    .from(siteThemes)
    .where(and(eq(siteThemes.audience, audience), eq(siteThemes.isActive, true)))
    .limit(1);
  return row ? toTheme(row) : null;
}

/**
 * What one side of the site should show right now: a superadmin's preview
 * (only honoured for a superadmin — checked by the caller passing
 * `canPreview`), else the live theme, else null for the default design.
 */
export async function resolveSiteTheme(
  audience: ThemeAudience,
  canPreview: () => Promise<boolean>,
): Promise<{ theme: SiteTheme; preview: boolean; bannerDismissed: boolean } | null> {
  const store = await cookies();
  const previewId = store.get(THEME_PREVIEW_COOKIE)?.value;
  let theme: SiteTheme | null = null;
  let preview = false;
  if (previewId && isUuid(previewId) && (await canPreview())) {
    const candidate = await getTheme(previewId);
    if (candidate?.audience === audience) {
      theme = candidate;
      preview = true;
    }
  }
  theme ??= await getActiveTheme(audience);
  if (!theme) return null;
  const dismissed = store.get(bannerDismissCookie(audience))?.value === bannerVersion(theme);
  return { theme, preview, bannerDismissed: dismissed && !preview };
}

export const bannerVersion = (theme: Pick<SiteTheme, "id" | "updatedAt">) =>
  `${theme.id}:${new Date(theme.updatedAt).getTime()}`;

/** A new, switched-off theme: from a ready-made preset, or the default design. */
export async function createTheme(audience: ThemeAudience, presetKey: string | null, userId: string): Promise<SiteTheme> {
  const preset = findPreset(presetKey);
  const [row] = await db
    .insert(siteThemes)
    .values({
      audience,
      name: preset ? preset.name : "My theme",
      presetKey: preset?.key ?? null,
      colors: preset ? preset.colors[audience] : DEFAULT_THEME_COLORS[audience],
      banner: preset
        ? { ...EMPTY_BANNER, enabled: true, emoji: preset.emoji, text: preset.bannerText[audience] }
        : EMPTY_BANNER,
      effect: preset?.effect ?? "none",
      effectScope: "landing",
      createdByUserId: userId,
    })
    .returning();
  return toTheme(row);
}

export async function updateTheme(id: string, input: ThemeInput): Promise<SiteTheme | null> {
  const existing = await getTheme(id);
  if (!existing) return null;
  const [row] = await db
    .update(siteThemes)
    .set({
      name: input.name,
      colors: input.colors,
      banner: { ...input.banner, imageUrl: existing.banner.imageUrl },
      effect: input.effect,
      effectScope: input.effectScope,
      updatedAt: new Date(),
    })
    .where(eq(siteThemes.id, id))
    .returning();
  return row ? toTheme(row) : null;
}

/** Turning one on turns the side's other live theme off, in one transaction. */
export async function setThemeActive(id: string, active: boolean): Promise<SiteTheme | null> {
  const theme = await getTheme(id);
  if (!theme) return null;
  await db.transaction(async (tx) => {
    if (active) {
      await tx
        .update(siteThemes)
        .set({ isActive: false })
        .where(and(eq(siteThemes.audience, theme.audience), eq(siteThemes.isActive, true), ne(siteThemes.id, id)));
    }
    await tx.update(siteThemes).set({ isActive: active }).where(eq(siteThemes.id, id));
  });
  return getTheme(id);
}

// Only ever our own /uploads/themes/<uuid>.webp — rebuilt from the file name
// alone, so a stored value can't point a delete anywhere else.
async function deleteBannerFile(url: string | null | undefined) {
  const match = url?.match(/^\/uploads\/themes\/([\w-]+\.webp)$/);
  if (!match) return;
  await rm(path.join(process.cwd(), "public", "uploads", "themes", match[1]), { force: true });
}

export async function deleteTheme(id: string): Promise<boolean> {
  const theme = await getTheme(id);
  if (!theme) return false;
  await db.delete(siteThemes).where(eq(siteThemes.id, id));
  await deleteBannerFile(theme.banner.imageUrl);
  return true;
}

/** Any image → a small square WebP (transparent corners kept) beside the banner text. */
export async function setThemeBannerImage(id: string, bytes: Buffer): Promise<SiteTheme | null> {
  const theme = await getTheme(id);
  if (!theme) return null;
  const { default: sharp } = await import("sharp");
  const output = await sharp(bytes)
    .rotate()
    .resize(BANNER_IMAGE_SIZE, BANNER_IMAGE_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88 })
    .toBuffer();
  const url = await saveBufferUpload(output, "image/webp", "themes");
  const [row] = await db
    .update(siteThemes)
    .set({ banner: { ...theme.banner, imageUrl: url }, updatedAt: new Date() })
    .where(eq(siteThemes.id, id))
    .returning();
  await deleteBannerFile(theme.banner.imageUrl);
  return row ? toTheme(row) : null;
}

export async function removeThemeBannerImage(id: string): Promise<SiteTheme | null> {
  const theme = await getTheme(id);
  if (!theme) return null;
  const [row] = await db
    .update(siteThemes)
    .set({ banner: { ...theme.banner, imageUrl: null }, updatedAt: new Date() })
    .where(eq(siteThemes.id, id))
    .returning();
  await deleteBannerFile(theme.banner.imageUrl);
  return row ? toTheme(row) : null;
}

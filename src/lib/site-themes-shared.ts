// Site themes — a superadmin-made look (colours, a banner, an effect) for
// one side of the site. Client-safe: the superadmin editor, the theme layer
// and the API all share these types, presets and checks.

export const THEME_AUDIENCES = ["employer", "jobseeker"] as const;
export type ThemeAudience = (typeof THEME_AUDIENCES)[number];

export const THEME_EFFECTS = ["none", "confetti", "petals", "snow", "sparkles", "lanterns"] as const;
export type ThemeEffect = (typeof THEME_EFFECTS)[number];

export const EFFECT_LABELS: Record<ThemeEffect, string> = {
  none: "No effect",
  confetti: "Confetti",
  petals: "Falling petals",
  snow: "Snow",
  sparkles: "Sparkles",
  lanterns: "Floating lanterns",
};

export const EFFECT_SCOPES = ["landing", "everywhere"] as const;
export type ThemeEffectScope = (typeof EFFECT_SCOPES)[number];

// `main` is the strong colour (text, borders, the employer's buttons);
// `accent` is the employer's bright teal or the jobseeker's pale gold button
// colour; `soft` the pale tiles and pills; `page` the page background;
// `gradient` the big headings, left to right.
export type ThemeColors = {
  main: string;
  accent: string;
  soft: string;
  page: string;
  gradient: [string, string, string, string];
};

export type ThemeBanner = {
  enabled: boolean;
  emoji: string;
  text: string;
  linkLabel: string;
  linkUrl: string;
  imageUrl: string | null;
};

export type SiteTheme = {
  id: string;
  audience: ThemeAudience;
  name: string;
  presetKey: string | null;
  colors: ThemeColors;
  banner: ThemeBanner;
  effect: ThemeEffect;
  effectScope: ThemeEffectScope;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// The current JobGiga design — what each side shows with no theme on.
export const DEFAULT_THEME_COLORS: Record<ThemeAudience, ThemeColors> = {
  employer: {
    main: "#008990",
    accent: "#07BCCA",
    soft: "#E6F9FA",
    page: "#F2FAF5",
    gradient: ["#00757B", "#008990", "#07A4AF", "#C99A1E"],
  },
  jobseeker: {
    main: "#A67C00",
    accent: "#FFE9A6",
    soft: "#FFF3D6",
    page: "#FDFAF0",
    gradient: ["#8A6600", "#A67C00", "#C99A1E", "#0A8F98"],
  },
};

export const EMPTY_BANNER: ThemeBanner = {
  enabled: false,
  emoji: "",
  text: "",
  linkLabel: "",
  linkUrl: "",
  imageUrl: null,
};

export type ThemePreset = {
  key: string;
  name: string;
  emoji: string;
  description: string;
  effect: ThemeEffect;
  bannerText: Record<ThemeAudience, string>;
  colors: Record<ThemeAudience, ThemeColors>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "hari-raya",
    name: "Hari Raya Aidilfitri",
    emoji: "🌙",
    description: "Ketupat green and gold, with floating pelita lanterns.",
    effect: "lanterns",
    bannerText: {
      employer: "Selamat Hari Raya Aidilfitri! Maaf zahir dan batin from all of us at JobGiga.",
      jobseeker: "Selamat Hari Raya Aidilfitri! Wishing you a joyful Raya and a great new chapter.",
    },
    colors: {
      employer: {
        main: "#1E7A46",
        accent: "#3FB872",
        soft: "#E5F5EB",
        page: "#F3FAF5",
        gradient: ["#145C33", "#1E7A46", "#3FB872", "#C99A1E"],
      },
      jobseeker: {
        main: "#1E7A46",
        accent: "#FFE38A",
        soft: "#EAF6EE",
        page: "#FBFAF0",
        gradient: ["#145C33", "#1E7A46", "#C99A1E", "#B8860B"],
      },
    },
  },
  {
    key: "chinese-new-year",
    name: "Chinese New Year",
    emoji: "🧧",
    description: "Lucky red and gold, with drifting plum-blossom petals.",
    effect: "petals",
    bannerText: {
      employer: "Gong Xi Fa Cai! Wishing your team a prosperous year of great hires.",
      jobseeker: "Gong Xi Fa Cai! May the new year bring you the job you've been hoping for.",
    },
    colors: {
      employer: {
        main: "#C8102E",
        accent: "#E8434F",
        soft: "#FDEBEC",
        page: "#FFF6F4",
        gradient: ["#9E0B22", "#C8102E", "#E8434F", "#D4A017"],
      },
      jobseeker: {
        main: "#B3122B",
        accent: "#FFD98A",
        soft: "#FFF0E0",
        page: "#FFF8F0",
        gradient: ["#9E0B22", "#C8102E", "#D4A017", "#B8860B"],
      },
    },
  },
  {
    key: "deepavali",
    name: "Deepavali",
    emoji: "🪔",
    description: "Rich purple and marigold orange, with soft sparkles.",
    effect: "sparkles",
    bannerText: {
      employer: "Happy Deepavali! May the festival of lights brighten your team.",
      jobseeker: "Happy Deepavali! Wishing you light, joy and a bright career ahead.",
    },
    colors: {
      employer: {
        main: "#6B2FA3",
        accent: "#9B5DE5",
        soft: "#F1E9FB",
        page: "#F8F4FC",
        gradient: ["#4E1F7A", "#6B2FA3", "#9B5DE5", "#E07B00"],
      },
      jobseeker: {
        main: "#A65200",
        accent: "#FFD089",
        soft: "#FFF0DC",
        page: "#FFF9F1",
        gradient: ["#8A4500", "#A65200", "#E07B00", "#7A3FB0"],
      },
    },
  },
  {
    key: "merdeka",
    name: "Hari Merdeka",
    emoji: "🇲🇾",
    description: "Jalur Gemilang blue, red and yellow, with confetti.",
    effect: "confetti",
    bannerText: {
      employer: "Selamat Hari Merdeka! Proud to help Malaysian companies grow.",
      jobseeker: "Selamat Hari Merdeka! Here's to building Malaysia's future, one career at a time.",
    },
    colors: {
      employer: {
        main: "#0B3D91",
        accent: "#2F6FDB",
        soft: "#E7EEFB",
        page: "#F4F7FD",
        gradient: ["#0B3D91", "#2F6FDB", "#CC0001", "#C99A1E"],
      },
      jobseeker: {
        main: "#CC0001",
        accent: "#FFE16B",
        soft: "#FFF4D1",
        page: "#FFFBEF",
        gradient: ["#A30001", "#CC0001", "#0B3D91", "#C99A1E"],
      },
    },
  },
  {
    key: "christmas",
    name: "Christmas",
    emoji: "🎄",
    description: "Pine green and berry red, with gentle snow.",
    effect: "snow",
    bannerText: {
      employer: "Merry Christmas! Thank you for hiring with JobGiga this year.",
      jobseeker: "Merry Christmas! Wishing you a happy holiday and an exciting new year.",
    },
    colors: {
      employer: {
        main: "#1F6E43",
        accent: "#2FA66A",
        soft: "#E6F4EC",
        page: "#F4FAF6",
        gradient: ["#14532D", "#1F6E43", "#B91C1C", "#C99A1E"],
      },
      jobseeker: {
        main: "#B91C1C",
        accent: "#FFE3A3",
        soft: "#FDECEC",
        page: "#FFF8F5",
        gradient: ["#8E1515", "#B91C1C", "#1F6E43", "#C99A1E"],
      },
    },
  },
];

export function findPreset(key: string | null | undefined): ThemePreset | undefined {
  return key ? THEME_PRESETS.find((p) => p.key === key) : undefined;
}

// ---- Colour helpers -------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21) between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const INK = "#141B2E";

/** Readability warnings for the editor — never blocks saving. */
export function colorWarnings(audience: ThemeAudience, colors: ThemeColors): string[] {
  const warnings: string[] = [];
  if (contrastRatio(colors.main, "#FFFFFF") < 4.5) {
    warnings.push(
      audience === "employer"
        ? "Main colour is too light for white button text — pick a darker shade."
        : "Main colour is too light to read as text on white — pick a darker shade.",
    );
  }
  if (audience === "jobseeker" && contrastRatio(colors.accent, INK) < 7) {
    warnings.push("Button colour is too dark for the dark button text — pick a paler shade.");
  }
  if (contrastRatio(colors.soft, INK) < 10) warnings.push("Soft colour is too dark for text on it — pick a paler shade.");
  if (contrastRatio(colors.page, INK) < 12) warnings.push("Page background is too dark — pick a paler shade.");
  // 2.4, not higher — the default design's own gold end (#C99A1E) sits at ~2.6.
  if (colors.gradient.some((c) => contrastRatio(c, "#FFFFFF") < 2.4)) {
    warnings.push("A heading gradient colour is too light to read on the page — pick deeper shades.");
  }
  return warnings;
}

/**
 * The CSS variables a theme sets on its side's pages. Every value is built
 * from checked #RRGGBB colours only (falling back to the default design), so
 * it's safe to write straight into a <style> tag.
 */
export function themeCssVars(audience: ThemeAudience, colors: ThemeColors): Record<string, string> {
  const d = DEFAULT_THEME_COLORS[audience];
  const pick = (v: string, fallback: string) => (isHexColor(v) ? v : fallback);
  const main = pick(colors.main, d.main);
  const accent = pick(colors.accent, d.accent);
  const soft = pick(colors.soft, d.soft);
  const page = pick(colors.page, d.page);
  const g = d.gradient.map((fallback, i) => pick(colors.gradient?.[i], fallback));
  const gradient = `linear-gradient(90deg, ${g[0]} 0%, ${g[1]} 35%, ${g[2]} 60%, ${g[3]} 100%)`;

  if (audience === "employer") {
    return {
      "--color-brand-teal-dark": main,
      "--color-brand-teal": accent,
      "--color-brand-teal-soft": soft,
      "--color-brand-teal-page": page,
      "--color-brand-teal-bar": `color-mix(in srgb, ${main} 90%, white)`,
      "--brand-gradient-employer": gradient,
      "--ribbon-teal-light": `color-mix(in srgb, ${accent} 62%, white)`,
      "--ribbon-teal-pale": `color-mix(in srgb, ${accent} 20%, white)`,
      "--theme-main": main,
      "--theme-deep": g[0],
    };
  }
  return {
    "--color-brand-gold-dark": main,
    "--color-brand-gold": accent,
    "--color-brand-gold-soft": soft,
    "--color-brand-gold-page": page,
    "--brand-gradient-jobseeker": gradient,
    "--ribbon-gold-vivid": `color-mix(in srgb, ${main} 55%, ${accent})`,
    "--theme-main": main,
    "--theme-deep": g[0],
  };
}

export function cssVarsToText(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
}

/** Particle colours for a theme's effect. */
export function effectPalette(colors: ThemeColors): string[] {
  return [colors.main, colors.accent, colors.gradient[2], colors.gradient[3], "#FFFFFF"].filter(isHexColor);
}

// ---- Input checks (API boundary) ------------------------------------------

export const THEME_NAME_MAX = 40;
export const BANNER_TEXT_MAX = 140;
export const BANNER_LINK_LABEL_MAX = 24;
export const BANNER_EMOJI_MAX = 8;
export const BANNER_URL_MAX = 300;

/** A same-site path ("/jobseeker/jobs") or an https:// link — nothing else. */
export function isSafeBannerUrl(url: string) {
  if (url.startsWith("/")) return !url.startsWith("//") && !url.includes("\\");
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export type ThemeInput = {
  name: string;
  colors: ThemeColors;
  banner: Omit<ThemeBanner, "imageUrl">;
  effect: ThemeEffect;
  effectScope: ThemeEffectScope;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseThemeInput(raw: unknown): { value: ThemeInput } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid theme." };
  const r = raw as Record<string, unknown>;

  const name = str(r.name);
  if (!name) return { error: "Give the theme a name." };
  if (name.length > THEME_NAME_MAX) return { error: `Keep the name under ${THEME_NAME_MAX} characters.` };

  const c = (r.colors ?? {}) as Record<string, unknown>;
  const gradient = Array.isArray(c.gradient) ? c.gradient : [];
  if (![c.main, c.accent, c.soft, c.page].every(isHexColor) || gradient.length !== 4 || !gradient.every(isHexColor)) {
    return { error: "Every colour needs to be a full hex code, like #008990." };
  }
  const up = (v: string) => v.toUpperCase();
  const colors: ThemeColors = {
    main: up(c.main as string),
    accent: up(c.accent as string),
    soft: up(c.soft as string),
    page: up(c.page as string),
    gradient: gradient.map((g) => up(g as string)) as ThemeColors["gradient"],
  };

  const b = (r.banner ?? {}) as Record<string, unknown>;
  const banner = {
    enabled: b.enabled === true,
    emoji: str(b.emoji),
    text: str(b.text),
    linkLabel: str(b.linkLabel),
    linkUrl: str(b.linkUrl),
  };
  if ([...banner.emoji].length > BANNER_EMOJI_MAX) return { error: "Keep the banner emoji short — one or two emoji." };
  if (banner.text.length > BANNER_TEXT_MAX) return { error: `Keep the banner message under ${BANNER_TEXT_MAX} characters.` };
  if (banner.enabled && !banner.text) return { error: "Write a banner message, or turn the banner off." };
  if (banner.linkLabel.length > BANNER_LINK_LABEL_MAX) {
    return { error: `Keep the banner button under ${BANNER_LINK_LABEL_MAX} characters.` };
  }
  if (banner.linkUrl.length > BANNER_URL_MAX) return { error: "That banner link is too long." };
  if (banner.linkUrl && !isSafeBannerUrl(banner.linkUrl)) {
    return { error: "The banner link must be a page on JobGiga (starting with /) or an https:// link." };
  }
  if (banner.linkUrl && !banner.linkLabel) return { error: "Add a button label for the banner link." };
  if (banner.linkLabel && !banner.linkUrl) return { error: "Add a link for the banner button, or clear its label." };

  const effect = THEME_EFFECTS.find((e) => e === r.effect);
  if (!effect) return { error: "Choose an effect." };
  const effectScope = EFFECT_SCOPES.find((s) => s === r.effectScope);
  if (!effectScope) return { error: "Choose where the effect plays." };

  return { value: { name, colors, banner, effect, effectScope } };
}

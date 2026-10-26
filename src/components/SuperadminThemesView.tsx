"use client";

import { useRef, useState } from "react";
import { gradientFrameClass, inputClass, textareaClass } from "./formStyles";
import Modal from "./Modal";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { ThemeBannerStrip } from "./SiteThemeBanner";
import SiteThemeEffects from "./SiteThemeEffects";
import Switch from "./Switch";
import { PlusIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import {
  BANNER_LINK_LABEL_MAX,
  BANNER_TEXT_MAX,
  colorWarnings,
  DEFAULT_THEME_COLORS,
  EFFECT_LABELS,
  effectPalette,
  findPreset,
  isHexColor,
  THEME_EFFECTS,
  THEME_NAME_MAX,
  THEME_PRESETS,
  themeCssVars,
  type SiteTheme,
  type ThemeAudience,
  type ThemeColors,
} from "@/lib/site-themes-shared";

const SIDES: Record<ThemeAudience, { label: string; page: string; accent: "teal" | "gold" }> = {
  employer: { label: "Employer side", page: "/employer", accent: "teal" },
  jobseeker: { label: "Jobseeker side", page: "/jobseeker", accent: "gold" },
};

const COLOR_FIELDS: Record<ThemeAudience, { key: "main" | "accent" | "soft" | "page"; label: string; hint: string }[]> = {
  employer: [
    { key: "main", label: "Main colour", hint: "Buttons, links and highlighted text" },
    { key: "accent", label: "Bright accent", hint: "Card frames and the ribbon" },
    { key: "soft", label: "Soft tint", hint: "Pills and pale tiles" },
    { key: "page", label: "Page background", hint: "Behind everything" },
  ],
  jobseeker: [
    { key: "main", label: "Main colour", hint: "Links, outlines and highlighted text" },
    { key: "accent", label: "Button colour", hint: "Main buttons and card frames" },
    { key: "soft", label: "Soft tint", hint: "Pills and pale tiles" },
    { key: "page", label: "Page background", hint: "Behind everything" },
  ],
};

// inputClass without its w-full, for the fixed-width boxes (hex code, emoji).
const fixedInputClass = (accent: "teal" | "gold") => inputClass(accent).replace("w-full ", "");
const withArticle = (audience: ThemeAudience) => (audience === "employer" ? "an employer" : "a jobseeker");

type Draft = Pick<SiteTheme, "name" | "colors" | "banner" | "effect" | "effectScope">;
const toDraft = (t: SiteTheme): Draft => ({
  name: t.name,
  colors: { ...t.colors, gradient: [...t.colors.gradient] as ThemeColors["gradient"] },
  banner: { ...t.banner },
  effect: t.effect,
  effectScope: t.effectScope,
});

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong — please try again.");
  return data;
}

function Swatches({ colors, size = 18 }: { colors: ThemeColors; size?: number }) {
  return (
    <span className="flex items-center">
      {[colors.main, colors.accent, colors.soft, colors.page].map((c, i) => (
        <span
          key={i}
          className="rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
          style={{ background: c, width: size, height: size, marginLeft: i ? -5 : 0 }}
        />
      ))}
    </span>
  );
}

const gradientCss = (g: ThemeColors["gradient"]) =>
  `linear-gradient(90deg, ${g[0]} 0%, ${g[1]} 35%, ${g[2]} 60%, ${g[3]} 100%)`;

function ColorField({
  value,
  label,
  hint,
  accent,
  onChange,
}: {
  value: string;
  label: string;
  hint?: string;
  accent: "teal" | "gold";
  onChange: (hex: string) => void;
}) {
  // The typed text, kept apart from the colour so a half-typed code isn't lost.
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }
  const valid = isHexColor(text);
  return (
    <label className="flex items-center gap-[10px]">
      <input
        type="color"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={`${label} picker`}
        className="h-[38px] w-[44px] shrink-0 cursor-pointer rounded-[10px] border border-black/[0.1] bg-white p-[3px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[#141B2E]">{label}</span>
        {hint && <span className="block text-xs text-[#9AA3B2]">{hint}</span>}
      </span>
      <input
        value={text}
        onChange={(e) => {
          const next = e.target.value.trim();
          setText(next);
          const withHash = next.startsWith("#") ? next : `#${next}`;
          if (isHexColor(withHash)) onChange(withHash.toUpperCase());
        }}
        onBlur={() => setText(value)}
        aria-label={`${label} hex code`}
        aria-invalid={!valid}
        maxLength={7}
        className={`${fixedInputClass(accent)} w-[96px] shrink-0 font-mono uppercase ${valid ? "" : "border-red-400"}`}
      />
    </label>
  );
}

/** A small, faithful mock of the side's landing page in the draft's colours. */
function ThemePreview({ audience, draft }: { audience: ThemeAudience; draft: Draft }) {
  const vars = themeCssVars(audience, draft.colors) as React.CSSProperties;
  const gold = audience === "jobseeker";
  const showBanner = draft.banner.enabled && !!draft.banner.text;
  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-black/[0.06] ${gold ? "bg-brand-gold-page" : "bg-brand-teal-page"}`}
      style={vars}
    >
      {showBanner && <ThemeBannerStrip banner={draft.banner} compact />}
      <div className="flex items-center justify-between px-[16px] pt-[12px]">
        <span className="text-sm font-semibold text-[#141B2E]">JobGiga</span>
        <span
          className={`rounded-full px-[12px] py-[5px] text-xs ${gold ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"}`}
        >
          {gold ? "Sign in" : "Post a job"}
        </span>
      </div>
      <div className="px-[16px] pt-[22px] pb-[20px] text-center">
        <span
          className={`inline-flex rounded-full px-[10px] py-[4px] text-xs ${
            gold ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark"
          }`}
        >
          {gold ? "Latest openings" : "Who's hiring"}
        </span>
        <div>
          <h3
            className="mt-[10px] inline-block text-2xl font-semibold"
            style={{
              backgroundImage: `var(${gold ? "--brand-gradient-jobseeker" : "--brand-gradient-employer"})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              paddingBottom: "0.08em",
            }}
          >
            {gold ? "Start With What You Already Have." : "Go beyond the summit."}
          </h3>
        </div>
        <p className="mt-[6px] text-xs text-[#4B5468]">How the {gold ? "jobseeker" : "employer"} pages will look.</p>
        <div className="mt-[14px] flex justify-center gap-[8px]">
          <span
            className={`rounded-[12px] px-[14px] py-[8px] text-xs ${gold ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"}`}
          >
            {gold ? "Upload resume" : "Get started"}
          </span>
          <span
            className={`rounded-[12px] border bg-white px-[14px] py-[8px] text-xs ${
              gold ? "border-brand-gold-dark text-brand-gold-dark" : "border-brand-teal-dark text-brand-teal-dark"
            }`}
          >
            Learn more
          </span>
        </div>
        <div className={`mx-auto mt-[16px] max-w-[260px] ${gradientFrameClass(gold ? "gold" : "teal")}`}>
          <div className="flex items-center gap-[10px] rounded-[19px] bg-white p-[12px] text-left">
            <span
              className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-sm ${
                gold ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark"
              }`}
            >
              J
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-[#141B2E]">Marketing Executive</span>
              <span className={`block text-xs ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>3 open roles</span>
            </span>
          </div>
        </div>
      </div>
      <SiteThemeEffects
        effect={draft.effect}
        scope="everywhere"
        audience={audience}
        palette={effectPalette(draft.colors)}
        main={draft.colors.main}
        contained
      />
    </div>
  );
}

export default function SuperadminThemesView({
  authUser,
  initialThemes,
}: {
  authUser: AuthUser;
  initialThemes: SiteTheme[];
}) {
  const [themes, setThemes] = useState(initialThemes);
  const [side, setSide] = useState<ThemeAudience>("employer");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmOn, setConfirmOn] = useState<SiteTheme | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SiteTheme | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const { accent } = SIDES[side];
  const sideThemes = themes.filter((t) => t.audience === side);
  const live = sideThemes.find((t) => t.isActive) ?? null;
  const editing = editingId ? (themes.find((t) => t.id === editingId) ?? null) : null;
  const dirty = !!(editing && draft && JSON.stringify(toDraft(editing)) !== JSON.stringify(draft));

  async function run(key: string, fn: () => Promise<{ themes?: SiteTheme[] } | void>) {
    setBusy(key);
    setError(null);
    try {
      const data = await fn();
      if (data && data.themes) setThemes(data.themes);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openEditor(theme: SiteTheme) {
    setEditingId(theme.id);
    setDraft(toDraft(theme));
    setEditorError(null);
    setSavedNote(false);
    window.scrollTo({ top: 0 });
  }

  function closeEditor() {
    setEditingId(null);
    setDraft(null);
    setConfirmDiscard(false);
  }

  async function create(presetKey: string | null) {
    setAdding(false);
    let created: SiteTheme | null = null;
    await run("create", async () => {
      const data = await call("/api/superadmin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: side, presetKey }),
      });
      created = data.theme;
      return data;
    });
    if (created) openEditor(created);
  }

  function setActive(theme: SiteTheme, active: boolean) {
    setConfirmOn(null);
    void run(`active-${theme.id}`, () =>
      call(`/api/superadmin/themes/${theme.id}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      }),
    );
  }

  function remove(theme: SiteTheme) {
    setConfirmDelete(null);
    if (editingId === theme.id) closeEditor();
    void run(`delete-${theme.id}`, () => call(`/api/superadmin/themes/${theme.id}`, { method: "DELETE" }));
  }

  async function save(): Promise<boolean> {
    if (!editing || !draft) return false;
    setBusy("save");
    setEditorError(null);
    setSavedNote(false);
    try {
      const data = await call(`/api/superadmin/themes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setThemes(data.themes);
      setDraft(toDraft(data.theme));
      setSavedNote(true);
      return true;
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function previewOnSite(theme: SiteTheme) {
    // Opened right away (inside the click) so the browser doesn't block the tab.
    const tab = window.open("", "_blank");
    const ok = await run(`preview-${theme.id}`, async () => {
      if (editingId === theme.id && dirty && !(await save())) throw new Error("Fix the problems above, then preview.");
      const data = await call("/api/superadmin/themes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: theme.id }),
      });
      if (tab) tab.location.href = data.page;
      else window.location.href = data.page;
    });
    if (!ok) tab?.close();
  }

  async function uploadImage(file: File | undefined) {
    if (imageInput.current) imageInput.current.value = "";
    if (!file || !editing) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setEditorError("Upload a JPG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setEditorError("That image is too large (max 5 MB).");
    const form = new FormData();
    form.set("image", file);
    setBusy("image");
    setEditorError(null);
    try {
      const data = await call(`/api/superadmin/themes/${editing.id}/banner-image`, { method: "POST", body: form });
      setThemes(data.themes);
      // Only the picture changed on the server — keep the rest of the draft.
      setDraft((d) => (d ? { ...d, banner: { ...d.banner, imageUrl: data.theme.banner.imageUrl } } : d));
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function removeImage() {
    if (!editing) return;
    setBusy("image");
    setEditorError(null);
    try {
      const data = await call(`/api/superadmin/themes/${editing.id}/banner-image`, { method: "DELETE" });
      setThemes(data.themes);
      setDraft((d) => (d ? { ...d, banner: { ...d.banner, imageUrl: null } } : d));
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const primaryBtnFor = (a: "teal" | "gold") =>
    `flex h-[38px] items-center justify-center gap-[6px] rounded-full px-[18px] text-sm hover:opacity-90 disabled:opacity-50 ${
      a === "gold" ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"
    }`;
  const primaryBtn = primaryBtnFor(accent);
  const secondaryBtn =
    "flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] bg-white px-[16px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:opacity-50";
  const accentText = accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark";

  // ---- Editor -------------------------------------------------------------
  if (editing && draft) {
    const audience = editing.audience;
    const edAccent = SIDES[audience].accent;
    const preset = findPreset(editing.presetKey);
    const warnings = colorWarnings(audience, draft.colors);
    const setColors = (patch: Partial<ThemeColors>) => setDraft({ ...draft, colors: { ...draft.colors, ...patch } });
    const setBanner = (patch: Partial<Draft["banner"]>) => setDraft({ ...draft, banner: { ...draft.banner, ...patch } });

    return (
      <SuperadminDashboardShell
        authUser={authUser}
        active="themes"
        heading="Edit theme"
        headerAction={
          <button type="button" onClick={() => (dirty ? setConfirmDiscard(true) : closeEditor())} className={secondaryBtn}>
            ← All themes
          </button>
        }
        subheading={`Editing ${withArticle(audience)} theme. Changes show in the preview straight away, and on the site once saved${
          editing.isActive ? " — this theme is live, so saving updates the site right away." : "."
        }`}
      >
        <div className="grid grid-cols-1 items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className={gradientFrameClass(edAccent)}>
            <div className="flex flex-col gap-[26px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
              <section>
                <label className="text-sm font-semibold text-[#141B2E]" htmlFor="theme-name">
                  Theme name
                </label>
                <input
                  id="theme-name"
                  value={draft.name}
                  maxLength={THEME_NAME_MAX}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={`${inputClass(edAccent)} mt-[8px]`}
                  placeholder="e.g. Hari Raya 2027"
                />
                <p className="mt-[6px] text-xs text-[#9AA3B2]">Only superadmins see the name.</p>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-[8px]">
                  <h2 className="text-sm font-semibold text-[#141B2E]">Colours</h2>
                  <div className="flex flex-wrap gap-[12px] text-xs">
                    {preset && (
                      <button
                        type="button"
                        onClick={() => setColors(structuredClone(preset.colors[audience]))}
                        className={`hover:underline ${accentText}`}
                      >
                        Reset to {preset.name} colours
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setColors(structuredClone(DEFAULT_THEME_COLORS[audience]))}
                      className={`hover:underline ${accentText}`}
                    >
                      Use current JobGiga colours
                    </button>
                  </div>
                </div>
                <div className="mt-[12px] flex flex-col gap-[12px]">
                  {COLOR_FIELDS[audience].map((f) => (
                    <ColorField
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      accent={edAccent}
                      value={draft.colors[f.key]}
                      onChange={(hex) => setColors({ [f.key]: hex })}
                    />
                  ))}
                </div>
                <div className="mt-[18px]">
                  <span className="block text-sm text-[#141B2E]">Heading gradient</span>
                  <span className="block text-xs text-[#9AA3B2]">The big landing-page headings, left to right</span>
                  <div className="mt-[8px] h-[10px] rounded-full" style={{ backgroundImage: gradientCss(draft.colors.gradient) }} />
                  <div className="mt-[10px] grid grid-cols-2 gap-[10px] sm:grid-cols-4">
                    {draft.colors.gradient.map((c, i) => (
                      <input
                        key={i}
                        type="color"
                        value={c.toLowerCase()}
                        aria-label={`Heading gradient colour ${i + 1}`}
                        onChange={(e) => {
                          const gradient = [...draft.colors.gradient] as ThemeColors["gradient"];
                          gradient[i] = e.target.value.toUpperCase();
                          setColors({ gradient });
                        }}
                        className="h-[38px] w-full cursor-pointer rounded-[10px] border border-black/[0.1] bg-white p-[3px]"
                      />
                    ))}
                  </div>
                </div>
                {warnings.length > 0 && (
                  <ul className="mt-[14px] flex flex-col gap-[4px] rounded-[12px] border border-[#FBE7B3] bg-[#FFF3D6] p-[12px] text-xs leading-[18px] text-[#141B2E]">
                    {warnings.map((w) => (
                      <li key={w}>• {w}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-[12px]">
                  <div>
                    <h2 className="text-sm font-semibold text-[#141B2E]">Banner</h2>
                    <p className="text-xs text-[#9AA3B2]">A strip above the navbar on every {audience} page. Visitors can close it.</p>
                  </div>
                  <Switch
                    on={draft.banner.enabled}
                    label="Show the banner"
                    accent={edAccent}
                    onChange={() => setBanner({ enabled: !draft.banner.enabled })}
                  />
                </div>
                {draft.banner.enabled && (
                  <div className="mt-[12px] flex flex-col gap-[12px]">
                    <div className="flex gap-[10px]">
                      <input
                        value={draft.banner.emoji}
                        onChange={(e) => setBanner({ emoji: e.target.value })}
                        aria-label="Banner emoji"
                        placeholder="🌙"
                        maxLength={16}
                        disabled={!!draft.banner.imageUrl}
                        title={draft.banner.imageUrl ? "The picture shows instead of the emoji" : undefined}
                        className={`${fixedInputClass(edAccent)} w-[64px] shrink-0 text-center disabled:bg-[#F1F4F8]`}
                      />
                      <div className="min-w-0 flex-1">
                        <textarea
                          value={draft.banner.text}
                          onChange={(e) => setBanner({ text: e.target.value })}
                          aria-label="Banner message"
                          rows={2}
                          maxLength={BANNER_TEXT_MAX}
                          placeholder="Selamat Hari Raya! Maaf zahir dan batin."
                          className={textareaClass(edAccent)}
                        />
                        <p className="text-right text-xs text-[#9AA3B2]">
                          {draft.banner.text.length}/{BANNER_TEXT_MAX}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-[160px_minmax(0,1fr)]">
                      <input
                        value={draft.banner.linkLabel}
                        onChange={(e) => setBanner({ linkLabel: e.target.value })}
                        aria-label="Banner button label"
                        maxLength={BANNER_LINK_LABEL_MAX}
                        placeholder="Button (optional)"
                        className={inputClass(edAccent)}
                      />
                      <input
                        value={draft.banner.linkUrl}
                        onChange={(e) => setBanner({ linkUrl: e.target.value })}
                        aria-label="Banner button link"
                        placeholder={audience === "employer" ? "/employer/jobs or https://…" : "/jobseeker/jobs or https://…"}
                        className={inputClass(edAccent)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-[10px]">
                      {draft.banner.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.banner.imageUrl}
                          alt="Banner picture"
                          className="h-[40px] w-[40px] rounded-[10px] border border-black/[0.06] bg-[#F1F4F8] object-contain"
                        />
                      )}
                      <input
                        ref={imageInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => uploadImage(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={busy === "image"}
                        onClick={() => imageInput.current?.click()}
                        className={secondaryBtn}
                      >
                        {busy === "image" ? "Uploading…" : draft.banner.imageUrl ? "Replace picture" : "Add a picture"}
                      </button>
                      {draft.banner.imageUrl && (
                        <button
                          type="button"
                          disabled={busy === "image"}
                          onClick={removeImage}
                          className="text-sm text-red-500 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                      <span className="text-xs text-[#9AA3B2]">Optional — shows small, in place of the emoji. Saved straight away.</span>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-sm font-semibold text-[#141B2E]">Effect</h2>
                <p className="text-xs text-[#9AA3B2]">
                  A light animation over the page. It never blocks clicks, and is skipped for visitors who turn off motion.
                </p>
                <div className="mt-[10px] flex flex-wrap gap-[8px]">
                  {THEME_EFFECTS.map((e) => {
                    const on = draft.effect === e;
                    return (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft({ ...draft, effect: e })}
                        className={`rounded-full border px-[14px] py-[7px] text-sm transition-colors ${
                          on
                            ? edAccent === "gold"
                              ? "border-brand-gold-dark bg-brand-gold-soft text-brand-gold-dark"
                              : "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark"
                            : "border-black/[0.1] bg-white text-[#4B5468] hover:bg-black/[0.03]"
                        }`}
                      >
                        {EFFECT_LABELS[e]}
                      </button>
                    );
                  })}
                </div>
                {draft.effect !== "none" && (
                  <div className="mt-[12px] flex flex-col gap-[8px] text-sm text-[#141B2E] sm:flex-row sm:gap-[20px]">
                    {(
                      [
                        ["landing", `Landing page only (${SIDES[audience].page})`],
                        ["everywhere", `Every ${audience} page`],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-[8px]">
                        <input
                          type="radio"
                          name="effect-scope"
                          checked={draft.effectScope === value}
                          onChange={() => setDraft({ ...draft, effectScope: value })}
                          className={edAccent === "gold" ? "accent-brand-gold-dark" : "accent-brand-teal-dark"}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-[10px] border-t border-black/[0.06] pt-[18px]">
                {editorError && <p className="text-sm text-red-500">{editorError}</p>}
                {savedNote && !dirty && !editorError && (
                  <p className={`text-sm ${SIDES[audience].accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>
                    Saved{editing.isActive ? " — the site now shows these changes." : "."}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-[8px]">
                  <button
                    type="button"
                    disabled={!dirty || busy === "save"}
                    onClick={() => void save()}
                    className={primaryBtnFor(edAccent)}
                  >
                    {busy === "save" ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => previewOnSite(editing)}
                    className={secondaryBtn}
                  >
                    {dirty ? "Save & preview on site" : "Preview on site"}
                  </button>
                  {dirty && (
                    <button type="button" onClick={() => setDraft(toDraft(editing))} className="px-[8px] text-sm text-[#9AA3B2] hover:text-[#141B2E]">
                      Undo changes
                    </button>
                  )}
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-[85px]">
            <p className="mb-[8px] text-xs text-[#9AA3B2]">Live preview</p>
            <ThemePreview audience={audience} draft={draft} />
          </div>
        </div>

        {confirmDiscard && (
          <Modal ariaLabel="Discard your changes?" onClose={() => setConfirmDiscard(false)}>
            <h2 className="text-lg font-semibold text-[#141B2E]">Discard your changes?</h2>
            <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">You have unsaved changes to {editing.name}.</p>
            <div className="mt-[18px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
              >
                Keep editing
              </button>
            </div>
          </Modal>
        )}
      </SuperadminDashboardShell>
    );
  }

  // ---- List ---------------------------------------------------------------
  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="themes"
      heading="Themes"
      subheading="Give the employer or jobseeker side a festive look — colours, a banner and an effect. Each side runs its own theme; with none on, it shows the current JobGiga design."
      headerAction={
        <button type="button" onClick={() => setAdding(true)} disabled={busy === "create"} className={primaryBtn}>
          <PlusIcon className="h-[12px] w-[12px]" />
          {busy === "create" ? "Adding…" : "Add theme"}
        </button>
      }
    >
      <div role="tablist" aria-label="Side" className="inline-flex rounded-full bg-[#F1F4F8] p-[4px]">
        {(Object.keys(SIDES) as ThemeAudience[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={side === a}
            onClick={() => {
              setSide(a);
              setError(null);
            }}
            className={`rounded-full px-[16px] py-[8px] text-sm transition-colors ${
              side === a
                ? `bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${SIDES[a].accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark"}`
                : "text-[#4B5468] hover:text-[#141B2E]"
            }`}
          >
            {SIDES[a].label}
          </button>
        ))}
      </div>

      <div className={`mt-[16px] ${gradientFrameClass(accent)}`}>
        <div className="flex flex-wrap items-center gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[20px]">
          <Swatches colors={live?.colors ?? DEFAULT_THEME_COLORS[side]} size={24} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#9AA3B2]">Live now on the {side} side</p>
            <p className="text-lg font-semibold text-[#141B2E]">{live ? live.name : "Current JobGiga design"}</p>
          </div>
          <a href={SIDES[side].page} target="_blank" rel="noreferrer" className={`text-sm hover:underline ${accentText}`}>
            View page
          </a>
          {live && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setActive(live, false)}
              className={secondaryBtn}
            >
              Turn off
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-[12px] text-sm text-red-500">{error}</p>}

      {sideThemes.length === 0 ? (
        <div className="mt-[20px] rounded-[18px] border border-dashed border-[#D7DCE4] bg-white/60 p-[28px] text-center">
          <p className="text-sm text-[#141B2E]">No {side} themes yet.</p>
          <p className="mt-[4px] text-xs text-[#9AA3B2]">Add a ready-made festive theme, or build your own from the current colours.</p>
          <button type="button" onClick={() => setAdding(true)} className={`${primaryBtn} mx-auto mt-[14px]`}>
            <PlusIcon className="h-[12px] w-[12px]" />
            Add theme
          </button>
        </div>
      ) : (
        <div className="mt-[20px] grid grid-cols-1 gap-[16px] lg:grid-cols-2">
          {sideThemes.map((t) => {
            const preset = findPreset(t.presetKey);
            return (
              <div key={t.id} className={gradientFrameClass(accent)}>
                <div className="flex flex-col gap-[12px] rounded-[19px] bg-white p-[16px]">
                  <div className="h-[8px] rounded-full" style={{ backgroundImage: gradientCss(t.colors.gradient) }} />
                  <div className="flex items-start gap-[12px]">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-[8px] text-sm font-semibold text-[#141B2E]">
                        <span className="truncate">{t.name}</span>
                        {t.isActive && (
                          <span
                            className={`shrink-0 rounded-full px-[8px] py-[2px] text-xs font-normal ${
                              accent === "gold" ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark"
                            }`}
                          >
                            Live
                          </span>
                        )}
                      </p>
                      <p className="mt-[2px] text-xs text-[#9AA3B2]">
                        {preset ? `Ready-made · ${preset.name}` : "Custom"} · {EFFECT_LABELS[t.effect]} ·{" "}
                        {t.banner.enabled ? "Banner on" : "No banner"}
                      </p>
                    </div>
                    <Swatches colors={t.colors} />
                    <Switch
                      on={t.isActive}
                      label={`${t.name} live`}
                      accent={accent}
                      disabled={busy !== null}
                      onChange={() => (t.isActive ? setActive(t, false) : setConfirmOn(t))}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <button type="button" onClick={() => openEditor(t)} className={secondaryBtn}>
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => previewOnSite(t)}
                      className={secondaryBtn}
                    >
                      Preview on site
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setConfirmDelete(t)}
                      className="ml-auto px-[8px] text-sm text-red-500 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <Modal ariaLabel={`Add ${withArticle(side)} theme`} onClose={() => setAdding(false)} large>
          <h2 className="text-lg font-semibold text-[#141B2E]">Add {withArticle(side)} theme</h2>
          <p className="mt-[4px] text-sm text-[#4B5468]">Pick a ready-made one to start from — you can change everything after. It stays off until you switch it on.</p>
          <div className="mt-[16px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => create(p.key)}
                className="flex flex-col gap-[8px] rounded-[16px] border border-black/[0.08] bg-white p-[14px] text-left transition-colors hover:border-black/[0.2] hover:bg-black/[0.015]"
              >
                <div className="h-[6px] rounded-full" style={{ backgroundImage: gradientCss(p.colors[side].gradient) }} />
                <span className="flex items-center gap-[8px]">
                  <span aria-hidden className="text-lg leading-none">
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-[#141B2E]">{p.name}</span>
                  <Swatches colors={p.colors[side]} size={14} />
                </span>
                <span className="text-xs leading-[17px] text-[#4B5468]">{p.description}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => create(null)}
              className="flex flex-col justify-center gap-[6px] rounded-[16px] border border-dashed border-[#D7DCE4] bg-white p-[14px] text-left transition-colors hover:border-black/[0.25]"
            >
              <span className="flex items-center gap-[8px] text-sm font-semibold text-[#141B2E]">
                <PlusIcon className="h-[12px] w-[12px]" />
                Start from scratch
              </span>
              <span className="text-xs leading-[17px] text-[#4B5468]">Begins with the current JobGiga colours, no banner and no effect.</span>
            </button>
          </div>
        </Modal>
      )}

      {confirmOn && (
        <Modal ariaLabel={`Turn on ${confirmOn.name}?`} onClose={() => setConfirmOn(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Turn on {confirmOn.name}?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            Every {confirmOn.audience} page shows it right away
            {live && live.id !== confirmOn.id ? `, and ${live.name} is turned off` : ""}.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button type="button" onClick={() => setActive(confirmOn, true)} className={primaryBtn}>
              Turn on
            </button>
            <button
              type="button"
              onClick={() => setConfirmOn(null)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Not yet
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal ariaLabel={`Delete ${confirmDelete.name}?`} onClose={() => setConfirmDelete(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Delete {confirmDelete.name}?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            {confirmDelete.isActive
              ? `It's live right now — the ${confirmDelete.audience} side goes back to the current JobGiga design.`
              : "This can't be undone."}
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={() => remove(confirmDelete)}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
            >
              Delete theme
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Keep it
            </button>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}

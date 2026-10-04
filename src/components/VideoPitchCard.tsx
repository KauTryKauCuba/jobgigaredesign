"use client";

import { useState } from "react";
import VideoPitchRecorder from "./VideoPitchRecorder";
import { gradientFrameClass, inputClass } from "./formStyles";
import { CheckIcon } from "./icons";

export type JobseekerVideoPitch = {
  id: string;
  durationSeconds: number;
  intro: string | null;
  strengths: string[];
  visible: boolean;
  updatedAt: string;
  watchedByCount: number;
};

const MAX_INTRO = 150;
const MAX_STRENGTHS = 3;

/**
 * My Profile's video pitch card. Without a pitch it's a friendly nudge
 * (what the jobseeker gets out of recording one); with one, it's the
 * jobseeker's own view of it: watch, the one-line intro and strengths
 * employers skim first, show/hide, replace, delete, and how many
 * employers have watched it.
 */
export default function VideoPitchCard({
  initialPitch,
  skills,
}: {
  initialPitch: JobseekerVideoPitch | null;
  // The jobseeker's own profile skills — strengths are picked from these.
  skills: string[];
}) {
  const [pitch, setPitch] = useState(initialPitch);
  const [recorder, setRecorder] = useState<null | { guide: boolean }>(null);
  const [intro, setIntro] = useState(initialPitch?.intro ?? "");
  const [strengths, setStrengths] = useState<string[]>(initialPitch?.strengths ?? []);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickingStrengths, setPickingStrengths] = useState(false);

  const detailsDirty =
    !!pitch &&
    (intro.trim() !== (pitch.intro ?? "") ||
      strengths.length !== pitch.strengths.length ||
      strengths.some((s) => !pitch.strengths.includes(s)));

  function applyPitch(next: JobseekerVideoPitch | null) {
    setPitch(next);
    setIntro(next?.intro ?? "");
    setStrengths(next?.strengths ?? []);
  }

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/jobseeker/video-pitch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      applyPitch(data.pitch);
      setStatus({ kind: "ok", message: okMessage });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/jobseeker/video-pitch", { method: "DELETE" });
      if (!res.ok) throw new Error();
      applyPitch(null);
      setConfirmDelete(false);
    } catch {
      setStatus({ kind: "error", message: "Couldn't delete your video — try again." });
    } finally {
      setSaving(false);
    }
  }

  function toggleStrength(skill: string) {
    setStrengths((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : prev.length < MAX_STRENGTHS ? [...prev, skill] : prev,
    );
  }

  return (
    <div id="video-pitch" className={`scroll-mt-[100px] animate-fade-in-up ${gradientFrameClass("gold")}`}>
      <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        {!pitch ? (
          <>
            <div>
              <p className="text-lg font-semibold text-[#141B2E]">🎥 Add a 60-second video pitch</p>
              <p className="mt-[4px] text-sm text-[#4B5468]">Let employers meet you before the interview.</p>
            </div>
            <ul className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
              {[
                "Shown first when employers view your application",
                "Get notified when an employer watches it",
                "Guided questions — you'll know exactly what to say",
                "Record once — used on every application",
              ].map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-[10px] rounded-[14px] border border-[#FBE7B5] bg-[#FFFBF0] p-[12px] text-sm leading-[20px] text-[#141B2E]"
                >
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#FFE9A6]">
                    <CheckIcon className="h-[11px] w-[11px] text-brand-gold-dark" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-[10px]">
              <button
                type="button"
                onClick={() => setRecorder({ guide: false })}
                className="flex h-[40px] items-center rounded-full bg-[#FFE9A6] px-[20px] text-sm text-[#141B2E] hover:opacity-90"
              >
                Record my pitch
              </button>
              <button
                type="button"
                onClick={() => setRecorder({ guide: true })}
                className="text-sm text-brand-gold-dark hover:underline"
              >
                View guide
              </button>
            </div>
            <p className="text-xs text-[#9AA3B2]">Optional · only shown to employers you apply to.</p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-[8px]">
              <div>
                <p className="text-lg font-semibold text-[#141B2E]">🎥 Your video pitch</p>
                <p className="mt-[2px] text-xs text-[#9AA3B2]">
                  {pitch.watchedByCount > 0
                    ? `Watched by ${pitch.watchedByCount} employer${pitch.watchedByCount === 1 ? "" : "s"}`
                    : "Not watched yet — employers see it when they view your applications."}
                </p>
              </div>
              <label className="flex items-center gap-[8px] text-xs text-[#4B5468]">
                Show to employers
                <button
                  type="button"
                  role="switch"
                  aria-checked={pitch.visible}
                  disabled={saving}
                  onClick={() =>
                    patch({ visible: !pitch.visible }, pitch.visible ? "Hidden from employers." : "Visible to employers.")
                  }
                  className={`relative h-[22px] w-[38px] rounded-full transition-colors disabled:opacity-60 ${
                    pitch.visible ? "bg-brand-gold-dark" : "bg-[#D7DCE4]"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] ${
                      pitch.visible ? "left-[19px]" : "left-[3px]"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Compact: a small player beside the details, so the card stays
                about the size of the "Add a pitch" nudge it replaces. */}
            <div className="flex flex-col gap-[14px] md:flex-row md:items-start">
              <video
                // Cache-busted by updatedAt so a replaced video never shows the old one.
                key={pitch.updatedAt}
                src={`/api/video-pitches/${pitch.id}/stream?v=${encodeURIComponent(pitch.updatedAt)}`}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full shrink-0 rounded-[14px] bg-black object-contain md:w-[300px]"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
                <div>
                  <div className="mb-[6px] flex items-baseline justify-between gap-[8px]">
                    <label htmlFor="pitchIntro" className="text-xs text-[#4B5468]">
                      One-line intro (optional) — employers read this first
                    </label>
                    <span className="text-xs text-[#9AA3B2]">
                      {intro.length}/{MAX_INTRO}
                    </span>
                  </div>
                  <input
                    id="pitchIntro"
                    value={intro}
                    maxLength={MAX_INTRO}
                    onChange={(e) => setIntro(e.target.value)}
                    placeholder="e.g. 5 years in retail, fluent in BM & English, can start immediately."
                    className={inputClass("gold")}
                  />
                </div>

                <div>
                  <div className="mb-[6px] flex items-baseline justify-between gap-[8px]">
                    <p className="text-xs text-[#4B5468]">
                      Your top strengths (up to {MAX_STRENGTHS})
                    </p>
                    {skills.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPickingStrengths((v) => !v)}
                        className="text-xs text-brand-gold-dark hover:underline"
                      >
                        {pickingStrengths ? "Done" : strengths.length > 0 ? "Change" : "Choose"}
                      </button>
                    )}
                  </div>
                  {skills.length === 0 ? (
                    <p className="text-xs text-[#9AA3B2]">Add skills to your profile below to pick strengths here.</p>
                  ) : !pickingStrengths ? (
                    strengths.length > 0 ? (
                      <div className="flex flex-wrap gap-[6px]">
                        {strengths.map((s) => (
                          <span key={s} className="rounded-full bg-[#FFE9A6] px-[10px] py-[4px] text-xs text-[#141B2E]">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#9AA3B2]">None picked yet.</p>
                    )
                  ) : (
                <div className="flex max-h-[150px] flex-wrap gap-[6px] overflow-y-auto">
                  {skills.map((skill) => {
                    const picked = strengths.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleStrength(skill)}
                        disabled={!picked && strengths.length >= MAX_STRENGTHS}
                        className={`rounded-full px-[10px] py-[4px] text-xs transition-colors disabled:opacity-40 ${
                          picked ? "bg-[#FFE9A6] text-[#141B2E]" : "bg-[#F1F4F8] text-[#4B5468] hover:bg-black/[0.06]"
                        }`}
                      >
                        {picked ? "✓ " : ""}
                        {skill}
                      </button>
                    );
                  })}
                </div>
                  )}
                </div>

            <div className="flex flex-wrap items-center gap-[8px]">
              <button
                type="button"
                disabled={saving || !detailsDirty}
                onClick={() => patch({ intro: intro.trim() || null, strengths }, "Saved.")}
                className="flex h-[36px] items-center rounded-full bg-[#FFE9A6] px-[16px] text-sm text-[#141B2E] hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setRecorder({ guide: false })}
                className="flex h-[36px] items-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
              >
                Replace video
              </button>
              <button
                type="button"
                onClick={() => setRecorder({ guide: true })}
                className="text-sm text-brand-gold-dark hover:underline"
              >
                View guide
              </button>
              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="flex items-center gap-[6px]">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDelete}
                      className="rounded-full bg-red-500 px-[12px] py-[6px] text-xs text-white hover:opacity-90"
                    >
                      Delete video
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-[6px] py-[6px] text-xs text-[#4B5468]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-sm text-[#9AA3B2] hover:text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {status && (
              <p className={`text-xs ${status.kind === "error" ? "text-red-600" : "text-brand-gold-dark"}`}>
                {status.message}
              </p>
            )}
              </div>
            </div>
          </>
        )}
      </div>

      {recorder && (
        <VideoPitchRecorder
          startWithGuide={recorder.guide}
          onClose={() => setRecorder(null)}
          onSaved={(saved) => {
            applyPitch(saved as JobseekerVideoPitch);
            setRecorder(null);
            setStatus({ kind: "ok", message: "Your video pitch is saved." });
          }}
        />
      )}
    </div>
  );
}

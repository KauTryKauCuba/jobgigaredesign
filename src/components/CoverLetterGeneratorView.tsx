"use client";

import { useState } from "react";
import Dropdown from "./Dropdown";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import Modal from "./Modal";
import RichTextEditor from "./RichTextEditor";
import { useRegisterUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { gradientFrameClass, inputClass, textareaClass } from "./formStyles";
import { CopyIcon, TrashIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import {
  COVER_LETTER_LANGUAGES,
  COVER_LETTER_LANGUAGE_LABEL,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_LENGTH_LABEL,
  COVER_LETTER_TONES,
  COVER_LETTER_TONE_LABEL,
  DEFAULT_COVER_LETTER_OPTIONS,
  isBlankHtml,
  type CoverLetterOptions,
} from "@/lib/cover-letter-options";

export type CoverLetterRow = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobPostingText: string;
  content: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// Rich-text HTML -> plain text with paragraph breaks, for "Copy".
function htmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(
    html.replace(/<\/(p|li|h[1-6])>/gi, "</$1>\n\n").replace(/<br\s*\/?>/gi, "\n"),
    "text/html",
  );
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function fileSafe(text: string) {
  return text.replace(/[\\/:*?"<>|]+/g, "").trim() || "Cover letter";
}

// A minimal, print-friendly page wrapping the letter — used for both the
// Word download and the PDF (print) view.
function letterDocument(title: string, html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5;color:#141B2E;max-width:680px;margin:48px auto;padding:0 24px}p{margin:0 0 12pt}</style>
</head><body>${html}</body></html>`;
}

function OptionsRow({
  options,
  onChange,
  idPrefix,
}: {
  options: CoverLetterOptions;
  onChange: (options: CoverLetterOptions) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <label htmlFor={`${idPrefix}-tone`} className="mb-[6px] block text-xs text-[#4B5468]">
          Tone
        </label>
        <Dropdown
          id={`${idPrefix}-tone`}
          label="Tone"
          accent="gold"
          value={options.tone}
          options={COVER_LETTER_TONES.map((t) => ({ value: t, label: COVER_LETTER_TONE_LABEL[t] }))}
          onChange={(tone) => onChange({ ...options, tone })}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-length`} className="mb-[6px] block text-xs text-[#4B5468]">
          Length
        </label>
        <Dropdown
          id={`${idPrefix}-length`}
          label="Length"
          accent="gold"
          value={options.length}
          options={COVER_LETTER_LENGTHS.map((l) => ({ value: l, label: COVER_LETTER_LENGTH_LABEL[l] }))}
          onChange={(length) => onChange({ ...options, length })}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-language`} className="mb-[6px] block text-xs text-[#4B5468]">
          Language
        </label>
        <Dropdown
          id={`${idPrefix}-language`}
          label="Language"
          accent="gold"
          value={options.language}
          options={COVER_LETTER_LANGUAGES.map((l) => ({ value: l, label: COVER_LETTER_LANGUAGE_LABEL[l] }))}
          onChange={(language) => onChange({ ...options, language })}
        />
      </div>
    </div>
  );
}

export default function CoverLetterGeneratorView({
  authUser,
  resume,
  initialCoverLetters,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  initialCoverLetters: CoverLetterRow[];
}) {
  const [letters, setLetters] = useState<CoverLetterRow[]>(initialCoverLetters);
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobPostingText, setJobPostingText] = useState("");
  const [generateOptions, setGenerateOptions] = useState<CoverLetterOptions>(DEFAULT_COVER_LETTER_OPTIONS);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = initialCoverLetters[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(first?.id ?? null);
  const [draftContent, setDraftContent] = useState(first?.content ?? "");
  const [draftCompany, setDraftCompany] = useState(first?.companyName ?? "");
  const [draftTitle, setDraftTitle] = useState(first?.jobTitle ?? "");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ kind: "saved" | "error"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [regenerateOptions, setRegenerateOptions] = useState<CoverLetterOptions>(DEFAULT_COVER_LETTER_OPTIONS);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Same "save / discard / keep editing" prompt as My Profile — shown before
  // anything that would throw away unsaved edits (switching letters, leaving).
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);

  const selected = letters.find((l) => l.id === selectedId) ?? null;
  const isDirty =
    !!selected &&
    (draftContent !== selected.content ||
      draftCompany.trim() !== selected.companyName ||
      draftTitle.trim() !== selected.jobTitle);
  const canSave = isDirty && !isBlankHtml(draftContent) && !!draftCompany.trim() && !!draftTitle.trim();

  function guardNavigation(proceed: () => void) {
    if (isDirty) setPendingProceed(() => proceed);
    else proceed();
  }
  useRegisterUnsavedChangesGuard(guardNavigation);

  function loadLetter(letter: CoverLetterRow | null) {
    setSelectedId(letter?.id ?? null);
    setDraftContent(letter?.content ?? "");
    setDraftCompany(letter?.companyName ?? "");
    setDraftTitle(letter?.jobTitle ?? "");
    setSaveStatus(null);
    setCopied(false);
  }

  function selectLetter(letter: CoverLetterRow) {
    if (letter.id === selectedId) return;
    guardNavigation(() => loadLetter(letter));
  }

  async function handleGenerate() {
    if (!companyName.trim() || !jobTitle.trim() || !jobPostingText.trim()) {
      setError("Fill in the company name, job title, and job posting description.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/jobseeker/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, jobTitle, jobPostingText, options: generateOptions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate a cover letter.");
        return;
      }
      const created: CoverLetterRow = data.coverLetter;
      setLetters((prev) => [created, ...prev]);
      // Don't clobber unsaved edits on the letter currently open.
      guardNavigation(() => loadLetter(created));
      setCompanyName("");
      setJobTitle("");
      setJobPostingText("");
    } catch {
      setError("Couldn't reach the generation service.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(): Promise<boolean> {
    if (!selected || !canSave) return false;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/jobseeker/cover-letters/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent, companyName: draftCompany, jobTitle: draftTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save this letter.");
      const saved: CoverLetterRow = data.coverLetter;
      setLetters((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      // Re-sync drafts to what the server stored (it trims/sanitizes).
      setDraftContent(saved.content);
      setDraftCompany(saved.companyName);
      setDraftTitle(saved.jobTitle);
      setSaveStatus({ kind: "saved", message: "Saved." });
      return true;
    } catch (err) {
      setSaveStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save this letter." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!selected) return;
    setConfirmRegenerate(false);
    setRegenerating(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/jobseeker/cover-letters/${selected.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: regenerateOptions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't regenerate this letter.");
      const updated: CoverLetterRow = data.coverLetter;
      setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setDraftContent(updated.content);
      setDraftCompany(updated.companyName);
      setDraftTitle(updated.jobTitle);
      setSaveStatus({ kind: "saved", message: "Rewritten and saved." });
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't regenerate this letter.",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/jobseeker/cover-letters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const remaining = letters.filter((l) => l.id !== id);
      setLetters(remaining);
      setConfirmDeleteId(null);
      if (selectedId === id) loadLetter(remaining[0] ?? null);
    } catch {
      setDeleteError("Couldn't delete that letter — try again.");
    }
  }

  async function handleCopy() {
    const plain = htmlToPlainText(draftContent);
    try {
      // Rich copy where supported (keeps paragraphs when pasted into Word or
      // Gmail), plain text everywhere else.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([draftContent], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveStatus({ kind: "error", message: "Couldn't copy — select the text and copy it manually." });
    }
  }

  function downloadName() {
    return fileSafe(`Cover letter - ${draftCompany} - ${draftTitle}`);
  }

  function handleDownloadWord() {
    // Word opens an HTML document saved as .doc natively, keeping paragraphs.
    const blob = new Blob(["﻿", letterDocument(downloadName(), draftContent)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${downloadName()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    // Opens a clean print view; the browser's print dialog saves it as PDF.
    const win = window.open("", "_blank");
    if (!win) {
      setSaveStatus({ kind: "error", message: "Allow pop-ups for this site to download as PDF." });
      return;
    }
    win.document.write(letterDocument(downloadName(), draftContent));
    win.document.close();
    win.focus();
    win.print();
  }

  const toolButton =
    "flex h-[32px] items-center gap-[6px] rounded-full border border-black/[0.1] px-[12px] text-xs text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="coverLetters"
      resume={resume}
      heading="Cover Letters"
      subheading="Paste any job posting and get a cover letter drafted from your profile — nothing here is tied to an application on this platform."
    >
      <div className="grid gap-[20px] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[16px]">
          <div className={gradientFrameClass("gold")}>
            <div className="flex flex-col gap-[12px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
              <div>
                <label className="mb-[6px] block text-xs text-[#4B5468]">Company name</label>
                <input
                  className={inputClass("gold")}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Maju Jaya Sdn Bhd"
                />
              </div>
              <div>
                <label className="mb-[6px] block text-xs text-[#4B5468]">Job title</label>
                <input
                  className={inputClass("gold")}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Marketing Executive"
                />
              </div>
              <div>
                <label className="mb-[6px] block text-xs text-[#4B5468]">Job posting description</label>
                <textarea
                  className={`${textareaClass("gold")} min-h-[160px]`}
                  value={jobPostingText}
                  onChange={(e) => setJobPostingText(e.target.value)}
                  placeholder="Paste the job description here"
                />
              </div>
              <OptionsRow options={generateOptions} onChange={setGenerateOptions} idPrefix="generate" />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="h-[40px] rounded-full bg-brand-gold-dark text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {generating ? "Generating…" : "Generate cover letter"}
              </button>
            </div>
          </div>

          {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
          {letters.length > 0 && (
            <div className="flex flex-col gap-[8px]">
              {letters.map((letter) => (
                <div
                  key={letter.id}
                  className={`flex items-center justify-between gap-[8px] rounded-[12px] border p-[12px] text-left transition-colors ${
                    letter.id === selectedId ? "border-brand-gold-dark bg-[#FFF3D6]" : "border-black/[0.08] bg-white hover:bg-black/[0.02]"
                  }`}
                >
                  <button type="button" onClick={() => selectLetter(letter)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm text-[#141B2E]">{letter.jobTitle}</p>
                    <p className="truncate text-xs text-[#9AA3B2]">
                      {letter.companyName} · {formatDate(letter.createdAt)}
                    </p>
                  </button>
                  {confirmDeleteId === letter.id ? (
                    <div className="flex shrink-0 items-center gap-[6px]">
                      <button
                        type="button"
                        onClick={() => handleDelete(letter.id)}
                        className="rounded-full bg-red-500 px-[10px] py-[4px] text-xs text-white hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-full px-[8px] py-[4px] text-xs text-[#4B5468] hover:bg-black/[0.04]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDeleteId(letter.id);
                      }}
                      aria-label="Delete cover letter"
                      className="shrink-0 rounded-full p-[6px] text-[#9AA3B2] hover:bg-black/[0.04] hover:text-red-600"
                    >
                      <TrashIcon className="h-[14px] w-[14px]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`animate-fade-in-up h-full ${gradientFrameClass("gold")}`} style={{ animationDelay: "60ms" }}>
          <div className="flex h-full min-h-[400px] flex-col gap-[12px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            {selected ? (
              <>
                <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                  <div>
                    <label className="mb-[4px] block text-xs text-[#4B5468]">Job title</label>
                    <input
                      className={inputClass("gold")}
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-[4px] block text-xs text-[#4B5468]">Company</label>
                    <input
                      className={inputClass("gold")}
                      value={draftCompany}
                      onChange={(e) => setDraftCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-[6px]">
                  <button type="button" onClick={handleCopy} disabled={isBlankHtml(draftContent)} className={toolButton}>
                    <CopyIcon className="h-[12px] w-[12px]" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isBlankHtml(draftContent)}
                    className={toolButton}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadWord}
                    disabled={isBlankHtml(draftContent)}
                    className={toolButton}
                  >
                    Download Word
                  </button>
                  <div className="ml-auto flex items-center gap-[8px]">
                    {saveStatus && (
                      <span className={`text-xs ${saveStatus.kind === "error" ? "text-red-600" : "text-brand-gold-dark"}`}>
                        {saveStatus.message}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !canSave}
                      className="h-[32px] shrink-0 rounded-full bg-brand-gold-dark px-[16px] text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>

                <RichTextEditor accent="gold" value={draftContent} onChange={setDraftContent} />

                <div className="rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                  <p className="text-xs text-[#141B2E]">Rewrite this letter</p>
                  <p className="mt-[2px] text-xs text-[#9AA3B2]">
                    Same job posting, a fresh draft in the style you pick. Replaces the current text.
                  </p>
                  <div className="mt-[10px] flex flex-col gap-[8px]">
                    <OptionsRow options={regenerateOptions} onChange={setRegenerateOptions} idPrefix="regenerate" />
                    <button
                      type="button"
                      onClick={() => setConfirmRegenerate(true)}
                      disabled={regenerating}
                      className="h-[34px] rounded-full border border-brand-gold-dark text-sm text-brand-gold-dark transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {regenerating ? "Rewriting…" : "Regenerate"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-[#9AA3B2]">
                Generate a cover letter to see it here.
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingProceed && (
        <Modal ariaLabel="Leave without saving?" onClose={() => setPendingProceed(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Leave without saving?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            You&rsquo;ve edited this cover letter but haven&rsquo;t saved it yet. Save it before you go, or discard
            your changes.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={saving || !canSave}
              onClick={async () => {
                const proceed = pendingProceed;
                if (await handleSave()) {
                  setPendingProceed(null);
                  proceed();
                }
              }}
              className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                const proceed = pendingProceed;
                setPendingProceed(null);
                proceed();
              }}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={() => setPendingProceed(null)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Keep editing
            </button>
          </div>
        </Modal>
      )}

      {confirmRegenerate && (
        <Modal ariaLabel="Regenerate this letter?" onClose={() => setConfirmRegenerate(false)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Regenerate this letter?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            A new {COVER_LETTER_LENGTH_LABEL[regenerateOptions.length].toLowerCase()},{" "}
            {COVER_LETTER_TONE_LABEL[regenerateOptions.tone].toLowerCase()} draft in{" "}
            {COVER_LETTER_LANGUAGE_LABEL[regenerateOptions.language]} will replace the current text
            {isDirty ? ", including your unsaved edits" : ""}.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={handleRegenerate}
              className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={() => setConfirmRegenerate(false)}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </JobseekerDashboardShell>
  );
}

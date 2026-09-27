"use client";

import { useState } from "react";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import RichTextEditor from "./RichTextEditor";
import { inputClass, textareaClass, MOCKUP_CARD_CLASS } from "./formStyles";
import { TrashIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialCoverLetters[0]?.id ?? null);
  const [draftContent, setDraftContent] = useState(initialCoverLetters[0]?.content ?? "");
  const [saving, setSaving] = useState(false);

  const selected = letters.find((l) => l.id === selectedId) ?? null;

  function selectLetter(letter: CoverLetterRow) {
    setSelectedId(letter.id);
    setDraftContent(letter.content);
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
        body: JSON.stringify({ companyName, jobTitle, jobPostingText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate a cover letter.");
        return;
      }
      const created: CoverLetterRow = data.coverLetter;
      setLetters((prev) => [created, ...prev]);
      selectLetter(created);
      setCompanyName("");
      setJobTitle("");
      setJobPostingText("");
    } catch {
      setError("Couldn't reach the generation service.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/cover-letters/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftContent }),
      });
      const data = await res.json();
      if (res.ok) {
        setLetters((prev) => prev.map((l) => (l.id === selected.id ? data.coverLetter : l)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/jobseeker/cover-letters/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setLetters((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setDraftContent("");
    }
  }

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
          <div className={`${MOCKUP_CARD_CLASS} flex flex-col gap-[12px]`}>
            <div>
              <label className="mb-[6px] block text-xs text-[#4B5468]">Company name</label>
              <input
                className={inputClass("gold")}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Sdn Bhd"
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
                  <button
                    type="button"
                    onClick={() => handleDelete(letter.id)}
                    aria-label="Delete cover letter"
                    className="shrink-0 rounded-full p-[6px] text-[#9AA3B2] hover:bg-black/[0.04] hover:text-red-600"
                  >
                    <TrashIcon className="h-[14px] w-[14px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${MOCKUP_CARD_CLASS} flex min-h-[400px] flex-col gap-[12px]`}>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-[12px]">
                <div>
                  <p className="text-sm text-[#141B2E]">
                    {selected.jobTitle} · {selected.companyName}
                  </p>
                  <p className="text-xs text-[#9AA3B2]">Edit freely — changes save to this letter only.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || draftContent === selected.content}
                  className="h-[36px] shrink-0 rounded-full border border-brand-gold-dark px-[16px] text-sm text-brand-gold-dark transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
              <RichTextEditor accent="gold" value={draftContent} onChange={setDraftContent} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-[#9AA3B2]">
              Generate a cover letter to see it here.
            </div>
          )}
        </div>
      </div>
    </JobseekerDashboardShell>
  );
}

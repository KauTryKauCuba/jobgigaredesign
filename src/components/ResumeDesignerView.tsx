"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import Dropdown from "./Dropdown";
import Modal from "./Modal";
import MonthYearPicker from "./MonthYearPicker";
import RichTextEditor from "./RichTextEditor";
import { gradientFrameClass, inputClass } from "./formStyles";
import { CheckIcon, FileIcon, PlusIcon, XIcon } from "./icons";
import { useRegisterUnsavedChangesGuard } from "./UnsavedChangesGuard";
import type { AuthUser } from "./AuthModal";
import type { JobseekerProfile } from "@/lib/jobseeker-profile";
import {
  RESUME_CSS,
  RESUME_PAGE_HEIGHT,
  RESUME_PAGE_WIDTH,
  RESUME_TEMPLATES,
  renderResumeHtml,
  resumeDocument,
  type ResumeData,
  type ResumeLanguage,
  type ResumeTemplate,
} from "@/lib/resume-templates";

const QUALIFICATION_OPTIONS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"].map((v) => ({
  value: v,
  label: v,
}));
const LANGUAGE_LEVEL_OPTIONS = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
] as const;
type LanguageLevel = (typeof LANGUAGE_LEVEL_OPTIONS)[number]["value"];

const SETTINGS_KEY = "jobgiga:resumeDesigner";

type Draft = {
  fullName: string;
  targetRole: string;
  phone: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  bio: string;
  workExperiences: {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    achievements: string;
  }[];
  education: {
    id: string;
    institution: string;
    fieldOfStudy: string;
    qualificationTier: string;
    cgpa: string;
    graduationYear: string;
  }[];
  certifications: { id: string; name: string; issuer: string; year: string }[];
  professionalSkills: string[];
  softSkills: string[];
  languages: { id: string; language: string; spokenLevel: LanguageLevel; writtenLevel: LanguageLevel }[];
};

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `rz-${idCounter}`;
}

export function draftFromProfile(p: JobseekerProfile): Draft {
  return {
    fullName: p.fullName ?? "",
    targetRole: p.targetRole ?? "",
    phone: p.phone ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    portfolioUrl: p.portfolioUrl ?? "",
    githubUrl: p.githubUrl ?? "",
    bio: p.bio ?? "",
    workExperiences: p.workExperiences.map((e) => ({
      id: newId(),
      title: e.title,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate ?? "",
      isCurrent: e.isCurrent,
      achievements: e.achievements ?? "",
    })),
    education: p.education.map((e) => ({
      id: newId(),
      institution: e.institution,
      fieldOfStudy: e.fieldOfStudy ?? "",
      qualificationTier: e.qualificationTier,
      cgpa: e.cgpa ?? "",
      graduationYear: e.graduationYear ? String(e.graduationYear) : "",
    })),
    certifications: p.certifications.map((c) => ({
      id: newId(),
      name: c.name,
      issuer: c.issuer ?? "",
      year: c.year ? String(c.year) : "",
    })),
    professionalSkills: [...p.professionalSkills, ...p.otherSkills.filter((s) => !p.professionalSkills.includes(s))],
    softSkills: [...p.softSkills],
    languages: p.languages.map((l) => ({
      id: newId(),
      language: l.language,
      spokenLevel: l.spokenLevel as LanguageLevel,
      writtenLevel: l.writtenLevel as LanguageLevel,
    })),
  };
}

// Ids are client-only (for React keys) — left out so they never make the
// draft look "changed".
function withoutId<T extends { id: string }>(item: T): Omit<T, "id"> {
  const rest: Partial<T> = { ...item };
  delete rest.id;
  return rest as Omit<T, "id">;
}

function snapshot(d: Draft) {
  return JSON.stringify({
    ...d,
    workExperiences: d.workExperiences.map(withoutId),
    education: d.education.map(withoutId),
    certifications: d.certifications.map(withoutId),
    languages: d.languages.map(withoutId),
  });
}

function isBlankHtml(html: string) {
  return !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function toResumeData(d: Draft, profile: JobseekerProfile, email: string): ResumeData {
  return {
    fullName: d.fullName,
    headline: d.targetRole,
    email,
    phone: d.phone,
    location: [profile.city, profile.state].filter(Boolean).join(", "),
    linkedinUrl: d.linkedinUrl,
    portfolioUrl: d.portfolioUrl,
    githubUrl: d.githubUrl,
    avatarUrl: profile.avatarUrl,
    summaryHtml: d.bio,
    experiences: d.workExperiences.map((e) => ({
      title: e.title,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      achievementsHtml: e.achievements,
    })),
    education: d.education,
    certifications: d.certifications,
    skills: d.professionalSkills,
    softSkills: d.softSkills,
    languages: d.languages,
  };
}

/**
 * Everything the profile save endpoint expects — the fields this page edits
 * come from the draft, everything else (salary, DOB, preferences,
 * references…) is passed through unchanged from the loaded profile.
 */
export function buildProfilePayload(p: JobseekerProfile, d: Draft) {
  // The designer shows professional + "other" skills as one list. Ones that
  // were "other" stay there — unless that would leave no professional skill,
  // which the profile requires.
  let otherSkills = p.otherSkills.filter((s) => d.professionalSkills.includes(s));
  if (d.professionalSkills.every((s) => otherSkills.includes(s))) otherSkills = [];
  return {
    avatarUrl: p.avatarUrl,
    fullName: d.fullName.trim(),
    resumeUrl: null,
    resumeFileName: p.resumeFileName,
    resumeFileSize: p.resumeFileSize,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    maritalStatus: p.maritalStatus,
    nationality: p.nationality,
    phone: d.phone.trim() || null,
    drivingLicense: p.drivingLicense,
    city: p.city,
    state: p.state,
    targetRole: d.targetRole.trim(),
    preferredIndustry: p.preferredIndustry,
    yearsExperience: p.yearsExperience,
    professionalSkills: d.professionalSkills.filter((s) => !otherSkills.includes(s)),
    softSkills: d.softSkills,
    otherSkills,
    employmentType: p.employmentType,
    expectedSalaryMin: p.expectedSalaryMin,
    expectedSalaryMax: p.expectedSalaryMax,
    bio: isBlankHtml(d.bio) ? null : d.bio.trim(),
    linkedinUrl: d.linkedinUrl.trim() || null,
    portfolioUrl: d.portfolioUrl.trim() || null,
    githubUrl: d.githubUrl.trim() || null,
    noticePeriod: p.noticePeriod,
    workArrangement: p.workArrangement,
    workAuthorization: p.workAuthorization,
    workExperiences: d.workExperiences
      .filter((e) => e.company.trim() && e.title.trim() && e.startDate.trim())
      .map((e) => ({
        company: e.company.trim(),
        title: e.title.trim(),
        startDate: e.startDate.trim(),
        endDate: e.isCurrent ? null : e.endDate.trim() || null,
        isCurrent: e.isCurrent,
        achievements: isBlankHtml(e.achievements) ? null : e.achievements.trim(),
      })),
    education: d.education
      .filter((e) => e.institution.trim() && e.qualificationTier)
      .map((e) => ({
        institution: e.institution.trim(),
        fieldOfStudy: e.fieldOfStudy.trim() || null,
        qualificationTier: e.qualificationTier,
        cgpa: e.cgpa.trim() || null,
        graduationYear: /^\d{4}$/.test(e.graduationYear.trim()) ? Number(e.graduationYear) : null,
      })),
    certifications: d.certifications
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        issuer: c.issuer.trim() || null,
        year: /^\d{4}$/.test(c.year.trim()) ? Number(c.year) : null,
      })),
    languages: d.languages
      .filter((l) => l.language.trim())
      .map((l) => ({ language: l.language.trim(), spokenLevel: l.spokenLevel, writtenLevel: l.writtenLevel })),
    references: p.references.map((r) => ({
      fullName: r.fullName,
      jobTitle: r.jobTitle,
      company: r.company,
      phone: r.phone,
      email: r.email,
    })),
  };
}

type DesignSettings = { template: ResumeTemplate; lang: ResumeLanguage; showPhoto: boolean };
const SETTINGS_EVENT = "jobgiga:resume-settings";

// Display choices remembered per browser (never profile data) — read via
// useSyncExternalStore so the server render and first client render agree.
function subscribeSettings(onChange: () => void) {
  window.addEventListener(SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readSettingsRaw(): string | null {
  try {
    return localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

function parseSettings(raw: string | null): DesignSettings {
  const fallback: DesignSettings = { template: "clean", lang: "en", showPhoto: false };
  try {
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      template: RESUME_TEMPLATES.some((t) => t.value === parsed.template) ? parsed.template : fallback.template,
      lang: parsed.lang === "bm" ? "bm" : "en",
      showPhoto: parsed.showPhoto === true,
    };
  } catch {
    return fallback;
  }
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[10px] border-t border-black/[0.06] pt-[16px] first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-semibold text-[#141B2E]">{title}</p>
        {hint && <p className="mt-[2px] text-xs text-[#9AA3B2]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Nudge({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] border border-[#FBE7B5] bg-[#FFFBF0] px-[12px] py-[8px] text-xs text-[#8A6A1F]">
      💡 {children}
    </p>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-red-500"
    >
      <XIcon className="h-[12px] w-[12px]" />
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[34px] items-center justify-center gap-[6px] rounded-[12px] border border-dashed border-[#D7DCE4] text-xs text-[#4B5468] hover:border-brand-gold-dark hover:text-brand-gold-dark"
    >
      <PlusIcon className="h-[12px] w-[12px]" />
      {children}
    </button>
  );
}

function ChipsInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  function add() {
    const value = text.trim();
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setText("");
  }
  return (
    <div className="flex flex-col gap-[8px]">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-[4px] rounded-full bg-[#F1F4F8] py-[3px] pl-[10px] pr-[4px] text-xs text-[#141B2E]"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
              >
                <XIcon className="h-[8px] w-[8px]" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className={inputClass("gold")}
      />
    </div>
  );
}

/**
 * The A4 page, scaled down to fit the column. Also measures how tall the
 * content runs so the jobseeker can see whether it fits on one page.
 */
function ResumePreview({ html, onPagesChange }: { html: string; onPagesChange: (pages: number) => void }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.6);
  const [contentHeight, setContentHeight] = useState(RESUME_PAGE_HEIGHT);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / RESUME_PAGE_WIDTH)));
    observer.observe(outer);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const page = pageRef.current?.firstElementChild as HTMLElement | null;
    if (!page) return;
    function measure() {
      const height = Math.max(RESUME_PAGE_HEIGHT, page!.scrollHeight);
      setContentHeight(height);
      onPagesChange(Math.max(1, Math.ceil((height - 2) / RESUME_PAGE_HEIGHT)));
    }
    measure();
    // Photos load after the first paint and can change the height.
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [html, onPagesChange]);

  const pageBreaks = Array.from({ length: Math.ceil(contentHeight / RESUME_PAGE_HEIGHT) - 1 }, (_, i) => i + 1);

  return (
    <div ref={outerRef} className="w-full">
      <div
        className="relative overflow-hidden rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_20px_50px_-30px_rgba(20,27,46,0.35)]"
        style={{ height: contentHeight * scale }}
      >
        <div
          ref={pageRef}
          style={{ width: RESUME_PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {pageBreaks.map((n) => (
          <div
            key={n}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-red-400"
            style={{ top: n * RESUME_PAGE_HEIGHT * scale }}
          >
            <span className="absolute right-[6px] top-[2px] rounded bg-red-50 px-[6px] text-[10px] text-red-500">
              Page {n + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResumeDesignerView({
  authUser,
  resume,
  profile,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  profile: JobseekerProfile;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFromProfile(profile));
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(draftFromProfile(profile)));
  const settingsRaw = useSyncExternalStore(subscribeSettings, readSettingsRaw, () => null);
  const storedSettings = useMemo(() => parseSettings(settingsRaw), [settingsRaw]);
  const [fallbackSettings, setFallbackSettings] = useState<DesignSettings | null>(null);
  const settings = fallbackSettings ?? storedSettings;
  const { template, lang, showPhoto } = settings;
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [pages, setPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);

  function updateSettings(next: Partial<DesignSettings>) {
    const merged = { ...settings, ...next };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event(SETTINGS_EVENT));
    } catch {
      // Storage unavailable (private mode) — keep the choice in memory only.
      setFallbackSettings(merged);
    }
  }

  const isDirty = snapshot(draft) !== savedSnapshot;
  function guardNavigation(proceed: () => void) {
    if (isDirty) setPendingProceed(() => proceed);
    else proceed();
  }
  useRegisterUnsavedChangesGuard(guardNavigation);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const html = useMemo(
    () => renderResumeHtml(toResumeData(draft, profile, authUser.email), template, lang, { showPhoto }),
    [draft, profile, authUser.email, template, lang, showPhoto],
  );

  function patch(changes: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...changes }));
    setStatus(null);
  }
  function updateItem<K extends "workExperiences" | "education" | "certifications" | "languages">(
    key: K,
    id: string,
    changes: Partial<Draft[K][number]>,
  ) {
    setDraft((d) => ({ ...d, [key]: (d[key] as Draft[K]).map((item) => (item.id === id ? { ...item, ...changes } : item)) }));
    setStatus(null);
  }
  function removeItem(key: "workExperiences" | "education" | "certifications" | "languages", id: string) {
    setDraft((d) => ({ ...d, [key]: (d[key] as { id: string }[]).filter((item) => item.id !== id) }));
    setStatus(null);
  }

  async function handleSave(): Promise<boolean> {
    if (!draft.fullName.trim()) {
      setStatus({ kind: "error", message: "Enter your full name." });
      return false;
    }
    if (!draft.targetRole.trim()) {
      setStatus({ kind: "error", message: "Enter your headline (the role you're targeting)." });
      return false;
    }
    if (draft.professionalSkills.length === 0) {
      setStatus({ kind: "error", message: "Add at least one skill." });
      return false;
    }
    // The profile drops jobs without a title, company and start date — say so
    // rather than letting a half-filled job silently vanish on save.
    const incompleteJob = draft.workExperiences.find(
      (e) => (e.title.trim() || e.company.trim() || !isBlankHtml(e.achievements)) && (!e.title.trim() || !e.company.trim() || !e.startDate.trim()),
    );
    if (incompleteJob) {
      setStatus({
        kind: "error",
        message: `Add the job title, company and start date for “${incompleteJob.title.trim() || incompleteJob.company.trim() || "a job"}” — or remove it.`,
      });
      return false;
    }
    const incompleteEducation = draft.education.find(
      (e) => !e.institution.trim() && (e.fieldOfStudy.trim() || e.cgpa.trim() || e.graduationYear.trim()),
    );
    if (incompleteEducation) {
      setStatus({ kind: "error", message: "Add the institution name for each education entry — or remove it." });
      return false;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProfilePayload(profile, draft)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your resume.");
      setSavedSnapshot(snapshot(draft));
      setStatus({ kind: "ok", message: "Saved — your profile is updated too." });
      router.refresh();
      return true;
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save your resume." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    const win = window.open("", "_blank");
    if (!win) {
      setStatus({ kind: "error", message: "Allow pop-ups for this site to download your resume." });
      return;
    }
    const title = `${draft.fullName.trim() || "Resume"} - Resume`;
    // The print window is about:blank — a <base> makes the photo's relative
    // /uploads/... URL resolve against this site.
    win.document.write(resumeDocument(title, html, window.location.origin));
    win.document.close();
    // Wait for the photo (if any) before printing.
    const print = () => {
      win.focus();
      win.print();
    };
    if (win.document.readyState === "complete") setTimeout(print, 250);
    else win.addEventListener("load", () => setTimeout(print, 100));
  }

  const nudges: string[] = [];
  if (isBlankHtml(draft.bio)) nudges.push("Add a 2–3 line summary at the top — it's the first thing recruiters read.");
  if (draft.workExperiences.some((e) => isBlankHtml(e.achievements)))
    nudges.push("Add 2–3 achievements under each job — numbers stand out (e.g. “served 80+ customers a day”).");
  if (draft.education.length === 0) nudges.push("Add your education — even SPM or STPM counts.");
  if (!draft.phone.trim()) nudges.push("Add a phone number so employers can reach you.");

  const segment = (active: boolean) =>
    `flex-1 rounded-full px-[12px] py-[6px] text-xs transition-colors ${
      active ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
    }`;

  const editor = (
    <div className={`animate-fade-in-up min-w-0 ${gradientFrameClass("gold")}`}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
        <SectionCard title="Basics">
          <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
            <div>
              <label htmlFor="rz-name" className="mb-[6px] block text-xs text-[#4B5468]">Full name</label>
              <input id="rz-name" value={draft.fullName} onChange={(e) => patch({ fullName: e.target.value })} className={inputClass("gold")} />
            </div>
            <div>
              <label htmlFor="rz-role" className="mb-[6px] block text-xs text-[#4B5468]">Headline</label>
              <input
                id="rz-role"
                value={draft.targetRole}
                onChange={(e) => patch({ targetRole: e.target.value })}
                placeholder="e.g. Marketing Executive"
                className={inputClass("gold")}
              />
            </div>
            <div>
              <label htmlFor="rz-phone" className="mb-[6px] block text-xs text-[#4B5468]">Phone</label>
              <input id="rz-phone" value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} className={inputClass("gold")} />
            </div>
            <div>
              <label className="mb-[6px] block text-xs text-[#4B5468]">Email</label>
              <p className="flex h-[38px] items-center truncate rounded-[12px] bg-[#F8FAFB] px-[14px] text-sm text-[#4B5468]">
                {authUser.email}
              </p>
            </div>
            <div>
              <label htmlFor="rz-linkedin" className="mb-[6px] block text-xs text-[#4B5468]">LinkedIn (optional)</label>
              <input id="rz-linkedin" value={draft.linkedinUrl} onChange={(e) => patch({ linkedinUrl: e.target.value })} className={inputClass("gold")} />
            </div>
            <div>
              <label htmlFor="rz-portfolio" className="mb-[6px] block text-xs text-[#4B5468]">Portfolio (optional)</label>
              <input id="rz-portfolio" value={draft.portfolioUrl} onChange={(e) => patch({ portfolioUrl: e.target.value })} className={inputClass("gold")} />
            </div>
          </div>
          <p className="text-xs text-[#9AA3B2]">
            Your location ({[profile.city, profile.state].filter(Boolean).join(", ")}) comes from My Profile. Your IC
            number, age and marital status are never shown — employers don&rsquo;t need them.
          </p>
        </SectionCard>

        <SectionCard title="Summary" hint="2–3 lines on who you are and what you're great at.">
          <RichTextEditor value={draft.bio} onChange={(bio) => patch({ bio })} placeholder="e.g. Marketing executive with 4 years in FMCG…" accent="gold" />
        </SectionCard>

        <SectionCard title="Work experience">
          {draft.workExperiences.map((e) => (
            <div key={e.id} className="flex flex-col gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
              <div className="flex items-start gap-[8px]">
                <div className="grid flex-1 grid-cols-1 gap-[8px] sm:grid-cols-2">
                  <input value={e.title} onChange={(ev) => updateItem("workExperiences", e.id, { title: ev.target.value })} placeholder="Job title" className={inputClass("gold")} />
                  <input value={e.company} onChange={(ev) => updateItem("workExperiences", e.id, { company: ev.target.value })} placeholder="Company" className={inputClass("gold")} />
                </div>
                <RemoveButton onClick={() => removeItem("workExperiences", e.id)} label="Remove job" />
              </div>
              <div className="grid grid-cols-2 gap-[8px]">
                <MonthYearPicker value={e.startDate} onChange={(v) => updateItem("workExperiences", e.id, { startDate: v })} accent="gold" />
                <MonthYearPicker value={e.endDate} onChange={(v) => updateItem("workExperiences", e.id, { endDate: v })} disabled={e.isCurrent} accent="gold" />
              </div>
              <label className="flex items-center gap-[8px] text-xs text-[#4B5468]">
                <input
                  type="checkbox"
                  checked={e.isCurrent}
                  onChange={(ev) => updateItem("workExperiences", e.id, { isCurrent: ev.target.checked })}
                  className="h-[14px] w-[14px] accent-brand-gold-dark"
                />
                I currently work here
              </label>
              <RichTextEditor
                value={e.achievements}
                onChange={(achievements) => updateItem("workExperiences", e.id, { achievements })}
                placeholder="Key achievements — use a bullet list"
                accent="gold"
              />
            </div>
          ))}
          <AddButton
            onClick={() =>
              patch({
                workExperiences: [
                  ...draft.workExperiences,
                  { id: newId(), title: "", company: "", startDate: "", endDate: "", isCurrent: false, achievements: "" },
                ],
              })
            }
          >
            Add a job
          </AddButton>
        </SectionCard>

        <SectionCard title="Education">
          {draft.education.map((e) => (
            <div key={e.id} className="flex flex-col gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
              <div className="flex items-start gap-[8px]">
                <input value={e.institution} onChange={(ev) => updateItem("education", e.id, { institution: ev.target.value })} placeholder="Institution" className={inputClass("gold")} />
                <RemoveButton onClick={() => removeItem("education", e.id)} label="Remove education" />
              </div>
              <input value={e.fieldOfStudy} onChange={(ev) => updateItem("education", e.id, { fieldOfStudy: ev.target.value })} placeholder="Field of study (optional)" className={inputClass("gold")} />
              <div className="grid grid-cols-3 gap-[8px]">
                <Dropdown
                  label="Qualification"
                  value={e.qualificationTier}
                  options={QUALIFICATION_OPTIONS}
                  onChange={(v) => updateItem("education", e.id, { qualificationTier: v })}
                  accent="gold"
                />
                <input value={e.cgpa} onChange={(ev) => updateItem("education", e.id, { cgpa: ev.target.value })} placeholder="CGPA" className={inputClass("gold")} />
                <input
                  value={e.graduationYear}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(ev) => updateItem("education", e.id, { graduationYear: ev.target.value.replace(/\D/g, "") })}
                  placeholder="Year"
                  className={inputClass("gold")}
                />
              </div>
            </div>
          ))}
          <AddButton
            onClick={() =>
              patch({
                education: [
                  ...draft.education,
                  { id: newId(), institution: "", fieldOfStudy: "", qualificationTier: "Degree", cgpa: "", graduationYear: "" },
                ],
              })
            }
          >
            Add education
          </AddButton>
        </SectionCard>

        <SectionCard title="Skills" hint="Press Enter after each one.">
          <ChipsInput values={draft.professionalSkills} onChange={(professionalSkills) => patch({ professionalSkills })} placeholder="Add a skill, e.g. Canva" />
          <p className="text-xs text-[#4B5468]">Soft skills</p>
          <ChipsInput values={draft.softSkills} onChange={(softSkills) => patch({ softSkills })} placeholder="Add a soft skill, e.g. Teamwork" />
        </SectionCard>

        <SectionCard title="Certifications">
          {draft.certifications.map((c) => (
            <div key={c.id} className="flex items-start gap-[8px]">
              <div className="grid flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_70px] gap-[8px]">
                <input value={c.name} onChange={(ev) => updateItem("certifications", c.id, { name: ev.target.value })} placeholder="Certificate" className={inputClass("gold")} />
                <input value={c.issuer} onChange={(ev) => updateItem("certifications", c.id, { issuer: ev.target.value })} placeholder="Issuer" className={inputClass("gold")} />
                <input
                  value={c.year}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(ev) => updateItem("certifications", c.id, { year: ev.target.value.replace(/\D/g, "") })}
                  placeholder="Year"
                  className={inputClass("gold")}
                />
              </div>
              <RemoveButton onClick={() => removeItem("certifications", c.id)} label="Remove certification" />
            </div>
          ))}
          <AddButton onClick={() => patch({ certifications: [...draft.certifications, { id: newId(), name: "", issuer: "", year: "" }] })}>
            Add certification
          </AddButton>
        </SectionCard>

        <SectionCard title="Languages">
          {draft.languages.map((l) => (
            <div key={l.id} className="flex items-start gap-[8px]">
              <div className="grid flex-1 grid-cols-2 gap-[8px]">
                <input value={l.language} onChange={(ev) => updateItem("languages", l.id, { language: ev.target.value })} placeholder="Language" className={inputClass("gold")} />
                <Dropdown
                  label="Level"
                  value={l.spokenLevel}
                  options={[...LANGUAGE_LEVEL_OPTIONS]}
                  onChange={(v) => updateItem("languages", l.id, { spokenLevel: v, writtenLevel: v })}
                  accent="gold"
                />
              </div>
              <RemoveButton onClick={() => removeItem("languages", l.id)} label="Remove language" />
            </div>
          ))}
          <AddButton
            onClick={() =>
              patch({
                languages: [...draft.languages, { id: newId(), language: "", spokenLevel: "conversational", writtenLevel: "conversational" }],
              })
            }
          >
            Add language
          </AddButton>
        </SectionCard>
      </div>
    </div>
  );

  const preview = (
    <div className="flex min-w-0 flex-col gap-[12px] lg:sticky lg:top-[85px]">
      <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
        <div className="flex flex-col gap-[12px] rounded-[19px] bg-white p-[14px] text-left">
          <div className="flex flex-wrap gap-[8px]">
            {RESUME_TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => updateSettings({ template: t.value })}
                title={t.description}
                className={`flex h-[34px] items-center gap-[6px] rounded-full border px-[14px] text-xs transition-colors ${
                  template === t.value
                    ? "border-brand-gold-dark bg-[#FFF3D6] text-[#141B2E]"
                    : "border-black/[0.1] text-[#4B5468] hover:bg-black/[0.03]"
                }`}
              >
                {template === t.value && <CheckIcon className="h-[10px] w-[10px] text-brand-gold-dark" />}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-[12px]">
            <div className="flex w-[120px] rounded-full bg-[#F1F4F8] p-[3px]" role="group" aria-label="Section headings language">
              <button type="button" onClick={() => updateSettings({ lang: "en" })} className={segment(lang === "en")}>
                EN
              </button>
              <button type="button" onClick={() => updateSettings({ lang: "bm" })} className={segment(lang === "bm")}>
                BM
              </button>
            </div>
            {profile.avatarUrl && (
              <label className="flex items-center gap-[8px] text-xs text-[#4B5468]">
                <input
                  type="checkbox"
                  checked={showPhoto}
                  onChange={(e) => updateSettings({ showPhoto: e.target.checked })}
                  className="h-[14px] w-[14px] accent-brand-gold-dark"
                />
                Show my photo
              </label>
            )}
            <span
              className={`ml-auto rounded-full px-[10px] py-[3px] text-xs ${
                pages === 1 ? "bg-[#E7F6EC] text-[#2F7D4F]" : "bg-red-50 text-red-500"
              }`}
            >
              {pages === 1 ? "✓ Fits on 1 page" : `Runs to ${pages} pages`}
            </span>
          </div>
        </div>
      </div>
      <ResumePreview html={html} onPagesChange={setPages} />
    </div>
  );

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="resumeDesigner"
      heading="Resume Designer"
      subheading="Pick a template and edit live — what you see is exactly what you download."
      resume={resume}
      headerAction={
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-[38px] items-center gap-[6px] rounded-full border border-black/[0.1] bg-white px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
          >
            <FileIcon className="h-[14px] w-[14px]" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex h-[38px] items-center rounded-full bg-[#FFE9A6] px-[18px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
          </button>
        </div>
      }
    >
      <style>{RESUME_CSS}</style>
      <div className="flex flex-col gap-[14px]">
        {status && (
          <p
            className={`rounded-[12px] px-[14px] py-[10px] text-sm ${
              status.kind === "error" ? "bg-red-50 text-red-600" : "bg-[#E7F6EC] text-[#2F7D4F]"
            }`}
          >
            {status.message}
          </p>
        )}
        {nudges.length > 0 && (
          <div className="flex flex-col gap-[6px]">
            {nudges.slice(0, 2).map((n) => (
              <Nudge key={n}>{n}</Nudge>
            ))}
          </div>
        )}

        {/* Phones/tablets: Edit and Preview as two tabs. Desktop: side by side. */}
        <div className="flex w-full max-w-[280px] rounded-full bg-[#F1F4F8] p-[4px] lg:hidden" role="tablist">
          <button type="button" role="tab" aria-selected={mobileTab === "edit"} onClick={() => setMobileTab("edit")} className={segment(mobileTab === "edit")}>
            Edit
          </button>
          <button type="button" role="tab" aria-selected={mobileTab === "preview"} onClick={() => setMobileTab("preview")} className={segment(mobileTab === "preview")}>
            Preview
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-[20px] lg:grid-cols-2">
          <div className={mobileTab === "edit" ? "" : "hidden lg:block"}>{editor}</div>
          <div className={mobileTab === "preview" ? "" : "hidden lg:block"}>{preview}</div>
        </div>
      </div>

      {pendingProceed && (
        <Modal ariaLabel="Leave without saving?" onClose={() => setPendingProceed(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Leave without saving?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            You&rsquo;ve edited your resume but haven&rsquo;t saved it yet. Save it before you go, or discard your changes.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={saving}
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
    </JobseekerDashboardShell>
  );
}

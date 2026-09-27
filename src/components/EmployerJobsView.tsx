"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COMPANIES_CHANGED_EVENT } from "./CompanySwitcher";
import Dropdown from "./Dropdown";
import EmployerDashboardShell from "./EmployerDashboardShell";
import Field from "./Field";
import Modal from "./Modal";
import RichTextEditor from "./RichTextEditor";
import { useRegisterUnsavedChangesGuard, type NavigationGuard } from "./UnsavedChangesGuard";

// Invisible — exists only to call useRegisterUnsavedChangesGuard from a
// genuine descendant of EmployerDashboardShell's UnsavedChangesGuardBoundary
// (rendered as one of its `children`, see the usage below for why this can't
// just be a hook call in EmployerJobsView's own body).
// Matches MAX_SUGGESTIONS in the suggest-skills API route — manual entry
// had no cap while AI suggestions did, letting someone paste far more
// skills than the AI path could ever produce.
const MAX_MANUAL_SKILLS = 40;

// Skill tags are compared case-insensitively so "JavaScript" and
// "javascript" can't both end up on the same posting as separate entries —
// a plain .includes() only catches exact-case duplicates.
function includesSkillCaseInsensitive(list: string[], value: string): boolean {
  const target = value.toLowerCase();
  return list.some((s) => s.toLowerCase() === target);
}

function GuardRegistrar({ guard }: { guard: NavigationGuard }) {
  useRegisterUnsavedChangesGuard(guard);
  return null;
}
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import {
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  DotsIcon,
  DraftIcon,
  EyeIcon,
  FlagIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  StackIcon,
  TrashIcon,
  XCircleIcon,
  XIcon,
} from "./icons";
import JobTitleIllustration from "./JobTitleIllustration";
import SiriOrb from "./SiriOrb";
import type { AuthUser } from "./AuthModal";
import type { EmployerAddress } from "@/lib/employer-profile";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { INDUSTRIES } from "@/lib/industries";
import { DUMMY_POSTING_MARKER } from "@/lib/dummy-job-postings";
import { plainTextToHtml } from "@/lib/richText";

// Matches the finalized (but not yet built) `job_posting_status` enum in
// full — draft -> pending (awaiting superadmin approval) -> active ->
// filled/closed, plus the two review-loop states: rejected (superadmin
// rejects at the initial pending review) and flagged (superadmin flags an
// already-active posting after a jobseeker report).
type JobStatus = "Draft" | "Pending" | "Active" | "Filled" | "Closed" | "Rejected" | "Flagged";

type PreviewPosting = {
  title: string;
  status: JobStatus;
  applicants: number;
  views: number;
  posted: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  salaryMin: number;
  salaryMax: number;
  openings: number;
  minYearsExperience: number;
  rejectionReason: string | null;
  flagReason: string | null;
};

const STATUS_ORDER: JobStatus[] = ["Active", "Draft", "Pending", "Filled", "Closed", "Rejected", "Flagged"];

// One distinct hue per tile so the row is scannable at a glance — deliberately
// broader than STATUS_CLASS's palette, which only needs to distinguish status
// pills inline with text and reuses teal/gold for two different statuses.
const STATUS_TILE_COLOR: Record<"Total postings" | JobStatus, { bg: string; border: string; text: string }> = {
  "Total postings": { bg: "bg-[#F1F4F8]", border: "border-[#E4E9F0]", text: "text-[#4B5468]" },
  Active: { bg: "bg-[#E6F9FA]", border: "border-[#CFF4F6]", text: "text-[#008990]" },
  Pending: { bg: "bg-[#FFF3D6]", border: "border-[#FBE7B3]", text: "text-[#A67C00]" },
  Filled: { bg: "bg-[#E7F6EC]", border: "border-[#CDEBD8]", text: "text-[#2F9E56]" },
  Closed: { bg: "bg-black/[0.04]", border: "border-black/[0.08]", text: "text-[#9AA3B2]" },
  Draft: { bg: "bg-[#F1ECFB]", border: "border-[#E1D6F5]", text: "text-[#7C5CD1]" },
  Rejected: { bg: "bg-red-50", border: "border-red-100", text: "text-red-500" },
  Flagged: { bg: "bg-[#FFEFE3]", border: "border-[#FBDBBE]", text: "text-[#C2600A]" },
};

// Same deeper/saturated pastel a tile's STATUS_TILE_COLOR.bg approximates —
// used as the gradient-to-white start color + the watermark icon's
// --icon-accent, matching the treatment on the dashboard's Overview tiles.
const STATUS_TILE_GRADIENT: Record<"Total postings" | JobStatus, string> = {
  "Total postings": "#C9CFDA",
  Active: "#8CE6D9",
  Pending: "#FFE1A1",
  Filled: "#A5EBB9",
  Closed: "#D4D7DC",
  Draft: "#D4C6F7",
  Rejected: "#F9B9B9",
  Flagged: "#FFCDA1",
};

const STATUS_TILE_ICON: Record<
  "Total postings" | JobStatus,
  (props: { className?: string; strokeWidth?: number; style?: React.CSSProperties }) => ReactElement
> = {
  "Total postings": StackIcon,
  Active: BoltIcon,
  Pending: ClockIcon,
  Filled: CheckCircleIcon,
  Closed: LockIcon,
  Draft: DraftIcon,
  Rejected: XCircleIcon,
  Flagged: FlagIcon,
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;
const WORK_ARRANGEMENTS = [
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;
// Matches jobseekerEducation.qualificationTier exactly (see seed.ts /
// OnboardingForm's QUALIFICATION_TIERS) so "minimum education" can be
// compared directly against a jobseeker's highest completed tier.
const QUALIFICATION_TIERS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"] as const;
// Field ids that only render on the screening step — goToField uses this to
// switch steps before it tries to scroll to one of them.
const SCREENING_FIELD_IDS = new Set(["minYearsExperience", "minQualificationTier", "languageInput", "workAuthorizations", "customQuestionInput"]);
type CustomQuestion = { id: string; question: string; requiredAnswer: boolean };
// Matches jobseekerProfiles.workAuthorization exactly.
const WORK_AUTHORIZATIONS = [
  { value: "citizen", label: "Malaysian citizen" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "work_pass_holder", label: "Work pass holder" },
  { value: "needs_sponsorship", label: "Open to sponsorship" },
] as const;
// Matches jobseekerProfiles.drivingLicense exactly; "Not required" means the
// field is simply left empty.
const DRIVING_LICENSES = [
  { value: "b2", label: "B2 (motorcycle)" },
  { value: "b", label: "B (car)" },
  { value: "d", label: "D (bus)" },
  { value: "da", label: "DA (bus + trailer)" },
  { value: "e", label: "E (lorry)" },
] as const;
// Matches jobseekerLanguages.spokenLevel/writtenLevel exactly.
const LANGUAGE_LEVELS = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
] as const;
type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]["value"];
type RequiredLanguage = { language: string; level: LanguageLevel };

// Shown next to a field's label so the mapping to a jobseeker-profile field
// is visible on the form itself, not just documented in comments.
function MatchHint({ field }: { field: string | string[] }) {
  const fields = Array.isArray(field) ? field.join(" + ") : field;
  return (
    <span className="rounded-full bg-[#E6F9FA] px-[8px] py-[2px] text-xs whitespace-nowrap text-[#008990]">
      ↔ {fields}
    </span>
  );
}

function NoMatchHint() {
  return (
    <span className="rounded-full bg-[#F1F4F8] px-[8px] py-[2px] text-xs whitespace-nowrap text-[#9AA3B2]">
      No jobseeker match yet
    </span>
  );
}

// Per-requirement opt-in for the screening step — lets the employer exclude
// a specific question (e.g. one the AI filled in) from what applicants are
// asked, without having to clear its value back out.
function AskToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="ml-auto flex items-center gap-[6px] text-xs whitespace-nowrap text-[#4B5468]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[13px] w-[13px] accent-brand-teal-dark"
      />
      {label}
    </label>
  );
}

const inputClass = formInputClass("teal");

export type PostJobFormHandle = { guardNavigation: (proceed: () => void) => void };

const PostJobForm = forwardRef<PostJobFormHandle, { onClose: () => void; addresses: EmployerAddress[] }>(
  function PostJobForm({ onClose, addresses }, ref) {
  const searchParams = useSearchParams();
  const editingId = searchParams.get("id");
  const [loadingExisting, setLoadingExisting] = useState(() => !!editingId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [postingName, setPostingName] = useState("");
  const [title, setTitle] = useState(() => searchParams.get("title") ?? "");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number] | "">("");
  const [employmentType, setEmploymentType] = useState<(typeof EMPLOYMENT_TYPES)[number]["value"]>("full_time");
  const [workArrangement, setWorkArrangement] = useState<(typeof WORK_ARRANGEMENTS)[number]["value"]>("onsite");
  const [location, setLocation] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState<(typeof MALAYSIA_STATES)[number] | "">("");
  const [postcode, setPostcode] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [openings, setOpenings] = useState("1");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [softSkills, setSoftSkills] = useState<string[]>([]);
  const [softSkillInput, setSoftSkillInput] = useState("");
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>([]);
  const [niceToHaveSkillInput, setNiceToHaveSkillInput] = useState("");

  // Hard filters — structured requirements matched exactly against a
  // jobseeker profile (years of experience, education tier, languages,
  // work authorization, driving license) to narrow the candidate pool,
  // separate from the free-text fields above that an AI matcher ranks by
  // semantic fit against the posting.
  const [minYearsExperience, setMinYearsExperience] = useState("");
  const [minQualificationTier, setMinQualificationTier] = useState<(typeof QUALIFICATION_TIERS)[number] | "">("");
  const [languages, setLanguages] = useState<RequiredLanguage[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  const [languageLevelInput, setLanguageLevelInput] = useState<LanguageLevel>("conversational");
  const [workAuthorizations, setWorkAuthorizations] = useState<string[]>([]);
  const [drivingLicense, setDrivingLicense] = useState<(typeof DRIVING_LICENSES)[number]["value"] | "">("");
  // Master switch for the block above — off by default so a new posting
  // never silently asks applicants anything until the employer explicitly
  // opts in on the screening step.
  const [screeningEnabled, setScreeningEnabled] = useState(false);
  // Per-requirement opt-in — lets the employer pick exactly which of the
  // structured questions below actually get asked, independent of whether a
  // value is filled in (so e.g. an AI-filled minimum experience can be
  // excluded from the applicant-facing questions without having to blank
  // the field back out). Defaults to true so a freshly filled-in field asks
  // by default, matching the pre-existing "filled = asked" behavior.
  const [askMinExperience, setAskMinExperience] = useState(true);
  const [askMinEducation, setAskMinEducation] = useState(true);
  const [askDrivingLicense, setAskDrivingLicense] = useState(true);
  const [askLanguages, setAskLanguages] = useState(true);
  const [askWorkAuthorizations, setAskWorkAuthorizations] = useState(true);
  // Free-form yes/no questions beyond the structured fields above — kept
  // auto-scorable (yes/no, not open text) so they still fit the same
  // pass/fail screeningEligibilityCheck as the rest of screening.
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [customQuestionInput, setCustomQuestionInput] = useState("");
  const [customQuestionRequiredAnswer, setCustomQuestionRequiredAnswer] = useState(true);
  const [formStep, setFormStep] = useState<"details" | "screening">("details");

  function addCustomQuestion() {
    const value = customQuestionInput.trim();
    if (!value) return;
    setCustomQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), question: value, requiredAnswer: customQuestionRequiredAnswer },
    ]);
    setCustomQuestionInput("");
  }

  function removeCustomQuestion(id: string) {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  const [aiFillLoading, setAiFillLoading] = useState(false);
  const [aiFillError, setAiFillError] = useState<string | null>(null);
  const [aiFillStatus, setAiFillStatus] = useState<string | null>(null);
  const [aiFillElapsedMs, setAiFillElapsedMs] = useState(0);
  const [aiFillTokens, setAiFillTokens] = useState<number | null>(null);
  const [aiFillDurationMs, setAiFillDurationMs] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showJobseekerPreview, setShowJobseekerPreview] = useState(false);

  // Same "Suggest skills" flow as the jobseeker onboarding form
  // (/api/jobseeker/suggest-skills), just driven by the job title instead
  // of a target role, and with a third niceToHaveSkills bucket to match
  // this form's three skill fields.
  // Persisted with the posting itself (jobPostings.skillSuggestions), not
  // just local browser state — otherwise a refresh, or reopening the draft
  // from a different browser/device, silently threw away suggestions the
  // employer hadn't reviewed yet, forcing them to re-run "Suggest skills"
  // and burn another AI call for the same job title. Loaded from the saved
  // posting in the edit-mode fetch effect below; stays null for a brand new
  // posting until the first "Suggest skills" click, same as every other
  // field on this form that only exists once something's been typed/saved.
  const [skillSuggestions, setSkillSuggestions] = useState<{
    professionalSkills: string[];
    softSkills: string[];
    niceToHaveSkills: string[];
  } | null>(null);
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [suggestSkillsError, setSuggestSkillsError] = useState<string | null>(null);
  const [suggestSkillsStatus, setSuggestSkillsStatus] = useState<string | null>(null);
  const [suggestSkillsElapsedMs, setSuggestSkillsElapsedMs] = useState(0);
  const [suggestSkillsTokens, setSuggestSkillsTokens] = useState<number | null>(null);
  const [suggestSkillsDurationMs, setSuggestSkillsDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (!showPreview && !showJobseekerPreview) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPreview(false);
        setShowJobseekerPreview(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showPreview, showJobseekerPreview]);

  useEffect(() => {
    if (!suggestingSkills) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setSuggestSkillsElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [suggestingSkills]);

  async function suggestSkills() {
    if (!title.trim()) {
      setSuggestSkillsError("Enter a job title first.");
      return;
    }
    setSuggestingSkills(true);
    setSuggestSkillsError(null);
    setSuggestSkillsStatus(null);
    setSuggestSkillsElapsedMs(0);
    setSuggestSkillsTokens(null);
    setSuggestSkillsDurationMs(null);
    try {
      const res = await fetch("/api/employer/suggest-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't suggest skills.");
      setSkillSuggestions({
        professionalSkills: (data.suggestions?.professionalSkills ?? []).filter(
          (s: string) => !includesSkillCaseInsensitive(skills, s),
        ),
        softSkills: (data.suggestions?.softSkills ?? []).filter(
          (s: string) => !includesSkillCaseInsensitive(softSkills, s),
        ),
        niceToHaveSkills: (data.suggestions?.niceToHaveSkills ?? []).filter(
          (s: string) => !includesSkillCaseInsensitive(niceToHaveSkills, s),
        ),
      });
      setSuggestSkillsTokens(typeof data.usage?.total_tokens === "number" ? data.usage.total_tokens : null);
      setSuggestSkillsDurationMs(typeof data.durationMs === "number" ? data.durationMs : null);
      setSuggestSkillsStatus("Suggested — review before adding.");
    } catch (err) {
      setSuggestSkillsError(err instanceof Error ? err.message : "Couldn't suggest skills.");
    } finally {
      setSuggestingSkills(false);
    }
  }

  function addSuggestedSkill(skill: string) {
    setSkills((prev) =>
      includesSkillCaseInsensitive(prev, skill) || prev.length >= MAX_MANUAL_SKILLS ? prev : [...prev, skill],
    );
    setSkillSuggestions((prev) =>
      prev ? { ...prev, professionalSkills: prev.professionalSkills.filter((s) => s !== skill) } : prev,
    );
  }

  function addSuggestedSoftSkill(skill: string) {
    setSoftSkills((prev) =>
      includesSkillCaseInsensitive(prev, skill) || prev.length >= MAX_MANUAL_SKILLS ? prev : [...prev, skill],
    );
    setSkillSuggestions((prev) => (prev ? { ...prev, softSkills: prev.softSkills.filter((s) => s !== skill) } : prev));
  }

  function addSuggestedNiceToHaveSkill(skill: string) {
    setNiceToHaveSkills((prev) =>
      includesSkillCaseInsensitive(prev, skill) || prev.length >= MAX_MANUAL_SKILLS ? prev : [...prev, skill],
    );
    setSkillSuggestions((prev) =>
      prev ? { ...prev, niceToHaveSkills: prev.niceToHaveSkills.filter((s) => s !== skill) } : prev,
    );
  }

  useEffect(() => {
    if (!aiFillLoading) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setAiFillElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [aiFillLoading]);

  // Carries an auto-fill request over from the "Start with your job title"
  // card on the Manage Job list page — the title itself is seeded straight
  // into useState above, this just resumes the AI draft that was requested
  // there so the employer doesn't have to click Fill with AI twice.
  useEffect(() => {
    const initialTitle = searchParams.get("title");
    if (initialTitle && searchParams.get("autofill") === "1") handleAiFill(initialTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loads an existing posting's fields when arriving via "Edit" on the
  // Manage Job list (?id=<uuid>) — everything above defaults to blank/new.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/employer/job-postings/${editingId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load this posting.");
        if (cancelled) return;
        const posting = data.posting as DbJobPosting;
        setPostingName(posting.postingName ?? "");
        setTitle(posting.title);
        setDescription(plainTextToHtml(posting.description));
        setResponsibilities(plainTextToHtml(posting.responsibilities));
        setIndustry((posting.industry as (typeof INDUSTRIES)[number] | null) ?? "");
        setEmploymentType(posting.employmentType as (typeof EMPLOYMENT_TYPES)[number]["value"]);
        setWorkArrangement(posting.workArrangement as (typeof WORK_ARRANGEMENTS)[number]["value"]);
        setLocation(posting.location);
        setAddressLine1(posting.addressLine1 ?? "");
        setAddressLine2(posting.addressLine2 ?? "");
        setCity(posting.city ?? "");
        setState((posting.state as (typeof MALAYSIA_STATES)[number] | null) ?? "");
        setPostcode(posting.postcode ?? "");
        setSalaryMin(posting.salaryMin !== null ? String(posting.salaryMin) : "");
        setSalaryMax(posting.salaryMax !== null ? String(posting.salaryMax) : "");
        setOpenings(String(posting.openings));
        setSkills(posting.skills);
        setSoftSkills(posting.softSkills);
        setNiceToHaveSkills(posting.niceToHaveSkills);
        setMinYearsExperience(posting.minYearsExperience !== null ? String(posting.minYearsExperience) : "");
        setMinQualificationTier((posting.minQualificationTier as (typeof QUALIFICATION_TIERS)[number] | null) ?? "");
        setLanguages(posting.languages as RequiredLanguage[]);
        setWorkAuthorizations(posting.workAuthorizations);
        setDrivingLicense((posting.drivingLicense as (typeof DRIVING_LICENSES)[number]["value"] | null) ?? "");
        setScreeningEnabled(posting.screeningEnabled);
        // Loaded straight from their own saved flags, not derived from
        // whether the requirement's own value is set — an employer can
        // tick "Ask this" before (or without ever) filling the field in,
        // and that toggle state needs to survive independent of the value.
        setAskMinExperience(posting.askMinYearsExperience);
        setAskMinEducation(posting.askMinQualificationTier);
        setAskDrivingLicense(posting.askDrivingLicense);
        setAskLanguages(posting.askLanguages);
        setAskWorkAuthorizations(posting.askWorkAuthorizations);
        setCustomQuestions(posting.customScreeningQuestions);
        setSkillSuggestions(posting.skillSuggestions);
      } catch (err) {
        if (!cancelled) setSubmitError(err instanceof Error ? err.message : "Couldn't load this posting.");
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  async function handleAiFill(titleOverride?: string) {
    const jobTitle = (titleOverride ?? title).trim();
    if (!jobTitle) return;
    setAiFillLoading(true);
    setAiFillError(null);
    setAiFillStatus(null);
    setAiFillElapsedMs(0);
    setAiFillTokens(null);
    setAiFillDurationMs(null);
    try {
      const res = await fetch("/api/employer/suggest-job-posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Couldn't generate a suggestion.");
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate a suggestion.");
      const result = data.result as {
        description: string | null;
        responsibilities: string | null;
        industry: (typeof INDUSTRIES)[number] | null;
        employmentType: (typeof EMPLOYMENT_TYPES)[number]["value"] | null;
        workArrangement: (typeof WORK_ARRANGEMENTS)[number]["value"] | null;
        salaryMin: number | null;
        salaryMax: number | null;
        skills: string[];
        softSkills: string[];
        niceToHaveSkills: string[];
        minYearsExperience: number | null;
        minQualificationTier: (typeof QUALIFICATION_TIERS)[number] | null;
        languages: { language: string; level: LanguageLevel }[];
        workAuthorizations: string[];
        drivingLicense: (typeof DRIVING_LICENSES)[number]["value"] | null;
      };

      // Only fills fields the employer hasn't already set by hand — same
      // rule as the company-profile "Fill with AI", so a generated
      // suggestion never clobbers a manual edit.
      if (result.description) {
        setDescription((prev) => (prev.trim() ? prev : plainTextToHtml(result.description as string)));
      }
      if (result.responsibilities) {
        setResponsibilities((prev) => (prev.trim() ? prev : plainTextToHtml(result.responsibilities as string)));
      }
      if (result.industry) {
        setIndustry((prev) => (prev ? prev : (result.industry as (typeof INDUSTRIES)[number])));
      }
      if (result.employmentType) {
        setEmploymentType((prev) => (prev !== "full_time" ? prev : result.employmentType!));
      }
      if (result.workArrangement) {
        setWorkArrangement((prev) => (prev !== "onsite" ? prev : result.workArrangement!));
      }
      if (result.salaryMin !== null && !salaryMin.trim()) setSalaryMin(String(result.salaryMin));
      if (result.salaryMax !== null && !salaryMax.trim()) setSalaryMax(String(result.salaryMax));
      if (result.skills.length > 0) {
        setSkills((prev) => {
          const additions = result.skills
            .filter((s) => !includesSkillCaseInsensitive(prev, s))
            .slice(0, Math.max(0, MAX_MANUAL_SKILLS - prev.length));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.softSkills.length > 0) {
        setSoftSkills((prev) => {
          const additions = result.softSkills
            .filter((s) => !includesSkillCaseInsensitive(prev, s))
            .slice(0, Math.max(0, MAX_MANUAL_SKILLS - prev.length));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.niceToHaveSkills.length > 0) {
        setNiceToHaveSkills((prev) => {
          const additions = result.niceToHaveSkills
            .filter((s) => !includesSkillCaseInsensitive(prev, s))
            .slice(0, Math.max(0, MAX_MANUAL_SKILLS - prev.length));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.minYearsExperience !== null && !minYearsExperience.trim()) {
        setMinYearsExperience(String(result.minYearsExperience));
      }
      if (result.minQualificationTier) {
        setMinQualificationTier((prev) => (prev ? prev : (result.minQualificationTier as (typeof QUALIFICATION_TIERS)[number])));
      }
      if (result.languages.length > 0) {
        setLanguages((prev) => {
          const existing = new Set(prev.map((l) => l.language.toLowerCase()));
          const additions = result.languages.filter((l) => !existing.has(l.language.toLowerCase()));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.workAuthorizations.length > 0) {
        setWorkAuthorizations((prev) => {
          const additions = result.workAuthorizations.filter((w) => !prev.includes(w));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.drivingLicense) {
        setDrivingLicense((prev) => (prev ? prev : (result.drivingLicense as (typeof DRIVING_LICENSES)[number]["value"])));
      }

      setAiFillTokens(typeof data.usage?.total_tokens === "number" ? data.usage.total_tokens : null);
      setAiFillDurationMs(typeof data.durationMs === "number" ? data.durationMs : null);
      setAiFillStatus("Filled — generated, unverified, please review before posting.");
    } catch (err) {
      setAiFillError(err instanceof Error ? err.message : "Couldn't generate a suggestion.");
    } finally {
      setAiFillLoading(false);
    }
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value || includesSkillCaseInsensitive(skills, value) || skills.length >= MAX_MANUAL_SKILLS) {
      setSkillInput("");
      return;
    }
    setSkills((prev) => [...prev, value]);
    setSkillInput("");
  }

  function addSoftSkill() {
    const value = softSkillInput.trim();
    if (!value || includesSkillCaseInsensitive(softSkills, value) || softSkills.length >= MAX_MANUAL_SKILLS) {
      setSoftSkillInput("");
      return;
    }
    setSoftSkills((prev) => [...prev, value]);
    setSoftSkillInput("");
  }

  function addNiceToHaveSkill() {
    const value = niceToHaveSkillInput.trim();
    if (
      !value ||
      includesSkillCaseInsensitive(niceToHaveSkills, value) ||
      niceToHaveSkills.length >= MAX_MANUAL_SKILLS
    ) {
      setNiceToHaveSkillInput("");
      return;
    }
    setNiceToHaveSkills((prev) => [...prev, value]);
    setNiceToHaveSkillInput("");
  }

  function addLanguage() {
    const value = languageInput.trim();
    if (!value || languages.some((l) => l.language.toLowerCase() === value.toLowerCase())) {
      setLanguageInput("");
      return;
    }
    setLanguages((prev) => [...prev, { language: value, level: languageLevelInput }]);
    setLanguageInput("");
  }

  function toggleWorkAuthorization(value: string) {
    setWorkAuthorizations((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function goToField(fieldId: string) {
    const focusAndScroll = () => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    };
    // Screening fields only exist in the DOM on the screening step — switch
    // there first and let the new step render before scrolling to it.
    if (SCREENING_FIELD_IDS.has(fieldId) && formStep !== "screening") {
      setFormStep("screening");
      requestAnimationFrame(() => requestAnimationFrame(focusAndScroll));
      return;
    }
    focusAndScroll();
  }

  // Tells the employer which required field(s) are blocking the disabled
  // "Post job" button — otherwise it just sits unclickable with no explanation.
  const requiredFieldChecklist = [
    { label: "Job title", done: title.trim().length > 0, fieldId: "jobTitle" },
    { label: "Description", done: description.trim().length > 0, fieldId: "jobDescription" },
    { label: "Job description", done: responsibilities.trim().length > 0, fieldId: "jobResponsibilities" },
    { label: "Industry", done: industry.trim().length > 0, fieldId: "jobIndustry" },
    { label: "Location", done: location.trim().length > 0, fieldId: "jobAddressLine1" },
    { label: "Skills required", done: skills.length > 0, fieldId: "skillInput" },
  ];
  const formValid = requiredFieldChecklist.every((item) => item.done);

  // Not required to post, but each one narrows the candidate pool or makes
  // the posting more appealing — friendly nudges, not blockers.
  const boostChecklist = [
    {
      label: "Name this posting internally — helps you tell postings apart at a glance.",
      done: postingName.trim().length > 0,
      fieldId: "jobPostingName",
    },
    {
      label: "Add soft skills — helps AI match candidates on more than technical fit.",
      done: softSkills.length > 0,
      fieldId: "softSkillInput",
    },
    {
      label: "Add nice-to-have skills — gives bonus credit to candidates who have them, without requiring them.",
      done: niceToHaveSkills.length > 0,
      fieldId: "niceToHaveSkillInput",
    },
    {
      label: "Set a salary range — postings with pay listed get more applicants.",
      done: salaryMin.trim().length > 0 && salaryMax.trim().length > 0,
      fieldId: "salaryMin",
    },
    // The four items below only make sense once screening requirements are
    // turned on — while it's off they're intentionally blank, not missing,
    // so they're left out of the nudge list entirely rather than shown as
    // an unchecked item the employer can't act on from here.
    ...(screeningEnabled
      ? [
          {
            label: "Set a minimum experience — narrows candidates before AI ranks the rest.",
            done: askMinExperience && minYearsExperience.trim().length > 0,
            fieldId: "minYearsExperience",
          },
          {
            label: "Set a minimum education level — filters out under-qualified applicants.",
            done: askMinEducation && minQualificationTier.trim().length > 0,
            fieldId: "minQualificationTier",
          },
          {
            label: "Add required languages — makes sure candidates can communicate on the job.",
            done: askLanguages && languages.length > 0,
            fieldId: "languageInput",
          },
          {
            label: "Pick accepted work authorizations — screens out candidates who can't legally work the role.",
            done: askWorkAuthorizations && workAuthorizations.length > 0,
            fieldId: "workAuthorizations",
          },
        ]
      : []),
  ];
  const boostChecklistRemaining = boostChecklist.filter((item) => !item.done).length;

  // Anything the employer has typed or picked, beyond the untouched
  // defaults — used to decide whether leaving needs a confirmation at all.
  const hasUnsavedInput =
    postingName.trim().length > 0 ||
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    responsibilities.trim().length > 0 ||
    industry.length > 0 ||
    location.trim().length > 0 ||
    salaryMin.trim().length > 0 ||
    salaryMax.trim().length > 0 ||
    openings !== "1" ||
    skills.length > 0 ||
    softSkills.length > 0 ||
    niceToHaveSkills.length > 0 ||
    minYearsExperience.trim().length > 0 ||
    minQualificationTier.length > 0 ||
    languages.length > 0 ||
    workAuthorizations.length > 0 ||
    drivingLicense.length > 0 ||
    customQuestions.length > 0 ||
    screeningEnabled;

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);

  function guardNavigation(proceed: () => void) {
    if (hasUnsavedInput) {
      setPendingProceed(() => proceed);
      setShowLeaveConfirm(true);
    } else {
      proceed();
    }
  }

  useImperativeHandle(ref, () => ({ guardNavigation }));

  async function submitPosting(status: "draft" | "pending", onSuccess: () => void = onClose) {
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      status,
      postingName: postingName.trim() || null,
      title: title.trim(),
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      industry: industry || null,
      employmentType,
      workArrangement,
      location: location.trim(),
      addressLine1: addressLine1.trim() || null,
      addressLine2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: state || null,
      postcode: postcode.trim() || null,
      salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
      salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
      openings: openings.trim() ? Number(openings) : 1,
      skills,
      softSkills,
      niceToHaveSkills,
      // Cleared, not just hidden, when the master toggle or a requirement's
      // own "ask this" toggle is off — a posting can't keep asking
      // applicants about something the employer explicitly excluded, even
      // if a value is still sitting in the field underneath.
      minYearsExperience:
        screeningEnabled && askMinExperience && minYearsExperience.trim() ? Number(minYearsExperience) : null,
      minQualificationTier: screeningEnabled && askMinEducation ? minQualificationTier || null : null,
      languages: screeningEnabled && askLanguages ? languages : [],
      workAuthorizations: screeningEnabled && askWorkAuthorizations ? workAuthorizations : [],
      drivingLicense: screeningEnabled && askDrivingLicense ? drivingLicense || null : null,
      customScreeningQuestions: screeningEnabled ? customQuestions : [],
      screeningEnabled,
      skillSuggestions,
      askMinYearsExperience: askMinExperience,
      askMinQualificationTier: askMinEducation,
      askDrivingLicense,
      askLanguages,
      askWorkAuthorizations,
    };
    try {
      const res = await fetch(
        editingId ? `/api/employer/job-postings/${editingId}` : "/api/employer/job-postings",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save this posting.");
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save this posting.");
      setSubmitting(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className={gradientFrameClass("teal")}>
        <div className="rounded-[19px] bg-white p-[22px] text-xs text-[#9AA3B2]">Loading posting…</div>
      </div>
    );
  }

  return (
    <>
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!formValid) return;
        setShowPreview(true);
      }}
      className="flex min-w-0 flex-col gap-[20px] lg:flex-[3]"
    >
      <div className={gradientFrameClass("teal")}>
        <div className="relative flex flex-col gap-[16px] overflow-hidden rounded-[19px] bg-white p-[22px]">
          <JobTitleIllustration
            lit={title.trim().length > 0}
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto [&>svg]:h-full [&>svg]:w-auto sm:block"
          />

          <div className="relative sm:max-w-[calc(100%-300px)]">
            <p className="text-sm text-[#141B2E]">Start with your job title</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              It&rsquo;s the first thing candidates see and how they&rsquo;ll find you, so a clear,
              specific title works best — think &ldquo;Sales Executive&rdquo;, not &ldquo;Rockstar
              Ninja&rdquo;. Once it&rsquo;s in, let AI draft the rest of the posting for you.
            </p>
          </div>

          <Field
            label="Job title"
            htmlFor="jobTitle"
            hint={<MatchHint field="targetRole" />}
            className="relative sm:max-w-[calc(100%-300px)]"
          >
            <div className="flex gap-[8px]">
              <input
                id="jobTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={aiFillLoading}
                placeholder="e.g. Sales Executive"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => handleAiFill()}
                disabled={!title.trim() || aiFillLoading}
                className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                  aiFillLoading ? "ai-fill-pulse" : ""
                }`}
              >
                <SiriOrb className="h-[14px] w-[14px]" active={aiFillLoading} />
                {aiFillLoading ? `Filling… ${(aiFillElapsedMs / 1000).toFixed(1)}s` : "Fill with AI"}
              </button>
            </div>
            {(aiFillStatus || aiFillError) && (
              <p className={`mt-[6px] text-xs ${aiFillError ? "text-red-500" : "text-[#008990]"}`}>
                {aiFillError ??
                  `${aiFillStatus}${
                    aiFillTokens || aiFillDurationMs
                      ? ` (${[
                          aiFillTokens ? `${aiFillTokens} tokens` : null,
                          aiFillDurationMs ? `${(aiFillDurationMs / 1000).toFixed(1)}s` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")})`
                      : ""
                  }`}
              </p>
            )}
          </Field>
        </div>
      </div>

      {formStep === "details" && (
      <>
      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[22px]">
      <div>
        <p className="text-sm text-[#141B2E]">Role details</p>
        <p className="mt-[2px] text-xs text-[#9AA3B2]">
          Matched by AI against skills, resumes, and profiles — no exact match required.
        </p>
      </div>

      <Field label="Job posting name" htmlFor="jobPostingName" hint={<NoMatchHint />}>
        <input
          id="jobPostingName"
          type="text"
          value={postingName}
          onChange={(e) => setPostingName(e.target.value)}
          placeholder="e.g. Sales Executive — KL Branch (Urgent)"
          className={inputClass}
        />
      </Field>

      <Field label="Description" htmlFor="jobDescription" hint={<MatchHint field={["bio", "workExperiences"]} />}>
        <RichTextEditor
          id="jobDescription"
          value={description}
          onChange={setDescription}
          placeholder="What the role involves, and what you're looking for"
        />
      </Field>

      <Field label="Job description" htmlFor="jobResponsibilities" hint={<MatchHint field="workExperiences" />}>
        <RichTextEditor
          id="jobResponsibilities"
          value={responsibilities}
          onChange={setResponsibilities}
          placeholder="Key responsibilities and requirements — e.g. Design marketing materials for print and digital, Collaborate with the marketing team on campaign concepts, then a Requirements list below"
        />
      </Field>

      <div className="grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Industry" htmlFor="jobIndustry" hint={<MatchHint field="preferredIndustry" />}>
          <Dropdown
            id="jobIndustry"
            label="Industry"
            value={industry}
            options={[
              { value: "" as const, label: "Select industry" },
              ...INDUSTRIES.map((i) => ({ value: i, label: i })),
            ]}
            onChange={(value) => setIndustry(value as (typeof INDUSTRIES)[number] | "")}
            searchable
            searchPlaceholder="Search industries..."
          />
        </Field>

        <Field label="Employment type" htmlFor="jobEmploymentType" hint={<MatchHint field="employmentType" />}>
          <Dropdown
            id="jobEmploymentType"
            label="Employment type"
            value={employmentType}
            options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(value) => setEmploymentType(value)}
          />
        </Field>

        <Field label="Work arrangement" htmlFor="jobWorkArrangement" hint={<MatchHint field="workArrangement" />}>
          <Dropdown
            id="jobWorkArrangement"
            label="Work arrangement"
            value={workArrangement}
            options={WORK_ARRANGEMENTS.map((w) => ({ value: w.value, label: w.label }))}
            onChange={(value) => setWorkArrangement(value)}
          />
        </Field>

        <Field label="Salary min (RM)" htmlFor="salaryMin" hint={<MatchHint field="expectedSalaryMin" />}>
          <input
            id="salaryMin"
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="e.g. 3000"
            className={inputClass}
          />
        </Field>

        <Field label="Salary max (RM)" htmlFor="salaryMax" hint={<MatchHint field="expectedSalaryMax" />}>
          <input
            id="salaryMax"
            type="number"
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder="e.g. 4500"
            className={inputClass}
          />
        </Field>

        <Field label="Openings" htmlFor="openings" hint={<NoMatchHint />}>
          <input
            id="openings"
            type="number"
            min={1}
            value={openings}
            onChange={(e) => setOpenings(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Location" htmlFor="jobAddressLine1" hint={<MatchHint field="location" />} required>
        <div className="flex flex-col gap-[10px]">
          {addresses.length > 0 && (
            <Dropdown
              id="jobLocationPicker"
              label="Use a saved address"
              value=""
              options={[
                { value: "" as const, label: "Use a saved address..." },
                ...addresses.map((a) => ({ value: a.id, label: `${a.label} — ${a.city}, ${a.state}` })),
              ]}
              onChange={(value) => {
                const picked = addresses.find((a) => a.id === value);
                if (!picked) return;
                setAddressLine1(picked.addressLine1);
                setAddressLine2(picked.addressLine2 ?? "");
                setCity(picked.city);
                setState(picked.state as (typeof MALAYSIA_STATES)[number]);
                setPostcode(picked.postcode);
                setLocation(`${picked.city}, ${picked.state}`);
              }}
            />
          )}
          <div className="grid grid-cols-1 gap-x-[14px] gap-y-[10px] sm:grid-cols-2">
            <input
              id="jobAddressLine1"
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 12, Jalan SS 2/24"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              id="jobAddressLine2"
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Address line 2 (optional)"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              id="jobCity"
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setLocation(e.target.value && state ? `${e.target.value}, ${state}` : e.target.value || state);
              }}
              placeholder="e.g. Petaling Jaya"
              className={inputClass}
            />
            <Dropdown
              id="jobState"
              label="State"
              value={state}
              options={[
                { value: "" as const, label: "Select state" },
                ...MALAYSIA_STATES.map((s) => ({ value: s, label: s })),
              ]}
              onChange={(value) => {
                const nextState = value as (typeof MALAYSIA_STATES)[number] | "";
                setState(nextState);
                setLocation(city && nextState ? `${city}, ${nextState}` : city || nextState);
              }}
            />
            <input
              id="jobPostcode"
              type="text"
              inputMode="numeric"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="e.g. 47300"
              className={inputClass}
            />
          </div>
          {addressLine1.trim() && city.trim() && state && (
            <iframe
              title="Map for this location"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                `${addressLine1}, ${addressLine2 ? `${addressLine2}, ` : ""}${city}, ${state}${postcode ? ` ${postcode}` : ""}, Malaysia`,
              )}&output=embed`}
              loading="lazy"
              className="h-[160px] w-full rounded-[12px] border border-black/[0.08]"
            />
          )}
        </div>
      </Field>
      </div>
      </div>

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <p className="text-lg font-semibold text-[#141B2E]">Skills</p>
        <button
          type="button"
          onClick={suggestSkills}
          disabled={suggestingSkills || !title.trim()}
          className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
            suggestingSkills ? "ai-fill-pulse" : ""
          }`}
        >
          <SiriOrb className="h-[14px] w-[14px]" active={suggestingSkills} />
          {suggestingSkills ? `Suggesting… ${(suggestSkillsElapsedMs / 1000).toFixed(1)}s` : "Suggest skills for this role"}
        </button>
      </div>
      {(suggestSkillsStatus || suggestSkillsError) && (
        <p className={`text-xs ${suggestSkillsError ? "text-red-500" : "text-[#008990]"}`}>
          {suggestSkillsError ??
            `${suggestSkillsStatus}${
              suggestSkillsTokens || suggestSkillsDurationMs
                ? ` (${[
                    suggestSkillsTokens ? `${suggestSkillsTokens} tokens` : null,
                    suggestSkillsDurationMs ? `${(suggestSkillsDurationMs / 1000).toFixed(1)}s` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")})`
                : ""
            }`}
        </p>
      )}

      <Field label="Skills required" htmlFor="skillInput" hint={<MatchHint field="professionalSkills" />}>
        <input
          id="skillInput"
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
          }}
          onBlur={addSkill}
          placeholder="Add a skill and press Enter"
          className={inputClass}
        />
        {skills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-[6px] rounded-full bg-brand-teal-dark py-[6px] pl-[12px] pr-[8px] text-xs text-white"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                  aria-label={`Remove ${skill}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
        {skillSuggestions && skillSuggestions.professionalSkills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {skillSuggestions.professionalSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSuggestedSkill(skill)}
                className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
              >
                <PlusIcon className="h-[8px] w-[8px]" />
                {skill}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Soft skills (optional)" htmlFor="softSkillInput" hint={<MatchHint field="softSkills" />}>
        <input
          id="softSkillInput"
          type="text"
          value={softSkillInput}
          onChange={(e) => setSoftSkillInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSoftSkill();
            }
          }}
          onBlur={addSoftSkill}
          placeholder="e.g. Communication, Teamwork — press Enter to add"
          className={inputClass}
        />
        {softSkills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {softSkills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-[6px] rounded-full bg-brand-teal-dark py-[6px] pl-[12px] pr-[8px] text-xs text-white"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => setSoftSkills((prev) => prev.filter((s) => s !== skill))}
                  aria-label={`Remove ${skill}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
        {skillSuggestions && skillSuggestions.softSkills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {skillSuggestions.softSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSuggestedSoftSkill(skill)}
                className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
              >
                <PlusIcon className="h-[8px] w-[8px]" />
                {skill}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Nice-to-have skills (optional)"
        htmlFor="niceToHaveSkillInput"
        hint={<MatchHint field="niceToHaveSkills" />}
      >
        <input
          id="niceToHaveSkillInput"
          type="text"
          value={niceToHaveSkillInput}
          onChange={(e) => setNiceToHaveSkillInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addNiceToHaveSkill();
            }
          }}
          onBlur={addNiceToHaveSkill}
          placeholder="Bonus skills, not required — press Enter to add"
          className={inputClass}
        />
        {niceToHaveSkills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {niceToHaveSkills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-[6px] rounded-full bg-brand-teal-dark py-[6px] pl-[12px] pr-[8px] text-xs text-white"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => setNiceToHaveSkills((prev) => prev.filter((s) => s !== skill))}
                  aria-label={`Remove ${skill}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
        {skillSuggestions && skillSuggestions.niceToHaveSkills.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {skillSuggestions.niceToHaveSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSuggestedNiceToHaveSkill(skill)}
                className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
              >
                <PlusIcon className="h-[8px] w-[8px]" />
                {skill}
              </button>
            ))}
          </div>
        )}
      </Field>
      </div>
      </div>

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[22px]">
      {submitError && <p className="text-xs text-red-500">{submitError}</p>}
      <div className="flex flex-col gap-[8px] sm:flex-row">
        <button
          type="button"
          disabled={!formValid}
          onClick={() => setFormStep("screening")}
          className="flex h-[38px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
        <button
          type="button"
          disabled={submitting || !title.trim()}
          onClick={() => submitPosting("draft")}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => guardNavigation(onClose)}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Cancel
        </button>
      </div>
      </div>
      </div>
      </>
      )}

      {formStep === "screening" && (
      <>
      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[22px]">
      <div className="flex flex-col gap-[10px]">
        <p className="text-sm text-[#141B2E]">Screening requirements</p>
        <label className="flex items-start gap-[8px] text-sm text-[#141B2E]">
          <input
            type="checkbox"
            checked={screeningEnabled}
            onChange={(e) => setScreeningEnabled(e.target.checked)}
            className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-brand-teal-dark"
          />
          Add screening requirements for this posting
        </label>
        <p className="text-xs text-[#9AA3B2]">
          {screeningEnabled
            ? "When a jobseeker applies, they'll be asked to answer the requirements you set below. Answers that meet what you're looking for get a strong match score — answers that don't are marked as not eligible. Only the requirements you actually fill in are asked about."
            : "Off by default — leave this unchecked and applying stays a single click, with no questions asked. Turn it on to ask applicants to answer the requirements below before they can apply."}
        </p>
      </div>

      {screeningEnabled && (
      <>
      <div className="flex flex-col gap-[12px]">
        <Field
          label="Minimum experience (years)"
          htmlFor="minYearsExperience"
          hint={<><MatchHint field="yearsExperience" /><AskToggle checked={askMinExperience} onChange={setAskMinExperience} label="Ask this" /></>}
        >
          <input
            id="minYearsExperience"
            type="number"
            min={0}
            disabled={!askMinExperience}
            value={minYearsExperience}
            onChange={(e) => setMinYearsExperience(e.target.value)}
            placeholder="e.g. 2"
            className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#F8FAFB] disabled:text-[#9AA3B2]`}
          />
        </Field>

        <Field
          label="Minimum education"
          htmlFor="minQualificationTier"
          hint={<><MatchHint field="qualificationTier" /><AskToggle checked={askMinEducation} onChange={setAskMinEducation} label="Ask this" /></>}
        >
          <Dropdown
            id="minQualificationTier"
            label="Minimum education"
            value={minQualificationTier}
            disabled={!askMinEducation}
            options={[
              { value: "" as const, label: "No requirement" },
              ...QUALIFICATION_TIERS.map((t) => ({ value: t, label: t })),
            ]}
            onChange={(value) => setMinQualificationTier(value as (typeof QUALIFICATION_TIERS)[number] | "")}
          />
        </Field>

        <Field
          label="Driving license (optional)"
          htmlFor="drivingLicense"
          hint={<><MatchHint field="drivingLicense" /><AskToggle checked={askDrivingLicense} onChange={setAskDrivingLicense} label="Ask this" /></>}
        >
          <Dropdown
            id="drivingLicense"
            label="Driving license"
            value={drivingLicense}
            disabled={!askDrivingLicense}
            options={[
              { value: "" as const, label: "Not required" },
              ...DRIVING_LICENSES.map((d) => ({ value: d.value, label: d.label })),
            ]}
            onChange={(value) => setDrivingLicense(value)}
          />
        </Field>
      </div>

      <Field
        label="Languages required"
        htmlFor="languageInput"
        hint={<><MatchHint field="jobseekerLanguages" /><AskToggle checked={askLanguages} onChange={setAskLanguages} label="Ask this" /></>}
      >
        <div className="flex gap-[8px]">
          <input
            id="languageInput"
            type="text"
            disabled={!askLanguages}
            value={languageInput}
            onChange={(e) => setLanguageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLanguage();
              }
            }}
            placeholder="e.g. English"
            className={`${inputClass} flex-1 disabled:cursor-not-allowed disabled:bg-[#F8FAFB] disabled:text-[#9AA3B2]`}
          />
          <div className="w-[150px] shrink-0">
            <Dropdown
              id="languageLevel"
              label="Minimum level"
              value={languageLevelInput}
              disabled={!askLanguages}
              options={LANGUAGE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              onChange={(value) => setLanguageLevelInput(value)}
            />
          </div>
          <button
            type="button"
            disabled={!askLanguages}
            onClick={addLanguage}
            className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-[#E6F9FA] px-[14px] text-sm text-[#008990] hover:bg-[#CFF4F6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {languages.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {languages.map((entry) => (
              <span
                key={entry.language}
                className="flex items-center gap-[6px] rounded-full bg-[#F1F4F8] py-[6px] pl-[12px] pr-[8px] text-xs text-[#141B2E]"
              >
                {entry.language} — {LANGUAGE_LEVELS.find((l) => l.value === entry.level)?.label}
                <button
                  type="button"
                  onClick={() => setLanguages((prev) => prev.filter((l) => l.language !== entry.language))}
                  aria-label={`Remove ${entry.language}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Accepted work authorization"
        htmlFor="workAuthorizations"
        hint={<><MatchHint field="workAuthorization" /><AskToggle checked={askWorkAuthorizations} onChange={setAskWorkAuthorizations} label="Ask this" /></>}
      >
        <div id="workAuthorizations" className="flex flex-col gap-[8px]">
          {WORK_AUTHORIZATIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-[8px] text-sm text-[#141B2E] ${!askWorkAuthorizations ? "opacity-40" : ""}`}
            >
              <input
                type="checkbox"
                disabled={!askWorkAuthorizations}
                checked={workAuthorizations.includes(option.value)}
                onChange={() => toggleWorkAuthorization(option.value)}
                className="h-[15px] w-[15px] accent-brand-teal-dark disabled:cursor-not-allowed"
              />
              {option.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Custom yes/no questions (optional)" htmlFor="customQuestionInput">
        <div className="flex gap-[8px]">
          <input
            id="customQuestionInput"
            type="text"
            value={customQuestionInput}
            onChange={(e) => setCustomQuestionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomQuestion();
              }
            }}
            placeholder="e.g. Willing to work weekends?"
            className={`${inputClass} flex-1`}
          />
          <div className="w-[130px] shrink-0">
            <Dropdown
              id="customQuestionRequiredAnswer"
              label="Correct answer"
              value={customQuestionRequiredAnswer ? "yes" : "no"}
              options={[
                { value: "yes" as const, label: "Yes required" },
                { value: "no" as const, label: "No required" },
              ]}
              onChange={(value) => setCustomQuestionRequiredAnswer(value === "yes")}
            />
          </div>
          <button
            type="button"
            onClick={addCustomQuestion}
            className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-[#E6F9FA] px-[14px] text-sm text-[#008990] hover:bg-[#CFF4F6]"
          >
            Add
          </button>
        </div>
        {customQuestions.length > 0 && (
          <div className="mt-[10px] flex flex-col gap-[6px]">
            {customQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-[8px] rounded-[10px] bg-[#F1F4F8] px-[12px] py-[8px] text-xs text-[#141B2E]"
              >
                <span>
                  {q.question} <span className="text-[#9AA3B2]">— must answer {q.requiredAnswer ? "Yes" : "No"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeCustomQuestion(q.id)}
                  aria-label={`Remove ${q.question}`}
                  className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>
      </>
      )}

      <p className="text-xs text-[#9AA3B2]">
        This form isn&rsquo;t connected to a real listing yet — it&rsquo;s a preview of the flow.
      </p>

      {submitError && <p className="text-xs text-red-500">{submitError}</p>}
      <div className="flex flex-col gap-[8px] sm:flex-row">
        <button
          type="button"
          onClick={() => setFormStep("details")}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!formValid}
          onClick={() => setShowJobseekerPreview(true)}
          className="flex h-[38px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preview as jobseeker
        </button>
        <button
          type="button"
          disabled={submitting || !title.trim()}
          onClick={() => submitPosting("draft")}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
        <button
          type="button"
          onClick={() => guardNavigation(onClose)}
          className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
        >
          Cancel
        </button>
      </div>
      </div>
      </div>
      </>
      )}
    </form>

    <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:flex-[1]">
      <div
        className={
          formValid
            ? gradientFrameClass("teal")
            : "rounded-[20px] bg-gradient-to-br from-[#A66A61] via-white to-[#A66A61] p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]"
        }
      >
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="text-left text-lg font-semibold text-[#141B2E]">
            {formValid ? "All required fields are complete." : "Complete these required fields to continue:"}
          </p>
          <ul className="mt-[16px] flex flex-col gap-[4px]">
            {requiredFieldChecklist.map(({ label, done, fieldId }) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => goToField(fieldId)}
                  className={`flex w-full items-center gap-[8px] text-left text-sm ${
                    done ? "cursor-default text-[#1F7A3F]" : "text-[#A66A61] hover:underline"
                  }`}
                >
                  <span
                    className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border ${
                      done ? "border-[#1F7A3F] bg-[#1F7A3F]" : "border-[#C99089]"
                    }`}
                  >
                    {done && <CheckIcon className="h-[8px] w-[8px] text-white" />}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={gradientFrameClass("teal")}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="text-left text-lg font-semibold text-[#141B2E]">
            {boostChecklistRemaining > 0
              ? "Not compulsory, but these help narrow your candidate pool and attract better applicants:"
              : "✨ Nice — this posting is fully boosted and ready to attract candidates."}
          </p>
          <ul className="mt-[16px] flex flex-col gap-[4px]">
            {boostChecklist.map(({ label, done, fieldId }) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => goToField(fieldId)}
                  className={`flex w-full items-center gap-[8px] text-left text-sm ${
                    done
                      ? "cursor-default text-[#1F7A3F]"
                      : "text-[#4B5468] hover:text-brand-teal-dark hover:underline"
                  }`}
                >
                  <span
                    className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border ${
                      done ? "border-[#1F7A3F] bg-[#1F7A3F]" : "border-black/[0.15]"
                    }`}
                  >
                    {done && <CheckIcon className="h-[8px] w-[8px] text-white" />}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
    </div>

    {showPreview && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
        onClick={() => setShowPreview(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview job posting"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] px-[22px] py-[16px]">
            <div>
              <p className="text-sm text-[#141B2E]">Preview your posting</p>
              <p className="mt-[2px] text-xs text-[#9AA3B2]">
                This is what candidates will see. Check it over before it goes out for review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              aria-label="Close preview"
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
            >
              <XIcon className="h-[12px] w-[12px]" />
            </button>
          </div>

          <div className="flex flex-col gap-[16px] overflow-y-auto px-[22px] py-[18px]">
            <div>
              {postingName.trim() && (
                <p className="text-xs text-[#9AA3B2]">{postingName}</p>
              )}
              <p className="text-lg text-[#141B2E]">{title}</p>
              <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
                {industry && (
                  <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                    {industry}
                  </span>
                )}
                <span className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark">
                  {EMPLOYMENT_TYPES.find((t) => t.value === employmentType)?.label}
                </span>
                <span className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark">
                  {WORK_ARRANGEMENTS.find((w) => w.value === workArrangement)?.label}
                </span>
              </div>
              <div className="mt-[10px] flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-xs text-[#4B5468]">
                <span>{location || "Location not set"}</span>
                <span className="text-[#C7CDD7]">·</span>
                <span>
                  {salaryMin.trim() && salaryMax.trim()
                    ? `RM${Number(salaryMin).toLocaleString()}–${Number(salaryMax).toLocaleString()}`
                    : "Salary not disclosed"}
                </span>
                <span className="text-[#C7CDD7]">·</span>
                <span>
                  {openings} opening{openings === "1" ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="border-t border-black/[0.06] pt-[14px]">
              <p className="text-xs text-[#141B2E]">About the role</p>
              <p className="mt-[4px] whitespace-pre-line text-xs text-[#4B5468]">{description}</p>
            </div>

            <div className="border-t border-black/[0.06] pt-[14px]">
              <p className="text-xs text-[#141B2E]">Responsibilities & requirements</p>
              <p className="mt-[4px] whitespace-pre-line text-xs text-[#4B5468]">{responsibilities}</p>
            </div>

            {skills.length > 0 && (
              <div className="border-t border-black/[0.06] pt-[14px]">
                <p className="text-xs text-[#141B2E]">Skills required</p>
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-brand-teal-dark px-[12px] py-[6px] text-xs text-white"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {softSkills.length > 0 && (
              <div>
                <p className="text-xs text-[#141B2E]">Soft skills</p>
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {softSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {niceToHaveSkills.length > 0 && (
              <div>
                <p className="text-xs text-[#141B2E]">Nice-to-have skills</p>
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {niceToHaveSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(minYearsExperience.trim() ||
              minQualificationTier ||
              drivingLicense ||
              languages.length > 0 ||
              workAuthorizations.length > 0) && (
              <div className="border-t border-black/[0.06] pt-[14px]">
                <p className="text-xs text-[#141B2E]">Candidate requirements</p>
                <ul className="mt-[6px] flex flex-col gap-[3px] text-xs text-[#4B5468]">
                  {minYearsExperience.trim() && <li>{minYearsExperience}+ years of experience</li>}
                  {minQualificationTier && <li>Minimum education: {minQualificationTier}</li>}
                  {drivingLicense && (
                    <li>
                      Driving license: {DRIVING_LICENSES.find((d) => d.value === drivingLicense)?.label}
                    </li>
                  )}
                  {languages.length > 0 && (
                    <li>
                      Languages:{" "}
                      {languages
                        .map(
                          (l) =>
                            `${l.language} (${LANGUAGE_LEVELS.find((lv) => lv.value === l.level)?.label})`,
                        )
                        .join(", ")}
                    </li>
                  )}
                  {workAuthorizations.length > 0 && (
                    <li>
                      Accepted work authorization:{" "}
                      {workAuthorizations
                        .map((w) => WORK_AUTHORIZATIONS.find((a) => a.value === w)?.label)
                        .join(", ")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[8px] border-t border-black/[0.06] px-[22px] py-[16px] sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowPreview(false);
                setShowJobseekerPreview(true);
              }}
              className="flex h-[38px] flex-1 items-center justify-center rounded-full border border-[#008990] bg-white text-sm text-brand-teal-dark hover:bg-[#E6F9FA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              👁️ See jobseeker view
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("pending")}
              className="flex h-[38px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Looks good, post it"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("draft")}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowPreview(false)}
              className="flex h-[38px] items-center justify-center rounded-full text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Back to edit
            </button>
          </div>
          {submitError && (
            <p className="border-t border-black/[0.06] px-[22px] py-[10px] text-xs text-red-500">
              {submitError}
            </p>
          )}
        </div>
      </div>
    )}

    {showLeaveConfirm && (
      <Modal
        ariaLabel="Leave without saving?"
        onClose={() => {
          setShowLeaveConfirm(false);
          setPendingProceed(null);
        }}
      >
        <h2 className="text-lg font-semibold text-[#141B2E]">Leave this posting?</h2>
        <p className="mt-[6px] text-xs text-[#4B5468]">
          You&rsquo;ve started filling this in. Save it as a draft to pick up right where you left off,
          or discard it and start fresh next time.
        </p>
        <div className="mt-[18px] flex flex-col gap-[8px]">
          <button
            type="button"
            disabled={submitting || !title.trim()}
            onClick={async () => {
              setShowLeaveConfirm(false);
              const proceed = pendingProceed;
              setPendingProceed(null);
              // submitPosting only calls onSuccess once the save actually
              // succeeds — a failed save leaves the form open (with
              // submitError shown) instead of navigating away and losing
              // what was typed, same as a direct "Save as draft" click.
              await submitPosting("draft", () => proceed?.());
            }}
            className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLeaveConfirm(false);
              pendingProceed?.();
              setPendingProceed(null);
            }}
            className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
          >
            Discard posting
          </button>
          {submitError && <p className="text-xs text-red-500">{submitError}</p>}
          <button
            type="button"
            onClick={() => {
              setShowLeaveConfirm(false);
              setPendingProceed(null);
            }}
            className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
          >
            Keep editing
          </button>
        </div>
      </Modal>
    )}

    {showJobseekerPreview && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
        onClick={() => setShowJobseekerPreview(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview as jobseeker"
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] px-[22px] py-[16px]">
            <div>
              <p className="text-sm text-[#141B2E]">Jobseeker view</p>
              <p className="mt-[2px] text-xs text-[#9AA3B2]">
                This is how your posting will appear when jobseekers browse active jobs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowJobseekerPreview(false)}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04]"
              aria-label="Close preview"
            >
              <XIcon className="h-[14px] w-[14px]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-[22px] py-[20px]">
            {/* Jobseeker browse card view */}
            <div className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#141B2E]">{title}</p>
                <p className="mt-[2px] text-xs text-[#4B5468]">Your Company</p>
                <div className="mt-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                  <span>{location || "Location not set"}</span>
                  <span className="text-[#C7CDD7]">·</span>
                  <span>{employmentType || "Not set"}</span>
                  <span className="text-[#C7CDD7]">·</span>
                  <span>{workArrangement || "Not set"}</span>
                  {(salaryMin.trim() || salaryMax.trim()) && (
                    <>
                      <span className="text-[#C7CDD7]">·</span>
                      <span>
                        {salaryMin && salaryMax
                          ? `RM${parseInt(salaryMin).toLocaleString()}–${parseInt(salaryMax).toLocaleString()}`
                          : salaryMin
                            ? `From RM${parseInt(salaryMin).toLocaleString()}`
                            : salaryMax
                              ? `Up to RM${parseInt(salaryMax).toLocaleString()}`
                              : "Salary not disclosed"}
                      </span>
                    </>
                  )}
                </div>
                {skills.length > 0 && (
                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                    {skills.slice(0, 5).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-brand-gold-dark"
                      >
                        {skill}
                      </span>
                    ))}
                    {skills.length > 5 && (
                      <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                        +{skills.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-[16px] rounded-[14px] border border-[#E6F9FA] bg-[#F0FCFD] p-[12px]">
              <p className="text-xs text-[#4B5468]">
                💡 <span>Pro tip:</span> After approval, jobseekers can click your
                posting to see the full details, responsibilities, and requirements.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-[8px] border-t border-black/[0.06] px-[22px] py-[16px] sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("pending")}
              className="flex h-[38px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit for approval"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("draft")}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowJobseekerPreview(false)}
              className="flex h-[38px] items-center justify-center rounded-full text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Back to edit
            </button>
          </div>
          {submitError && (
            <p className="border-t border-black/[0.06] px-[22px] py-[10px] text-xs text-red-500">
              {submitError}
            </p>
          )}
        </div>
      </div>
    )}
    </>
  );
  },
);

type PostingWithId = PreviewPosting & { id: string; slug: string };

// Shape returned by /api/employer/job-postings — a real DB row, JSON-
// serialized (timestamps as ISO strings, enum values lowercase/snake_case).
export type DbJobPosting = {
  id: string;
  slug: string;
  postingName: string | null;
  title: string;
  description: string;
  responsibilities: string;
  industry: string | null;
  employmentType: string;
  workArrangement: string;
  location: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  openings: number;
  skills: string[];
  softSkills: string[];
  niceToHaveSkills: string[];
  minYearsExperience: number | null;
  minQualificationTier: string | null;
  languages: { language: string; level: string }[];
  workAuthorizations: string[];
  drivingLicense: string | null;
  screeningEnabled: boolean;
  customScreeningQuestions: { id: string; question: string; requiredAnswer: boolean }[];
  skillSuggestions: { professionalSkills: string[]; softSkills: string[]; niceToHaveSkills: string[] } | null;
  askMinYearsExperience: boolean;
  askMinQualificationTier: boolean;
  askDrivingLicense: boolean;
  askLanguages: boolean;
  askWorkAuthorizations: boolean;
  status: string;
  rejectionReason: string | null;
  flagReason: string | null;
  flaggedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Only present when the page loader joins job_applications/job_posting_views
  // (Manage Job's initial fetch) — absent from the plain create/update/
  // duplicate API responses, which normalizeJobPosting treats as 0.
  applicantCount?: number;
  viewCount?: number;
};

const DB_STATUS_TO_DISPLAY: Record<string, JobStatus> = {
  draft: "Draft",
  pending: "Pending",
  active: "Active",
  filled: "Filled",
  closed: "Closed",
  rejected: "Rejected",
  flagged: "Flagged",
};

function relativeTimeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function postedLabel(posting: DbJobPosting): string {
  switch (posting.status) {
    case "draft":
      return "Not yet published";
    case "pending":
      return "Awaiting approval";
    case "rejected":
      return "Needs revision";
    case "flagged":
      return "Under review";
    case "closed":
      return `Closed ${relativeTimeAgo(posting.updatedAt)}`;
    case "filled":
      return `Filled ${relativeTimeAgo(posting.updatedAt)}`;
    default:
      return `Posted ${relativeTimeAgo(posting.createdAt)}`;
  }
}

function normalizeJobPosting(posting: DbJobPosting): PostingWithId {
  return {
    id: posting.id,
    slug: posting.slug,
    title: posting.title,
    status: DB_STATUS_TO_DISPLAY[posting.status] ?? "Draft",
    applicants: posting.applicantCount ?? 0,
    views: posting.viewCount ?? 0,
    posted: postedLabel(posting),
    location: posting.location || "Not set",
    employmentType:
      EMPLOYMENT_TYPES.find((t) => t.value === posting.employmentType)?.label ?? posting.employmentType,
    workArrangement:
      WORK_ARRANGEMENTS.find((w) => w.value === posting.workArrangement)?.label ?? posting.workArrangement,
    salaryMin: posting.salaryMin ?? 0,
    salaryMax: posting.salaryMax ?? 0,
    openings: posting.openings,
    minYearsExperience: posting.minYearsExperience ?? 0,
    rejectionReason: posting.rejectionReason,
    flagReason: posting.flagReason,
  };
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: (props: { className?: string }) => ReactElement;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-[34px] w-full items-center gap-[8px] rounded-[8px] px-[10px] text-left text-sm transition-colors hover:bg-[#F1F4F8] ${
        danger ? "text-red-500" : "text-[#141B2E]"
      }`}
    >
      <Icon className="h-[13px] w-[13px]" />
      {label}
    </button>
  );
}

function PostingActionsMenu({
  posting,
  onView,
  onEdit,
  onDuplicate,
  onCloseJob,
  onDelete,
}: {
  posting: PostingWithId;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCloseJob: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const canClose = posting.status !== "Closed";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${posting.title}`}
        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
      >
        <DotsIcon className="h-[14px] w-[14px]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-[6px] w-[190px] rounded-[12px] border border-black/[0.08] bg-white p-[6px] shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]"
        >
          <MenuItem
            icon={EyeIcon}
            label="View details"
            onClick={() => {
              onView();
              setOpen(false);
            }}
          />
          <MenuItem
            icon={PencilIcon}
            label="Edit"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          />
          <MenuItem
            icon={CopyIcon}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setOpen(false);
            }}
          />
          {canClose && (
            <MenuItem
              icon={LockIcon}
              label="Close job"
              onClick={() => {
                onCloseJob();
                setOpen(false);
              }}
            />
          )}
          {!confirmingDelete ? (
            <MenuItem icon={TrashIcon} label="Delete" danger onClick={() => setConfirmingDelete(true)} />
          ) : (
            <MenuItem
              icon={TrashIcon}
              label="Confirm delete?"
              danger
              onClick={() => {
                onDelete();
                setOpen(false);
                setConfirmingDelete(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-[12px]">
      <dt className="text-[#9AA3B2]">{label}</dt>
      <dd className="text-[#141B2E]">{value}</dd>
    </div>
  );
}

function PostingDetailsModal({ 
  posting, 
  onClose,
  onResubmit,
}: {
  posting: PostingWithId;
  onClose: () => void;
  onResubmit?: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const color = STATUS_TILE_COLOR[posting.status];
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const isRejected = posting.status === "Rejected";
  const isFlagged = posting.status === "Flagged";
  const { rejectionReason, flagReason } = posting;

  async function handleResubmit() {
    if (!onResubmit) return;
    setResubmitting(true);
    setResubmitError(null);
    try {
      await onResubmit(posting.id);
      onClose();
    } catch (err) {
      setResubmitError(err instanceof Error ? err.message : "Couldn't resubmit posting.");
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <Modal ariaLabel={`${posting.title} details`} onClose={onClose}>
      <div className="flex items-start justify-between gap-[8px]">
        <h2 className="text-lg font-semibold text-[#141B2E]">{posting.title}</h2>
        <span className={`shrink-0 rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}>
          {posting.status}
        </span>
      </div>

      {isRejected && rejectionReason && (
        <div className="mt-[14px] rounded-[12px] border border-red-100 bg-red-50 p-[12px]">
          <p className="text-xs text-red-700 mb-[4px]">Rejection reason</p>
          <p className="text-xs text-red-600">{rejectionReason}</p>
          {resubmitError && <p className="mt-[8px] text-xs text-red-600">{resubmitError}</p>}
          <button
            type="button"
            disabled={resubmitting}
            onClick={handleResubmit}
            className="mt-[10px] flex h-[34px] w-full items-center justify-center rounded-full border border-red-300 bg-white text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resubmitting ? "Resubmitting..." : "↻ Resubmit for Review"}
          </button>
        </div>
      )}

      {isFlagged && flagReason && (
        <div className="mt-[14px] rounded-[12px] border border-[#FBDBBE] bg-[#FFF7F0] p-[12px]">
          <p className="text-xs text-[#C2600A] mb-[4px]">Flagged — needs a fix</p>
          <p className="text-xs text-[#9A5209]">{flagReason}</p>
          {resubmitError && <p className="mt-[8px] text-xs text-[#9A5209]">{resubmitError}</p>}
          <button
            type="button"
            disabled={resubmitting}
            onClick={handleResubmit}
            className="mt-[10px] flex h-[34px] w-full items-center justify-center rounded-full border border-[#FBDBBE] bg-white text-sm text-[#C2600A] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resubmitting ? "Resubmitting..." : "↻ Resubmit for Review"}
          </button>
        </div>
      )}

      <dl className="mt-[16px] flex flex-col gap-[9px] text-xs">
        <DetailRow label="Location" value={posting.location} />
        <DetailRow label="Employment type" value={posting.employmentType} />
        <DetailRow label="Work arrangement" value={posting.workArrangement} />
        <DetailRow
          label="Salary range"
          value={`RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`}
        />
        <DetailRow label="Openings" value={String(posting.openings)} />
        <DetailRow
          label="Minimum experience"
          value={posting.minYearsExperience === 0 ? "No experience required" : `${posting.minYearsExperience}+ years`}
        />
        <DetailRow label="Views" value={String(posting.views)} />
        <div className="flex items-center justify-between gap-[12px]">
          <dt className="text-[#9AA3B2]">Applicants</dt>
          <dd>
            <button
              type="button"
              onClick={() => router.push(`/employer/applicants?jobId=${posting.id}`)}
              className="text-brand-teal-dark underline-offset-2 hover:underline"
            >
              {posting.applicants}
            </button>
          </dd>
        </div>
        <DetailRow label="Posted" value={posting.posted} />
      </dl>
      <button
        type="button"
        onClick={onClose}
        className="mt-[18px] flex h-[38px] w-full items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
      >
        Close
      </button>
    </Modal>
  );
}

function JobPostingsPanel({ initialPostings }: { initialPostings: DbJobPosting[] }) {
  const router = useRouter();
  const [postings, setPostings] = useState<PostingWithId[]>(() => initialPostings.map(normalizeJobPosting));
  // Keeps the full raw DB row per posting (not just what PostingWithId
  // displays) so Duplicate can resend every field — mutated directly since
  // it's a lookup cache, not something the UI renders from.
  const rawByIdRef = useRef(new Map(initialPostings.map((p) => [p.id, p])));
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PostingWithId | null>(null);
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<JobStatus>>(() => new Set());
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  function toggleStatusCollapsed(status: JobStatus) {
    setCollapsedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }
  const [heroTitle, setHeroTitle] = useState("");

  function startWithTitle() {
    const value = heroTitle.trim();
    if (!value) return;
    router.push(`/employer/jobs/postajob?title=${encodeURIComponent(value)}&autofill=1`);
  }

  const tiles: { label: "Total postings" | JobStatus; count: number }[] = [
    { label: "Total postings", count: postings.length },
    ...STATUS_ORDER.map((status) => ({
      label: status,
      count: postings.filter((p) => p.status === status).length,
    })),
  ];

  async function duplicate(id: string) {
    setActionError(null);
    const original = rawByIdRef.current.get(id);
    if (!original) return;
    try {
      const res = await fetch("/api/employer/job-postings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "draft",
          postingName: original.postingName,
          title: `${original.title} (Copy)`,
          description: original.description,
          responsibilities: original.responsibilities,
          industry: original.industry,
          employmentType: original.employmentType,
          workArrangement: original.workArrangement,
          location: original.location,
          addressLine1: original.addressLine1,
          addressLine2: original.addressLine2,
          city: original.city,
          state: original.state,
          postcode: original.postcode,
          salaryMin: original.salaryMin,
          salaryMax: original.salaryMax,
          openings: original.openings,
          skills: original.skills,
          softSkills: original.softSkills,
          niceToHaveSkills: original.niceToHaveSkills,
          minYearsExperience: original.minYearsExperience,
          minQualificationTier: original.minQualificationTier,
          languages: original.languages,
          workAuthorizations: original.workAuthorizations,
          drivingLicense: original.drivingLicense,
          screeningEnabled: original.screeningEnabled,
          customScreeningQuestions: original.customScreeningQuestions,
          skillSuggestions: original.skillSuggestions,
          askMinYearsExperience: original.askMinYearsExperience,
          askMinQualificationTier: original.askMinQualificationTier,
          askDrivingLicense: original.askDrivingLicense,
          askLanguages: original.askLanguages,
          askWorkAuthorizations: original.askWorkAuthorizations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't duplicate this posting.");
      const created = data.posting as DbJobPosting;
      rawByIdRef.current.set(created.id, created);
      setPostings((prev) => {
        const index = prev.findIndex((p) => p.id === id);
        const copy = normalizeJobPosting(created);
        if (index === -1) return [...prev, copy];
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't duplicate this posting.");
    }
  }

  async function closeJob(id: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't close this posting.");
      const updated = data.posting as DbJobPosting;
      rawByIdRef.current.set(updated.id, updated);
      setPostings((prev) => prev.map((p) => (p.id === id ? normalizeJobPosting(updated) : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't close this posting.");
    }
  }

  async function deletePosting(id: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't delete this posting.");
      }
      rawByIdRef.current.delete(id);
      setPostings((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't delete this posting.");
    }
  }

  async function resubmitPosting(id: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't resubmit this posting.");
      const updated = data.posting as DbJobPosting;
      rawByIdRef.current.set(updated.id, updated);
      setPostings((prev) => prev.map((p) => (p.id === id ? normalizeJobPosting(updated) : p)));
      setViewing(null);
    } catch (err) {
      throw err;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
    <div className="flex min-w-0 flex-col gap-[20px] lg:flex-[3]">
    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
      <div className="relative flex flex-col gap-[16px] overflow-hidden rounded-[19px] bg-white p-[22px]">
        <JobTitleIllustration
          lit={heroTitle.trim().length > 0}
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto [&>svg]:h-full [&>svg]:w-auto sm:block"
        />

        <div className="relative sm:max-w-[calc(100%-300px)]">
          <p className="text-sm text-[#141B2E]">Start with your job title</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            It&rsquo;s the first thing candidates see and how they&rsquo;ll find you, so a clear,
            specific title works best — think &ldquo;Sales Executive&rdquo;, not &ldquo;Rockstar
            Ninja&rdquo;. Once it&rsquo;s in, let AI draft the rest of the posting for you.
          </p>
        </div>

        <Field label="Job title" htmlFor="heroJobTitle" hint={<MatchHint field="targetRole" />} className="relative sm:max-w-[calc(100%-300px)]">
          <div className="flex gap-[8px]">
            <input
              id="heroJobTitle"
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startWithTitle();
                }
              }}
              placeholder="e.g. Sales Executive"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={startWithTitle}
              disabled={!heroTitle.trim()}
              className="flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SiriOrb className="h-[14px] w-[14px]" active={false} />
              Fill with AI
            </button>
          </div>
        </Field>
      </div>
    </div>

    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
      <div className="rounded-[19px] bg-white p-[22px]">
        <button
          type="button"
          onClick={() => setHowItWorksOpen((o) => !o)}
          aria-expanded={howItWorksOpen}
          className="flex w-full items-center gap-[8px] text-left"
        >
          <p className="text-sm text-[#141B2E]">How posting a job works</p>
          <ChevronDownIcon
            className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${howItWorksOpen ? "" : "-rotate-90"}`}
          />
        </button>
        {howItWorksOpen && (
          <div className="mt-[12px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1, title: "Start with a title", detail: "Type a job title above, then fill it in yourself or let AI draft it." },
              { step: 2, title: "Fill in the details", detail: "Role details, then screening requirements like experience and languages." },
              { step: 3, title: "Preview & submit", detail: "Check the jobseeker view, then post it or save as a draft for later." },
              { step: 4, title: "Reviewed, then live", detail: "A superadmin reviews submitted postings before they go Active." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-teal-dark text-xs text-white">
                  {s.step}
                </span>
                <p className="mt-[4px] text-xs text-[#141B2E]">{s.title}</p>
                <p className="text-xs text-[#4B5468]">{s.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
      <div className="rounded-[19px] bg-white p-[22px]">
        <p className="mb-[12px] text-sm text-[#141B2E]">Hiring pipeline at a glance</p>
        <div className="grid grid-cols-4 gap-[12px]">
          {tiles.map((tile) => {
            const Icon = STATUS_TILE_ICON[tile.label];
            const color = STATUS_TILE_COLOR[tile.label];
            const gradient = STATUS_TILE_GRADIENT[tile.label];
            const hasMatches = tile.label === "Total postings" ? postings.length > 0 : tile.count > 0;
            return (
              <button
                key={tile.label}
                type="button"
                disabled={!hasMatches}
                onClick={() => {
                  const id = tile.label === "Total postings" ? "job-postings-list" : `status-section-${tile.label}`;
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{ backgroundImage: `linear-gradient(to bottom, ${gradient}, white 90%)` }}
                className={`gradient-noise group relative flex flex-col gap-[4px] overflow-hidden rounded-[14px] p-[14px] text-left transition-opacity ${
                  hasMatches ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-60"
                }`}
              >
                <span aria-hidden className="pointer-events-none absolute -top-[10%] -right-[10%]">
                  <Icon
                    className="icon-gradient-color h-[48px] w-[48px] opacity-40"
                    strokeWidth={0.7}
                    style={{ "--icon-accent": gradient } as React.CSSProperties}
                  />
                </span>
                <div className="relative flex items-start justify-between">
                  <span className="text-xl text-[#141B2E]">{tile.count}</span>
                  <Icon className={`h-[16px] w-[16px] ${color.text}`} />
                </div>
                <span className={`relative text-xs ${color.text}`}>{tile.label}</span>
              </button>
            );
          })}
        </div>

        <div id="job-postings-list" className="mt-[24px] scroll-mt-[100px]">
          <p className="text-sm text-[#141B2E]">Your job postings, organized by status</p>
          {actionError && <p className="mt-[6px] text-xs text-red-500">{actionError}</p>}
          <div className="mt-[10px] flex flex-col gap-[10px]">
            {STATUS_ORDER.map((status, index) => {
              const statusPostings = postings.filter((p) => p.status === status);
              if (statusPostings.length === 0) return null;
              const collapsed = collapsedStatuses.has(status);
              return (
                <div
                  key={status}
                  id={`status-section-${status}`}
                  className={`animate-fade-in-up ${gradientFrameClass("teal")} scroll-mt-[100px]`}
                  style={{ animationDelay: `${180 + index * 40}ms` }}
                >
                <div className="rounded-[19px] bg-white p-[22px]">
                  <button
                    type="button"
                    onClick={() => toggleStatusCollapsed(status)}
                    aria-expanded={!collapsed}
                    className="flex w-full items-center gap-[8px] text-left"
                  >
                    <span
                      className={`rounded-full px-[10px] py-[3px] text-xs ${STATUS_TILE_COLOR[status].bg} ${STATUS_TILE_COLOR[status].text}`}
                    >
                      {status}
                    </span>
                    <span className="text-xs text-[#9AA3B2]">{statusPostings.length}</span>
                    <ChevronDownIcon
                      className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                  {!collapsed && (
                  <div className="mt-[10px] flex flex-col gap-[10px]">
                    {statusPostings.map((posting) => (
                      <div
                        key={posting.id}
                        onClick={() => {
                          if (["Active", "Filled", "Closed", "Flagged"].includes(posting.status)) {
                            router.push(`/employer/jobs/${posting.slug}`);
                          } else {
                            setViewing(posting);
                          }
                        }}
                        className="flex flex-col gap-[8px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] cursor-pointer transition-colors hover:bg-[#F1F4F8] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-[8px]">
                            <p className="truncate text-sm text-[#141B2E]">{posting.title}</p>
                          </div>
                          <div className="mt-[4px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                            <span>{posting.location}</span>
                            <span className="text-[#C7CDD7]">·</span>
                            <span>{posting.employmentType}</span>
                            <span className="text-[#C7CDD7]">·</span>
                            <span>{posting.workArrangement}</span>
                            <span className="text-[#C7CDD7]">·</span>
                            <span>
                              RM{posting.salaryMin.toLocaleString()}–{posting.salaryMax.toLocaleString()}
                            </span>
                            <span className="text-[#C7CDD7]">·</span>
                            <span>
                              {posting.openings} opening{posting.openings === 1 ? "" : "s"}
                            </span>
                            <span className="text-[#C7CDD7]">·</span>
                            <span>
                              {posting.minYearsExperience === 0
                                ? "No experience required"
                                : `${posting.minYearsExperience}+ yrs experience`}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-[12px] text-xs">
                          <span className="text-[#9AA3B2]">
                            {posting.views} view{posting.views === 1 ? "" : "s"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/employer/applicants?jobId=${posting.id}`);
                            }}
                            className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-sm text-brand-teal-dark transition-colors hover:bg-[#D2F3F5]"
                          >
                            {posting.applicants} applicants
                          </button>
                          <span className="text-[#9AA3B2]">{posting.posted}</span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <PostingActionsMenu
                              posting={posting}
                              onView={() => setViewing(posting)}
                              onEdit={() => router.push(`/employer/jobs/postajob?id=${posting.id}`)}
                              onDuplicate={() => duplicate(posting.id)}
                              onCloseJob={() => closeJob(posting.id)}
                              onDelete={() => deletePosting(posting.id)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {viewing && (
        <PostingDetailsModal 
          posting={viewing} 
          onClose={() => setViewing(null)}
          onResubmit={resubmitPosting}
        />
      )}
    </div>
    </div>

    <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:flex-[1]">
      <div className={gradientFrameClass("teal")}>
        <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[22px]">
          <div>
            <p className="text-sm text-[#141B2E]">Poster generator</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Turn an active posting into a ready-to-share 9:16 poster for Instagram Stories, WhatsApp
              Status, and more.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/employer/jobs/poster-generator")}
            className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90"
          >
            Open poster generator
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

export default function EmployerJobsView({
  authUser,
  mode = "list",
  initialPostings = [],
  addresses = [],
}: {
  authUser: AuthUser;
  mode?: "list" | "post";
  initialPostings?: DbJobPosting[];
  addresses?: EmployerAddress[];
}) {
  const router = useRouter();
  const composing = mode === "post";
  const postJobFormRef = useRef<PostJobFormHandle>(null);
  const [dummyBusy, setDummyBusy] = useState(false);
  const hasDummyData = initialPostings.some((p) => p.postingName === DUMMY_POSTING_MARKER);

  async function toggleDummyData() {
    setDummyBusy(true);
    try {
      if (hasDummyData) {
        // Applicants reference postings, so clear them first — otherwise
        // deleting the postings cascades their applications away silently
        // instead of going through the applicants button's own cleanup.
        await fetch("/api/employer/applications/dummy", { method: "DELETE" });
        await fetch("/api/employer/job-postings/dummy", { method: "DELETE" });
        await fetch("/api/employer/dummy-companies", { method: "DELETE" });
      } else {
        await fetch("/api/employer/job-postings/dummy", { method: "POST" });
        await fetch("/api/employer/applications/dummy", { method: "POST" });
        await fetch("/api/employer/dummy-companies", { method: "POST" });
      }
      window.dispatchEvent(new Event(COMPANIES_CHANGED_EVENT));
      router.refresh();
    } finally {
      setDummyBusy(false);
    }
  }

  const guardNavigation: NavigationGuard = (proceed) => {
    if (composing && postJobFormRef.current) {
      postJobFormRef.current.guardNavigation(proceed);
    } else {
      proceed();
    }
  };
  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="jobs"
      heading={composing ? "Post a job" : "Manage Job"}
      headerAction={
        composing ? (
          <button
            type="button"
            onClick={() => guardNavigation(() => router.push("/employer/jobs"))}
            className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[22px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
          >
            Cancel
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-[8px]">
            <button
              type="button"
              disabled={dummyBusy}
              onClick={toggleDummyData}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hasDummyData ? "Remove dummy data" : "Get dummy data"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/employer/jobs/postajob")}
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark px-[22px] text-sm text-white transition-opacity hover:opacity-90"
            >
              Post a job
            </button>
          </div>
        )
      }
      subheading={
        composing
          ? "Fill in the details below."
          : "Post roles and track applicants once you're ready to hire."
      }
    >
      {/* EmployerDashboardShell's sidebar reads the guard from its own
          UnsavedChangesGuardBoundary, which only sees registrations from
          genuine descendants — this component itself sits above that
          Boundary (it renders EmployerDashboardShell, not the other way
          around), so the registration has to happen from inside `children`
          like this, not from EmployerJobsView's own body. */}
      <GuardRegistrar guard={guardNavigation} />
      {composing ? (
        <PostJobForm ref={postJobFormRef} onClose={() => router.push("/employer/jobs")} addresses={addresses} />
      ) : (
        <JobPostingsPanel
          key={initialPostings.map((p) => p.id).join(",")}
          initialPostings={initialPostings}
        />
      )}
    </EmployerDashboardShell>
  );
}

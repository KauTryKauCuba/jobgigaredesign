"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import AnimatedRibbon from "./AnimatedRibbon";
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
  MAX_CHOICE_OPTIONS,
  SCREENING_QUESTION_TYPE_LABEL,
  SCREENING_QUESTION_TYPES,
  SUGGESTED_QUESTION_GROUPS,
  isScorableQuestion,
  questionType,
  toPublicQuestion,
  type CustomQuestion,
  type PreferrableRequirement,
  type ScreeningQuestionType,
  type SuggestedQuestion,
} from "@/lib/screening-questions";
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
  SearchIcon,
  StackIcon,
  TrashIcon,
  UserIcon,
  XCircleIcon,
  XIcon,
} from "./icons";
import JobTitleIllustration from "./JobTitleIllustration";
import SiriOrb from "./SiriOrb";
import type { AuthUser } from "./AuthModal";
import type { EmployerAddress } from "@/lib/employer-profile";
import { MALAYSIA_STATES } from "@/lib/malaysia";
import { INDUSTRIES } from "@/lib/industries";
import { defaultJobAddress } from "@/lib/job-address";
import {
  canonicalLanguage,
  formatLanguageRequirement,
  LANGUAGE_OPTIONS,
  languageDialects,
  normalizeLanguageRequirements,
  sameLanguage,
} from "@/lib/languages";
import {
  compareSalaryRange,
  formatSalary,
  isSalaryPeriod,
  isStartAvailability,
  startAvailabilityLabel,
  MAX_POSTING_BENEFITS,
  MAX_WORKING_HOURS_LENGTH,
  OFFICE_DAYS_OPTIONS,
  officeDaysLabel,
  POSTING_BENEFITS,
  REMOTE_LOCATION,
  SALARY_PERIODS,
  type SalaryPeriod,
  START_AVAILABILITY,
  type StartAvailability,
  WORKING_HOURS_PRESETS,
} from "@/lib/job-posting-options";
import { postingLocationLabel } from "@/lib/postingLocation";
import { plainTextToHtml } from "@/lib/richText";
import JobPostingDetails, {
  EMPLOYMENT_TYPE_LABEL as JOBSEEKER_EMPLOYMENT_TYPE_LABEL,
  PostingCard,
  WORK_ARRANGEMENT_LABEL as JOBSEEKER_WORK_ARRANGEMENT_LABEL,
  type JobPosting,
} from "./JobPostingDetails";
import type { SalaryInsight } from "@/lib/salary-insights";

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
  // Formatted range, e.g. "RM3,000–4,500/month", with "(hidden)" when the
  // posting doesn't show it to jobseekers.
  salary: string;
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
  Active: { bg: "bg-brand-teal-soft", border: "border-[#CFF4F6]", text: "text-brand-teal-dark" },
  Pending: { bg: "bg-brand-gold-soft", border: "border-[#FBE7B3]", text: "text-brand-gold-dark" },
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
  { value: "freelance", label: "Freelance" },
  { value: "temporary", label: "Temporary" },
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
// A teammate who can be shown as a posting's contact (public details only).
export type ContactOption = { userId: string; name: string; position: string | null; avatarUrl: string | null };

// A team member with the Hiring manager role, assignable to a posting.
export type HiringManagerOption = {
  teamMemberId: string;
  name: string;
  email: string;
  position: string | null;
  avatarUrl: string | null;
  // Invited but hasn't joined yet — still assignable.
  pending: boolean;
};
// The posting company as jobseekers see it — for the form's preview.
export type PostingCompany = { name: string; logoUrl: string | null };

// The language picker's "Other (type it)" choice.
const OTHER_LANGUAGE = "__other__";

// Field ids that only render on the screening step — goToField uses this to
// switch steps before it tries to scroll to one of them.
const SCREENING_FIELD_IDS = new Set(["minYearsExperience", "minQualificationTier", "languageScreening", "workAuthorizations", "customQuestionInput"]);
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
// ONE dialect, or null for "any dialect" (see src/lib/languages.ts).
type RequiredLanguage = { language: string; dialect: string | null; level: LanguageLevel };

// Shown next to a field's label so the mapping to a jobseeker-profile field
// is visible on the form itself, not just documented in comments.
// Example min/max for the salary inputs, sized to the chosen pay period.
const SALARY_PLACEHOLDERS: Record<SalaryPeriod, [number, number]> = {
  month: [3000, 4500],
  hour: [12, 18],
  day: [100, 150],
  project: [2000, 5000],
};

function MatchHint({ field }: { field: string | string[] }) {
  const fields = Array.isArray(field) ? field.join(" + ") : field;
  return (
    <span className="rounded-full bg-brand-teal-soft px-[8px] py-[2px] text-xs whitespace-nowrap text-brand-teal-dark">
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

// Required (a miss marks the applicant not eligible) or Preferred (a hit
// boosts the match score, a miss costs nothing).
function PriorityToggle({
  preferred,
  onChange,
  disabled = false,
}: {
  preferred: boolean;
  onChange: (preferred: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span
      role="group"
      aria-label="How strict is this requirement"
      title="Required: applicants who miss it are marked not eligible. Preferred: meeting it boosts the match score; missing it costs nothing."
      className={`flex items-center rounded-full bg-[#F1F4F8] p-[2px] text-xs ${disabled ? "opacity-40" : ""}`}
    >
      {([false, true] as const).map((value) => (
        <button
          key={String(value)}
          type="button"
          disabled={disabled}
          aria-pressed={preferred === value}
          onClick={() => onChange(value)}
          className={`rounded-full px-[10px] py-[2px] whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
            preferred === value ? "bg-white text-brand-teal-dark shadow-sm" : "text-[#4B5468] hover:text-[#141B2E]"
          }`}
        >
          {value ? "Preferred" : "Required"}
        </button>
      ))}
    </span>
  );
}

const inputClass = formInputClass("teal");

export type PostJobFormHandle = { guardNavigation: (proceed: () => void) => void };

const PostJobForm = forwardRef<
  PostJobFormHandle,
  {
    onClose: () => void;
    addresses: EmployerAddress[];
    companyBenefits: string[];
    contactOptions: ContactOption[];
    hiringManagerOptions: HiringManagerOption[];
    currentUserId: string | null;
    company: PostingCompany | null;
  }
>(
  function PostJobForm(
    { onClose, addresses, companyBenefits, contactOptions, hiringManagerOptions, currentUserId, company },
    ref,
  ) {
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
  // Hybrid only — "" = not said.
  const [officeDays, setOfficeDays] = useState("");
  // A brand-new posting starts at the company's default address for job
  // posts (its only address, or the one marked in Company Profile); editing
  // an existing posting loads that posting's own location instead.
  const [startAddress] = useState(() => (editingId ? null : defaultJobAddress(addresses)));
  const startLocation = startAddress
    ? postingLocationLabel(startAddress.area ?? "", startAddress.city, startAddress.state)
    : "";
  const [selectedAddressId, setSelectedAddressId] = useState(startAddress?.id ?? "");
  const [location, setLocation] = useState(startLocation);
  const [addressLine1, setAddressLine1] = useState(startAddress?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(startAddress?.addressLine2 ?? "");
  const [area, setArea] = useState(startAddress?.area ?? "");
  const [city, setCity] = useState(startAddress?.city ?? "");
  const [state, setState] = useState<(typeof MALAYSIA_STATES)[number] | "">(
    () => MALAYSIA_STATES.find((s) => s === startAddress?.state) ?? "",
  );
  const [postcode, setPostcode] = useState(startAddress?.postcode ?? "");
  // Benefits & working conditions. A brand-new posting starts with the
  // company's own benefits (from Company Profile) and the person posting it
  // as the contact; editing loads the posting's saved values instead.
  const [startDefaults] = useState(() => ({
    benefits: editingId ? [] : companyBenefits,
    contactUserId: editingId ? "" : contactOptions.some((c) => c.userId === currentUserId) ? (currentUserId ?? "") : "",
  }));
  const [benefits, setBenefits] = useState<string[]>(startDefaults.benefits);
  const [benefitInput, setBenefitInput] = useState("");
  const [startAvailability, setStartAvailability] = useState<StartAvailability | "">("");
  const [workingHours, setWorkingHours] = useState("");
  const [contactUserId, setContactUserId] = useState(startDefaults.contactUserId);
  // Team-member ids of the Hiring managers covering this posting.
  const [hiringManagerIds, setHiringManagerIds] = useState<string[]>([]);
  // Hiring managers invited from this form (quick add), on top of the server's list.
  const [invitedManagers, setInvitedManagers] = useState<HiringManagerOption[]>([]);
  const [showQuickInvite, setShowQuickInvite] = useState(false);
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPosition, setQuickPosition] = useState("");
  const [quickSending, setQuickSending] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const allHiringManagers = [
    ...hiringManagerOptions,
    ...invitedManagers.filter((i) => !hiringManagerOptions.some((o) => o.teamMemberId === i.teamMemberId)),
  ];
  const closeQuickInvite = () => {
    setShowQuickInvite(false);
    setQuickEmail("");
    setQuickPosition("");
    setQuickError(null);
  };
  async function sendQuickInvite() {
    const email = quickEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      setQuickError("Enter a valid email.");
      return;
    }
    // Already a hiring manager here — just tick them instead of inviting twice.
    const existing = allHiringManagers.find((m) => m.email.toLowerCase() === email);
    if (existing) {
      setHiringManagerIds((prev) => (prev.includes(existing.teamMemberId) ? prev : [...prev, existing.teamMemberId]));
      closeQuickInvite();
      return;
    }
    setQuickSending(true);
    setQuickError(null);
    try {
      const res = await fetch("/api/employer/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "hiring_manager", position: quickPosition.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the invite.");
      const member = (data.members as { id: string; email: string; name: string | null; position: string | null; avatarUrl: string | null }[] | undefined)?.find(
        (m) => m.email.toLowerCase() === email,
      );
      if (member) {
        setInvitedManagers((prev) => [
          ...prev,
          {
            teamMemberId: member.id,
            name: member.name || member.email,
            email: member.email,
            position: member.position,
            avatarUrl: member.avatarUrl,
            pending: true,
          },
        ]);
        setHiringManagerIds((prev) => [...prev, member.id]);
      }
      closeQuickInvite();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Couldn't send the invite.");
    } finally {
      setQuickSending(false);
    }
  }
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>("month");
  const [showSalary, setShowSalary] = useState(true);
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
  const [languagePick, setLanguagePick] = useState("");
  // For a language with dialects: which one is required — "" for any dialect.
  const [dialectPick, setDialectPick] = useState("");
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
  const [customQuestionType, setCustomQuestionType] = useState<ScreeningQuestionType>("yesno");
  // Multiple choice: what applicants pick from, and which picks are accepted.
  const [choiceOptions, setChoiceOptions] = useState<string[]>([]);
  const [choiceAccepted, setChoiceAccepted] = useState<string[]>([]);
  const [choiceInput, setChoiceInput] = useState("");
  // Number: the lowest accepted answer ("" = no minimum, just collect it).
  const [customQuestionMin, setCustomQuestionMin] = useState("");
  const [customQuestionPreferred, setCustomQuestionPreferred] = useState(false);
  const [customQuestionError, setCustomQuestionError] = useState<string | null>(null);
  // Which category of the ready-made questions is showing.
  const [suggestionGroup, setSuggestionGroup] = useState(SUGGESTED_QUESTION_GROUPS[0].label);
  // Built-in requirements marked Preferred rather than Required.
  const [screeningPreferred, setScreeningPreferred] = useState<PreferrableRequirement[]>([]);
  const [formStep, setFormStep] = useState<"details" | "screening">("details");

  function setRequirementPreferred(key: PreferrableRequirement, preferred: boolean) {
    setScreeningPreferred((prev) => (preferred ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)));
  }

  function addChoiceOption() {
    const value = choiceInput.trim();
    if (!value) return;
    if (choiceOptions.some((o) => o.toLowerCase() === value.toLowerCase())) {
      setCustomQuestionError("That option is already there.");
      return;
    }
    if (choiceOptions.length >= MAX_CHOICE_OPTIONS) {
      setCustomQuestionError(`Up to ${MAX_CHOICE_OPTIONS} options.`);
      return;
    }
    setCustomQuestionError(null);
    setChoiceOptions((prev) => [...prev, value]);
    // New options start accepted — the employer un-ticks the ones that don't qualify.
    setChoiceAccepted((prev) => [...prev, value]);
    setChoiceInput("");
  }

  function removeChoiceOption(option: string) {
    setChoiceOptions((prev) => prev.filter((o) => o !== option));
    setChoiceAccepted((prev) => prev.filter((o) => o !== option));
  }

  function resetCustomQuestionBuilder() {
    setCustomQuestionInput("");
    setChoiceOptions([]);
    setChoiceAccepted([]);
    setChoiceInput("");
    setCustomQuestionMin("");
    setCustomQuestionPreferred(false);
    setCustomQuestionError(null);
  }

  // A picker chip: Yes/No and Short answer go straight in; Multiple choice and
  // Number fill the builder so the employer sets what qualifies, then presses Add.
  function applySuggestion(item: SuggestedQuestion) {
    if (item.type === "yesno" || item.type === "text") {
      addCustomQuestion({ question: item.question, type: item.type });
      return;
    }
    resetCustomQuestionBuilder();
    setCustomQuestionType(item.type);
    setCustomQuestionInput(item.question);
    if (item.type === "choice" && item.options) {
      setChoiceOptions(item.options);
      // Every option starts as qualifying — the employer unticks the ones that don't.
      setChoiceAccepted(item.options);
    }
    document.getElementById("customQuestionInput")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function addCustomQuestion(suggestion?: { question: string; type: "yesno" | "text" }) {
    const textOverride = suggestion?.question;
    const value = (textOverride ?? customQuestionInput).trim();
    if (!value) return;
    const type: ScreeningQuestionType = suggestion ? suggestion.type : customQuestionType;
    if (customQuestions.some((q) => q.question.toLowerCase() === value.toLowerCase())) {
      setCustomQuestionError("You've already added that question.");
      return;
    }
    const base = { id: crypto.randomUUID(), question: value, type, requiredAnswer: true };
    let question: CustomQuestion;
    if (type === "choice") {
      if (choiceOptions.length < 2) {
        setCustomQuestionError("Add at least two options.");
        return;
      }
      if (choiceAccepted.length === 0) {
        setCustomQuestionError("Tick at least one option that qualifies.");
        return;
      }
      question = { ...base, options: choiceOptions, acceptedOptions: choiceAccepted };
    } else if (type === "number") {
      const min = customQuestionMin.trim() === "" ? null : Number(customQuestionMin);
      if (min !== null && !Number.isFinite(min)) {
        setCustomQuestionError("Enter a valid minimum.");
        return;
      }
      question = { ...base, minNumber: min };
    } else if (type === "text") {
      question = base;
    } else {
      question = { ...base, requiredAnswer: textOverride ? true : customQuestionRequiredAnswer };
    }
    if (customQuestionPreferred && !textOverride && isScorableQuestion(question)) question.preferred = true;
    setCustomQuestions((prev) => [...prev, question]);
    // A suggestion chip shouldn't wipe a question the employer is mid-typing.
    if (textOverride) setCustomQuestionError(null);
    else resetCustomQuestionBuilder();
  }

  function removeCustomQuestion(id: string) {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function setQuestionPreferred(id: string, preferred: boolean) {
    setCustomQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, preferred } : q)));
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
  // Salary card: the AI's suggested range and what jobseekers on JobGiga
  // targeting a similar role expect. Each is kept with what it was made for
  // (title and pay period; title, industry and state) and only shown while
  // those still match — so changing the title never leaves another role's
  // numbers on screen.
  const [salarySuggestion, setSalarySuggestion] = useState<{
    min: number;
    max: number;
    period: SalaryPeriod;
    reason: string | null;
    title: string;
  } | null>(null);
  const [suggestingSalary, setSuggestingSalary] = useState(false);
  const [salarySuggestError, setSalarySuggestError] = useState<string | null>(null);
  const [salaryInsight, setSalaryInsight] = useState<{ key: string; insight: SalaryInsight | null } | null>(null);
  const salaryInsightKey = `${title.trim().toLowerCase()}|${industry}|${state}`;

  async function suggestSalary() {
    if (!title.trim()) return;
    setSuggestingSalary(true);
    setSalarySuggestError(null);
    try {
      const res = await fetch("/api/employer/suggest-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: title.trim(),
          salaryPeriod,
          employmentType,
          workArrangement,
          location: workArrangement === "remote" && !location.trim() ? "Remote (Malaysia)" : location.trim(),
          industry: industry || null,
          minYearsExperience: minYearsExperience.trim() ? Number(minYearsExperience) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.suggestion) {
        setSalarySuggestError(data.error ?? "Couldn't suggest a salary. Try again.");
        return;
      }
      setSalarySuggestion({ ...data.suggestion, title: title.trim().toLowerCase() });
    } catch {
      setSalarySuggestError("Couldn't reach the suggestion service. Try again.");
    } finally {
      setSuggestingSalary(false);
    }
  }

  // Candidate expectations are monthly, so only fetched for monthly pay —
  // debounced while the title is being typed.
  useEffect(() => {
    const trimmed = title.trim();
    // (A stale result is hidden by `visibleSalaryInsight` — it carries the
    // key it was fetched for — instead of cleared here.)
    if (!trimmed || salaryPeriod !== "month") return;
    const key = `${trimmed.toLowerCase()}|${industry}|${state}`;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ title: trimmed });
      if (industry) params.set("industry", industry);
      if (state) params.set("state", state);
      fetch(`/api/employer/salary-insights?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setSalaryInsight({ key, insight: data?.insight ?? null }))
        .catch(() => {});
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [title, industry, state, salaryPeriod]);

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
        setBenefits(posting.benefits ?? []);
        setStartAvailability(isStartAvailability(posting.startAvailability) ? posting.startAvailability : "");
        setWorkingHours(posting.workingHours ?? "");
        setContactUserId(posting.contactUserId ?? "");
        setHiringManagerIds(posting.hiringManagerIds ?? []);
        setTitle(posting.title);
        setDescription(plainTextToHtml(posting.description));
        setResponsibilities(plainTextToHtml(posting.responsibilities));
        setIndustry((posting.industry as (typeof INDUSTRIES)[number] | null) ?? "");
        setEmploymentType(posting.employmentType as (typeof EMPLOYMENT_TYPES)[number]["value"]);
        setWorkArrangement(posting.workArrangement as (typeof WORK_ARRANGEMENTS)[number]["value"]);
        // A remote posting saved without an address stores "Remote" as its
        // location — that's a display fallback, not something the employer typed.
        setLocation(posting.location === REMOTE_LOCATION && !posting.city ? "" : posting.location);
        setOfficeDays(posting.officeDaysPerWeek ? String(posting.officeDaysPerWeek) : "");
        setAddressLine1(posting.addressLine1 ?? "");
        setAddressLine2(posting.addressLine2 ?? "");
        setArea(posting.area ?? "");
        setCity(posting.city ?? "");
        setState((posting.state as (typeof MALAYSIA_STATES)[number] | null) ?? "");
        setPostcode(posting.postcode ?? "");
        setSalaryMin(posting.salaryMin !== null ? String(posting.salaryMin) : "");
        setSalaryMax(posting.salaryMax !== null ? String(posting.salaryMax) : "");
        setSalaryPeriod(isSalaryPeriod(posting.salaryPeriod) ? posting.salaryPeriod : "month");
        setShowSalary(posting.showSalary);
        setOpenings(String(posting.openings));
        setSkills(posting.skills);
        setSoftSkills(posting.softSkills);
        setNiceToHaveSkills(posting.niceToHaveSkills);
        setMinYearsExperience(posting.minYearsExperience !== null ? String(posting.minYearsExperience) : "");
        setMinQualificationTier((posting.minQualificationTier as (typeof QUALIFICATION_TIERS)[number] | null) ?? "");
        // Read through the language list, so a requirement saved under an
        // older name ("Hokkien") opens as Chinese with Hokkien.
        setLanguages(normalizeLanguageRequirements(posting.languages as RequiredLanguage[]));
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
        setScreeningPreferred((posting.screeningPreferred ?? []) as PreferrableRequirement[]);
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
        languages: { language: string; dialect?: string | null; level: LanguageLevel }[];
        workAuthorizations: string[];
        drivingLicense: (typeof DRIVING_LICENSES)[number]["value"] | null;
      };

      // Only fills fields the employer hasn't already set by hand — same
      // rule as the company-profile "Fill with AI", so a generated
      // suggestion never clobbers a manual edit.
      // The internal posting name starts as the job title ("Graphic
      // Designer"), ready to add a tag like "— KL Branch (Urgent)".
      setPostingName((prev) => (prev.trim() ? prev : jobTitle));
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
      // The AI's range is always monthly — only used when the posting is too.
      if (salaryPeriod === "month") {
        if (result.salaryMin !== null && !salaryMin.trim()) setSalaryMin(String(result.salaryMin));
        if (result.salaryMax !== null && !salaryMax.trim()) setSalaryMax(String(result.salaryMax));
      }
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
        // A language already required (in any dialect) isn't added again.
        setLanguages((prev) => {
          const additions = result.languages
            .filter((l) => !prev.some((p) => sameLanguage(p.language, l.language)))
            .map((l) => ({ ...l, dialect: l.dialect ?? null }));
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

  function addBenefit(value: string) {
    const b = value.trim().slice(0, 60);
    setBenefitInput("");
    if (!b) return;
    setBenefits((prev) =>
      prev.length >= MAX_POSTING_BENEFITS || prev.some((x) => x.toLowerCase() === b.toLowerCase()) ? prev : [...prev, b],
    );
  }

  // A language can be required more than once with different dialects (e.g.
  // Cantonese and Hokkien), never the same language+dialect twice.
  const isRequired = (language: string, dialect: string | null) =>
    languages.some(
      (l) => sameLanguage(l.language, language) && (l.dialect ?? "").toLowerCase() === (dialect ?? "").toLowerCase(),
    );
  // The picked language's dialect choices: "Any dialect" first, then its
  // dialects — minus the ones already required. Empty if it has no dialects.
  const dialectChoices = languageDialects(languagePick).length
    ? [
        ...(isRequired(languagePick, null) ? [] : [{ value: "", label: "Any dialect" }]),
        ...languageDialects(languagePick)
          .filter((d) => !isRequired(languagePick, d))
          .map((d) => ({ value: d, label: d })),
      ]
    : [];

  function pickLanguage(value: string) {
    setLanguagePick(value);
    // Starts on "Any dialect" (or the first dialect not required yet).
    const dialects = languageDialects(value);
    setDialectPick(dialects.length && isRequired(value, null) ? (dialects.find((d) => !isRequired(value, d)) ?? "") : "");
  }

  function addLanguage() {
    // A listed language, or (via "Other") whatever was typed — standardised
    // either way, so a typed "BM" still lands as "Malay".
    const value = canonicalLanguage(languagePick === OTHER_LANGUAGE ? languageInput : languagePick);
    const dialect = languageDialects(value).length ? dialectPick || null : null;
    if (value && !isRequired(value, dialect)) {
      setLanguages((prev) => [...prev, { language: value, dialect, level: languageLevelInput }]);
    }
    setLanguagePick("");
    setDialectPick("");
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
    { label: "Job type", done: !!employmentType, fieldId: "jobEmploymentType" },
    { label: "Where", done: !!workArrangement, fieldId: "jobWorkArrangement" },
    // Remote roles don't need an address.
    { label: "Location", done: location.trim().length > 0 || workArrangement === "remote", fieldId: "jobAddressLine1" },
    { label: "Skills required", done: skills.length > 0, fieldId: "skillInput" },
  ];
  const formValid = requiredFieldChecklist.every((item) => item.done);

  // Not required to post, but each one narrows the candidate pool or makes
  // the posting more appealing — friendly nudges, not blockers. Listed in
  // the same order as the form's cards, top to bottom.
  const boostChecklist = [
    {
      label: "Name this posting internally — helps you tell postings apart at a glance.",
      done: postingName.trim().length > 0,
      fieldId: "jobPostingName",
    },
    {
      label: "Add languages — shows candidates what the role needs day to day.",
      done: languages.length > 0,
      fieldId: "languageInput",
    },
    {
      label: "Set a salary range — postings with pay listed get more applicants.",
      done: salaryMin.trim().length > 0 && salaryMax.trim().length > 0,
      fieldId: "salaryMin",
    },
    {
      label: "Show the salary on the posting — hidden pay puts many jobseekers off applying.",
      done: showSalary,
      fieldId: "showSalary",
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
      label: "Set a start date — tells candidates whether their notice period works.",
      done: startAvailability !== "",
      fieldId: "jobStartAvailability",
    },
    {
      label: "Add working hours — candidates want to know the schedule before applying.",
      done: workingHours.trim().length > 0,
      fieldId: "jobWorkingHours",
    },
    {
      label: "List benefits — one of the first things candidates compare between jobs.",
      done: benefits.length > 0,
      fieldId: "jobBenefitInput",
    },
    {
      label: "Pick a contact person — a real name on the posting builds trust.",
      done: contactUserId !== "",
      fieldId: "jobContactPerson",
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
            label: "Screen by language — makes sure candidates can communicate on the job.",
            done: askLanguages && languages.length > 0,
            fieldId: "languageScreening",
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

  // The posting as jobseekers will see it on the jobseeker landing page —
  // built from this form, shown in "Preview as jobseeker". Screening fields
  // follow the same "only when asked" rules as the saved payload below.
  const previewContact = contactOptions.find((c) => c.userId === contactUserId);
  const previewPosting: JobPosting = {
    id: "preview",
    title: title.trim() || "Job title not set",
    company: company?.name ?? "Your company",
    logoUrl: company?.logoUrl ?? null,
    jobType: JOBSEEKER_EMPLOYMENT_TYPE_LABEL[employmentType] ?? employmentType,
    location: location.trim() || (workArrangement === "remote" ? REMOTE_LOCATION : "Not specified"),
    addressLine1: addressLine1.trim() || null,
    addressLine2: addressLine2.trim() || null,
    area: area.trim() || null,
    city: city.trim() || null,
    state: state || null,
    postcode: postcode.trim() || null,
    salary:
      (showSalary && formatSalary(Number(salaryMin) || null, Number(salaryMax) || null, salaryPeriod, "long")) ||
      "Salary not disclosed",
    postedAgo: "just now",
    description,
    responsibilities,
    industry: industry || "Not specified",
    workArrangement: JOBSEEKER_WORK_ARRANGEMENT_LABEL[workArrangement] ?? workArrangement,
    openings: Number(openings) || 1,
    skills,
    softSkills,
    minYearsExperience:
      screeningEnabled && askMinExperience && minYearsExperience.trim() ? Number(minYearsExperience) : null,
    minQualificationTier: (screeningEnabled && askMinEducation && minQualificationTier) || "No requirement",
    drivingLicense: (screeningEnabled && askDrivingLicense && drivingLicense) || undefined,
    languages,
    screeningLanguages: askLanguages ? languages : [],
    benefits,
    startLabel: startAvailabilityLabel(startAvailability),
    workingHours: workingHours.trim() || null,
    officeDays: workArrangement === "hybrid" && officeDays ? officeDaysLabel(Number(officeDays)) : null,
    contact: previewContact
      ? { name: previewContact.name, position: previewContact.position, avatarUrl: previewContact.avatarUrl }
      : null,
    workAuthorizations: screeningEnabled && askWorkAuthorizations ? workAuthorizations : [],
    screeningEnabled,
    customQuestions: screeningEnabled ? customQuestions.map(toPublicQuestion) : [],
  };

  // Salary card's competitiveness hint — against the AI's range for this
  // pay period when there is one, otherwise against what matching
  // candidates expect (monthly only).
  const activeSalarySuggestion =
    salarySuggestion?.period === salaryPeriod && salarySuggestion.title === title.trim().toLowerCase() ? salarySuggestion : null;
  const enteredSalary = { min: Number(salaryMin) || null, max: Number(salaryMax) || null };
  const salaryPlace = workArrangement === "remote" && !city.trim() ? "remote roles" : `${city.trim() || state || "Malaysia"}`;
  const visibleSalaryInsight =
    salaryPeriod === "month" && title.trim() && salaryInsight?.key === salaryInsightKey ? salaryInsight.insight : null;
  const aiSalaryComparison = compareSalaryRange(enteredSalary, activeSalarySuggestion);
  const candidateSalaryComparison =
    !aiSalaryComparison && visibleSalaryInsight
      ? compareSalaryRange(enteredSalary, { min: visibleSalaryInsight.typicalMin, max: visibleSalaryInsight.typicalMax })
      : null;
  const salaryHint = aiSalaryComparison
    ? {
        tone: aiSalaryComparison,
        text:
          aiSalaryComparison === "below"
            ? `Below typical for this role in ${salaryPlace} — may attract fewer applicants.`
            : aiSalaryComparison === "above"
              ? `Above typical for this role in ${salaryPlace} — should stand out to candidates.`
              : `Competitive for this role in ${salaryPlace}.`,
      }
    : candidateSalaryComparison
      ? {
          tone: candidateSalaryComparison,
          text:
            candidateSalaryComparison === "below"
              ? "Below what most matching candidates on JobGiga expect."
              : candidateSalaryComparison === "above"
                ? "Above what most matching candidates on JobGiga expect."
                : "In line with what matching candidates on JobGiga expect.",
        }
      : null;

  // Anything the employer has typed or picked, beyond the untouched
  // defaults — used to decide whether leaving needs a confirmation at all.
  const hasUnsavedInput =
    postingName.trim().length > 0 ||
    benefits.join("|") !== startDefaults.benefits.join("|") ||
    startAvailability !== "" ||
    workingHours.trim().length > 0 ||
    contactUserId !== startDefaults.contactUserId ||
    hiringManagerIds.length > 0 ||
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    responsibilities.trim().length > 0 ||
    industry.length > 0 ||
    // The pre-filled default address isn't the employer's own input.
    location.trim() !== startLocation ||
    officeDays !== "" ||
    salaryMin.trim().length > 0 ||
    salaryMax.trim().length > 0 ||
    salaryPeriod !== "month" ||
    !showSalary ||
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
      benefits,
      startAvailability: startAvailability || null,
      workingHours: workingHours.trim() || null,
      contactUserId: contactUserId || null,
      hiringManagerIds,
      title: title.trim(),
      description: description.trim(),
      responsibilities: responsibilities.trim(),
      industry: industry || null,
      employmentType,
      workArrangement,
      officeDaysPerWeek: workArrangement === "hybrid" && officeDays ? Number(officeDays) : null,
      location: location.trim() || (workArrangement === "remote" ? REMOTE_LOCATION : ""),
      addressLine1: addressLine1.trim() || null,
      addressLine2: addressLine2.trim() || null,
      area: area.trim() || null,
      city: city.trim() || null,
      state: state || null,
      postcode: postcode.trim() || null,
      salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
      salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
      salaryPeriod,
      showSalary,
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
      // Always saved and shown on the posting — whether applicants are
      // screened by them is askLanguages (+ screeningEnabled), checked server-side.
      languages,
      workAuthorizations: screeningEnabled && askWorkAuthorizations ? workAuthorizations : [],
      drivingLicense: screeningEnabled && askDrivingLicense ? drivingLicense || null : null,
      customScreeningQuestions: screeningEnabled ? customQuestions : [],
      screeningPreferred: screeningEnabled ? screeningPreferred : [],
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
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px] text-xs text-[#9AA3B2]">Loading posting…</div>
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
      className="flex min-w-0 flex-col gap-[20px] lg:flex-1"
    >
      <div className={gradientFrameClass("teal")}>
        <div className="@container relative flex flex-col gap-[16px] overflow-hidden rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <JobTitleIllustration
            lit={title.trim().length > 0}
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto [&>svg]:h-full [&>svg]:w-auto @[40rem]:block"
          />

          <div className="relative @[40rem]:max-w-[calc(100%-300px)]">
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
            required
            className="relative @[40rem]:max-w-[calc(100%-300px)]"
          >
            <div className="flex flex-wrap gap-[8px]">
              <input
                id="jobTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={aiFillLoading}
                placeholder="e.g. Sales Executive"
                className={`${inputClass} min-w-[180px] flex-1`}
              />
              <button
                type="button"
                onClick={() => handleAiFill()}
                disabled={!title.trim() || aiFillLoading}
                className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),var(--color-brand-gold))] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                  aiFillLoading ? "ai-fill-pulse" : ""
                }`}
              >
                <SiriOrb className="h-[14px] w-[14px]" active={aiFillLoading} />
                {aiFillLoading ? `Filling… ${(aiFillElapsedMs / 1000).toFixed(1)}s` : "Fill with AI"}
              </button>
            </div>
            {(aiFillStatus || aiFillError) && (
              <p className={`mt-[6px] text-xs ${aiFillError ? "text-red-500" : "text-brand-teal-dark"}`}>
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
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <div>
        <p className="text-lg font-semibold text-[#141B2E]">Role details</p>
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

      <Field label="Description" htmlFor="jobDescription" hint={<MatchHint field={["bio", "workExperiences"]} />} required>
        <RichTextEditor
          id="jobDescription"
          value={description}
          onChange={setDescription}
          placeholder="What the role involves, and what you're looking for"
        />
      </Field>

      <Field label="Job description" htmlFor="jobResponsibilities" hint={<MatchHint field="workExperiences" />} required>
        <RichTextEditor
          id="jobResponsibilities"
          value={responsibilities}
          onChange={setResponsibilities}
          placeholder="Key responsibilities and requirements — e.g. Design marketing materials for print and digital, Collaborate with the marketing team on campaign concepts, then a Requirements list below"
        />
      </Field>

      <div className="grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
        <Field label="Industry" htmlFor="jobIndustry" hint={<MatchHint field="preferredIndustry" />} required>
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

      <Field
        label="Languages"
        htmlFor="languageInput"
        hint={<MatchHint field="jobseekerLanguages" />}
      >
        <div className="flex flex-wrap gap-[8px] sm:flex-nowrap">
          <div className="min-w-[160px] flex-1">
            <Dropdown
              id="languageInput"
              label="Language"
              value={languagePick}
              searchable
              searchPlaceholder="Search languages..."
              options={[
                { value: "", label: "Choose a language" },
                // Hidden once there's nothing left to add for it (no dialects
                // and already required, or "any" and every dialect required).
                ...LANGUAGE_OPTIONS.filter((o) =>
                  languageDialects(o.value).length
                    ? !isRequired(o.value, null) || languageDialects(o.value).some((d) => !isRequired(o.value, d))
                    : !isRequired(o.value, null),
                ),
                { value: OTHER_LANGUAGE, label: "Other (type it)" },
              ]}
              onChange={pickLanguage}
            />
          </div>
          {dialectChoices.length > 0 && (
            <div className="min-w-[150px] flex-1">
              <Dropdown
                id="languageDialect"
                label="Dialect"
                value={dialectPick}
                options={dialectChoices}
                onChange={(value) => setDialectPick(value)}
              />
            </div>
          )}
          {languagePick === OTHER_LANGUAGE && (
            <input
              type="text"
              value={languageInput}
              onChange={(e) => setLanguageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLanguage();
                }
              }}
              placeholder="Type the language"
              autoFocus
              className={`${inputClass} min-w-[160px] flex-1`}
            />
          )}
          <div className="w-[150px] shrink-0">
            <Dropdown
              id="languageLevel"
              label="Minimum level"
              value={languageLevelInput}
                options={LANGUAGE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              onChange={(value) => setLanguageLevelInput(value)}
            />
          </div>
          <button
            type="button"
            onClick={addLanguage}
            disabled={!languagePick || (languagePick === OTHER_LANGUAGE && !languageInput.trim())}
            className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-brand-teal-soft px-[14px] text-sm text-brand-teal-dark hover:bg-[#CFF4F6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {languages.length > 0 && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {languages.map((entry) => (
              <span
                key={`${entry.language}|${entry.dialect ?? ""}`}
                className="flex items-center gap-[6px] rounded-full bg-[#F1F4F8] py-[6px] pl-[12px] pr-[8px] text-xs text-[#141B2E]"
              >
                {formatLanguageRequirement(entry.language, entry.dialect)} —{" "}
                {LANGUAGE_LEVELS.find((l) => l.value === entry.level)?.label}
                <button
                  type="button"
                  onClick={() => setLanguages((prev) => prev.filter((l) => l !== entry))}
                  aria-label={`Remove ${formatLanguageRequirement(entry.language, entry.dialect)}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>
      </div>
      </div>

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <div>
        <p className="text-lg font-semibold text-[#141B2E]">Job type &amp; workplace</p>
        <p className="mt-[2px] text-xs text-[#9AA3B2]">
          What kind of job this is, and where the work happens.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Job type" htmlFor="jobEmploymentType" hint={<MatchHint field="employmentType" />} required>
          <Dropdown
            id="jobEmploymentType"
            label="Job type"
            value={employmentType}
            options={EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(value) => {
              setEmploymentType(value);
              // Freelance work is usually paid per project.
              if (value === "freelance" && salaryPeriod === "month" && !salaryMin.trim() && !salaryMax.trim()) {
                setSalaryPeriod("project");
              }
            }}
          />
        </Field>

        <Field label="Where" htmlFor="jobWorkArrangement" hint={<MatchHint field="workArrangement" />} required>
          <Dropdown
            id="jobWorkArrangement"
            label="Where"
            value={workArrangement}
            options={WORK_ARRANGEMENTS.map((w) => ({ value: w.value, label: w.label }))}
            onChange={(value) => setWorkArrangement(value)}
          />
        </Field>

        {workArrangement === "hybrid" && (
          <Field label="Days in the office" htmlFor="jobOfficeDays" hint={<NoMatchHint />}>
            <Dropdown
              id="jobOfficeDays"
              label="Days in the office"
              value={officeDays}
              options={[
                { value: "", label: "Not specified" },
                ...OFFICE_DAYS_OPTIONS.map((d) => ({ value: String(d), label: `${d} day${d === 1 ? "" : "s"} a week` })),
              ]}
              onChange={(value) => setOfficeDays(value)}
            />
          </Field>
        )}
      </div>

      <Field
        label={workArrangement === "remote" ? "Office address (optional)" : "Location"}
        htmlFor="jobAddressLine1"
        hint={<MatchHint field="location" />}
        required={workArrangement !== "remote"}
      >
        <div className="flex flex-col gap-[10px]">
          {workArrangement === "remote" && (
            <p className="text-xs text-[#9AA3B2]">
              Remote roles don&apos;t need an address — leave it empty and the posting shows &quot;Remote&quot;.
            </p>
          )}
          {addresses.length > 0 && (
            <Dropdown
              id="jobLocationPicker"
              label="Use a saved address"
              value={selectedAddressId}
              options={[
                { value: "" as const, label: "Use a saved address..." },
                ...addresses.map((a) => ({
                  value: a.id,
                  label: `${a.label} — ${postingLocationLabel(a.area ?? "", a.city, a.state)}${
                    addresses.length > 1 && a.id === defaultJobAddress(addresses)?.id ? " (default)" : ""
                  }`,
                })),
              ]}
              onChange={(value) => {
                const picked = addresses.find((a) => a.id === value);
                if (!picked) return;
                setSelectedAddressId(picked.id);
                setAddressLine1(picked.addressLine1);
                setAddressLine2(picked.addressLine2 ?? "");
                setArea(picked.area ?? "");
                setCity(picked.city);
                setState(picked.state as (typeof MALAYSIA_STATES)[number]);
                setPostcode(picked.postcode);
                setLocation(postingLocationLabel(picked.area ?? "", picked.city, picked.state));
              }}
            />
          )}
          <div className="grid grid-cols-1 gap-x-[14px] gap-y-[10px] sm:grid-cols-2">
            <input
              id="jobAddressLine1"
              type="text"
              value={addressLine1}
              onChange={(e) => {
                setAddressLine1(e.target.value);
                setSelectedAddressId("");
              }}
              placeholder="e.g. 12, Jalan SS 2/24"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              id="jobAddressLine2"
              type="text"
              value={addressLine2}
              onChange={(e) => {
                setAddressLine2(e.target.value);
                setSelectedAddressId("");
              }}
              placeholder="Address line 2 (optional)"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              id="jobArea"
              type="text"
              maxLength={80}
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setSelectedAddressId("");
                setLocation(postingLocationLabel(e.target.value, city, state));
              }}
              placeholder="Area / neighbourhood (optional)"
              className={inputClass}
            />
            <input
              id="jobCity"
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setSelectedAddressId("");
                setLocation(postingLocationLabel(area, e.target.value, state));
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
                setSelectedAddressId("");
                setLocation(postingLocationLabel(area, city, nextState));
              }}
            />
            <input
              id="jobPostcode"
              type="text"
              inputMode="numeric"
              value={postcode}
              onChange={(e) => {
                setPostcode(e.target.value.replace(/\D/g, "").slice(0, 5));
                setSelectedAddressId("");
              }}
              placeholder="e.g. 47300"
              className={inputClass}
            />
          </div>
          {addressLine1.trim() && city.trim() && state && (
            <iframe
              title="Map for this location"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                `${addressLine1}, ${addressLine2 ? `${addressLine2}, ` : ""}${area.trim() ? `${area.trim()}, ` : ""}${city}, ${state}${postcode ? ` ${postcode}` : ""}, Malaysia`,
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
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <div>
          <p className="text-lg font-semibold text-[#141B2E]">Salary</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            Postings that show pay get noticeably more applicants.
          </p>
        </div>
        <button
          type="button"
          onClick={suggestSalary}
          disabled={suggestingSalary || !title.trim()}
          title={title.trim() ? undefined : "Enter a job title first"}
          className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),var(--color-brand-gold))] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
            suggestingSalary ? "ai-fill-pulse" : ""
          }`}
        >
          <SiriOrb className="h-[14px] w-[14px]" active={suggestingSalary} />
          {suggestingSalary ? "Suggesting…" : "Suggest salary"}
        </button>
      </div>

      {salarySuggestError && <p className="text-xs text-red-500">{salarySuggestError}</p>}

      {activeSalarySuggestion && (
        <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[12px] bg-brand-teal-soft px-[14px] py-[10px]">
          <div className="min-w-0">
            <p className="text-sm text-[#141B2E]">
              AI suggests{" "}
              <span className="font-semibold">
                {formatSalary(activeSalarySuggestion.min, activeSalarySuggestion.max, activeSalarySuggestion.period)}
              </span>
            </p>
            {activeSalarySuggestion.reason && (
              <p className="mt-[2px] text-xs text-[#4B5468]">{activeSalarySuggestion.reason}</p>
            )}
            <p className="mt-[2px] text-xs text-[#9AA3B2]">An AI estimate, not verified market data.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSalaryMin(String(activeSalarySuggestion.min));
              setSalaryMax(String(activeSalarySuggestion.max));
            }}
            className="h-[34px] shrink-0 whitespace-nowrap rounded-[10px] bg-white px-[12px] text-sm text-brand-teal-dark hover:bg-[#CFF4F6]"
          >
            Use this range
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Pay period" htmlFor="salaryPeriod" hint={<NoMatchHint />}>
          <Dropdown
            id="salaryPeriod"
            label="Pay period"
            value={salaryPeriod}
            options={SALARY_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            onChange={(value) => setSalaryPeriod(value)}
          />
        </Field>

        <Field label="Salary min (RM)" htmlFor="salaryMin" hint={<MatchHint field="expectedSalaryMin" />}>
          <input
            id="salaryMin"
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder={`e.g. ${SALARY_PLACEHOLDERS[salaryPeriod][0]}`}
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
            placeholder={`e.g. ${SALARY_PLACEHOLDERS[salaryPeriod][1]}`}
            className={inputClass}
          />
        </Field>
      </div>

      {(salaryHint || visibleSalaryInsight) && (
        <div className="flex flex-col gap-[4px]">
          {salaryHint && (
            <p
              className={`text-xs ${
                salaryHint.tone === "below"
                  ? "text-[#B4561F]"
                  : salaryHint.tone === "above"
                    ? "text-brand-teal-dark"
                    : "text-[#2F7D4F]"
              }`}
            >
              {salaryHint.tone === "below" ? "▼ " : salaryHint.tone === "above" ? "▲ " : "✓ "}
              {salaryHint.text}
            </p>
          )}
          {visibleSalaryInsight && (
            <p className="text-xs text-[#4B5468]">
              Most matching candidates on JobGiga
              {visibleSalaryInsight.scope === "role_state" ? ` in ${visibleSalaryInsight.state}` : ""}
              {visibleSalaryInsight.scope === "industry" ? " in this industry" : ""} expect{" "}
              <span className="text-[#141B2E]">
                {formatSalary(visibleSalaryInsight.typicalMin, visibleSalaryInsight.typicalMax, "month")}
              </span>{" "}
              <span className="text-[#9AA3B2]">
                (based on {visibleSalaryInsight.count} profile{visibleSalaryInsight.count === 1 ? "" : "s"})
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-[4px]">
        <label className="flex items-start gap-[8px] text-sm text-[#141B2E]">
          <input
            id="showSalary"
            type="checkbox"
            checked={showSalary}
            onChange={(e) => setShowSalary(e.target.checked)}
            className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-brand-teal-dark"
          />
          Show salary on the posting
        </label>
        {!showSalary && (
          <p className="text-xs text-[#B4561F]">
            Jobseekers will see &quot;Salary not disclosed&quot;. Postings that hide pay get noticeably fewer
            applicants — we recommend keeping it on.
          </p>
        )}
      </div>
      </div>
      </div>

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <p className="text-lg font-semibold text-[#141B2E]">Skills</p>
        <button
          type="button"
          onClick={suggestSkills}
          disabled={suggestingSkills || !title.trim()}
          className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),var(--color-brand-gold))] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
            suggestingSkills ? "ai-fill-pulse" : ""
          }`}
        >
          <SiriOrb className="h-[14px] w-[14px]" active={suggestingSkills} />
          {suggestingSkills ? `Suggesting… ${(suggestSkillsElapsedMs / 1000).toFixed(1)}s` : "Suggest skills for this role"}
        </button>
      </div>
      {(suggestSkillsStatus || suggestSkillsError) && (
        <p className={`text-xs ${suggestSkillsError ? "text-red-500" : "text-brand-teal-dark"}`}>
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

      <Field label="Skills required" htmlFor="skillInput" hint={<MatchHint field="professionalSkills" />} required>
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
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <div>
        <p className="text-lg font-semibold text-[#141B2E]">Benefits &amp; working conditions</p>
        <p className="mt-[2px] text-xs text-[#9AA3B2]">
          What candidates check first — shown on the posting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-[14px] gap-y-[16px] sm:grid-cols-2">
        <Field label="Start date" htmlFor="jobStartAvailability" hint={<NoMatchHint />}>
          <Dropdown
            id="jobStartAvailability"
            label="Start date"
            value={startAvailability}
            options={[
              { value: "" as const, label: "Not specified" },
              ...START_AVAILABILITY.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onChange={(value) => setStartAvailability(value)}
          />
        </Field>
      </div>

      <Field label="Working hours" htmlFor="jobWorkingHours" hint={<NoMatchHint />}>
        <input
          id="jobWorkingHours"
          type="text"
          value={workingHours}
          maxLength={MAX_WORKING_HOURS_LENGTH}
          onChange={(e) => setWorkingHours(e.target.value)}
          placeholder="e.g. Mon–Fri, 9am–6pm"
          className={inputClass}
        />
        <div className="mt-[8px] flex flex-wrap gap-[6px]">
          {WORKING_HOURS_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setWorkingHours(preset)}
              className={`rounded-full border px-[10px] py-[5px] text-xs ${
                workingHours === preset
                  ? "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark"
                  : "border-black/[0.1] text-[#4B5468] hover:bg-black/[0.03]"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Benefits" htmlFor="jobBenefitInput" hint={<NoMatchHint />}>
        {companyBenefits.length > 0 && !editingId && (
          <p className="mb-[8px] text-xs text-[#9AA3B2]">Pre-filled from your Company Profile — add or remove for this role.</p>
        )}
        {benefits.length > 0 && (
          <div className="mb-[10px] flex flex-wrap gap-[6px]">
            {benefits.map((b) => (
              <span
                key={b}
                className="flex items-center gap-[6px] rounded-full bg-brand-teal-dark py-[6px] pl-[12px] pr-[8px] text-xs text-white"
              >
                {b}
                <button
                  type="button"
                  onClick={() => setBenefits((prev) => prev.filter((x) => x !== b))}
                  aria-label={`Remove ${b}`}
                  className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <XIcon className="h-[9px] w-[9px]" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-[8px]">
          <input
            id="jobBenefitInput"
            type="text"
            value={benefitInput}
            onChange={(e) => setBenefitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBenefit(benefitInput);
              }
            }}
            placeholder="Add another benefit"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => addBenefit(benefitInput)}
            disabled={!benefitInput.trim() || benefits.length >= MAX_POSTING_BENEFITS}
            className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-brand-teal-soft px-[14px] text-sm text-brand-teal-dark hover:bg-[#CFF4F6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {POSTING_BENEFITS.some((b) => !benefits.includes(b)) && (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {POSTING_BENEFITS.filter((b) => !benefits.includes(b)).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => addBenefit(b)}
                className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
              >
                <PlusIcon className="h-[8px] w-[8px]" />
                {b}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Contact person" htmlFor="jobContactPerson" hint={<NoMatchHint />}>
        <Dropdown
          id="jobContactPerson"
          label="Contact person"
          value={contactUserId}
          options={[
            { value: "", label: "Don't show a contact" },
            ...contactOptions.map((c) => ({
              value: c.userId,
              label: c.position ? `${c.name} — ${c.position}` : c.name,
            })),
          ]}
          onChange={(value) => setContactUserId(value)}
        />
        <p className="mt-[4px] text-xs text-[#9AA3B2]">
          Shown as &ldquo;Posted by&rdquo; with their name, role and photo — never their email or phone.
        </p>
      </Field>

      <Field label="Hiring managers (optional)" htmlFor="jobHiringManagers">
        <div id="jobHiringManagers" className="flex flex-wrap gap-[6px]">
            {allHiringManagers.map((m) => {
              const selected = hiringManagerIds.includes(m.teamMemberId);
              return (
                <button
                  key={m.teamMemberId}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() =>
                    setHiringManagerIds((prev) =>
                      selected ? prev.filter((id) => id !== m.teamMemberId) : [...prev, m.teamMemberId],
                    )
                  }
                  className={`flex items-center gap-[8px] rounded-full border py-[4px] pl-[4px] pr-[12px] text-sm transition-colors ${
                    selected
                      ? "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark"
                      : "border-black/[0.1] bg-white text-[#4B5468] hover:border-brand-teal-dark"
                  }`}
                >
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-[24px] w-[24px] rounded-full object-cover" />
                  ) : (
                    <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#EAF0FE] text-[#3B5BDB]">
                      <UserIcon className="h-[12px] w-[12px]" />
                    </span>
                  )}
                  <span className="max-w-[180px] truncate">{m.name}</span>
                  {m.pending && <span className="text-xs text-[#9AA3B2]">invited</span>}
                  {selected && <CheckIcon className="h-[9px] w-[9px]" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowQuickInvite(true)}
              className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
            >
              Invite new hiring manager
              <PlusIcon className="h-[8px] w-[8px]" />
            </button>
        </div>
        <p className="mt-[4px] text-xs text-[#9AA3B2]">
          They&rsquo;ll see this job&rsquo;s applicants and interviews, and be notified when someone applies. Never shown
          to candidates.
        </p>
      </Field>
      </div>
      </div>

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      {submitError && <p className="text-xs text-red-500">{submitError}</p>}
      <div className="flex flex-col gap-[8px] sm:flex-row">
        <button
          type="button"
          disabled={!formValid}
          onClick={() => setFormStep("screening")}
          className="flex h-[38px] shrink-0 items-center sm:flex-1 justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
          hint={<><MatchHint field="yearsExperience" /><PriorityToggle preferred={screeningPreferred.includes("yearsExperience")} onChange={(p) => setRequirementPreferred("yearsExperience", p)} disabled={!askMinExperience} /><AskToggle checked={askMinExperience} onChange={setAskMinExperience} label="Ask this" /></>}
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
          hint={<><MatchHint field="qualificationTier" /><PriorityToggle preferred={screeningPreferred.includes("qualificationTier")} onChange={(p) => setRequirementPreferred("qualificationTier", p)} disabled={!askMinEducation} /><AskToggle checked={askMinEducation} onChange={setAskMinEducation} label="Ask this" /></>}
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
          hint={<><MatchHint field="drivingLicense" /><PriorityToggle preferred={screeningPreferred.includes("drivingLicense")} onChange={(p) => setRequirementPreferred("drivingLicense", p)} disabled={!askDrivingLicense} /><AskToggle checked={askDrivingLicense} onChange={setAskDrivingLicense} label="Ask this" /></>}
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
        htmlFor="languageScreening"
        hint={<><MatchHint field="jobseekerLanguages" /><PriorityToggle preferred={screeningPreferred.includes("languages")} onChange={(p) => setRequirementPreferred("languages", p)} disabled={!askLanguages} /><AskToggle checked={askLanguages} onChange={setAskLanguages} label="Ask this" /></>}
      >
        {/* The languages themselves are set under Role details (always on the
            posting); this only decides whether applicants are asked about
            them and screened out if they fall short. */}
        <div id="languageScreening" className={askLanguages ? "" : "opacity-50"}>
          {languages.length > 0 ? (
            <div className="flex flex-wrap gap-[6px]">
              {languages.map((entry) => (
                <span key={`${entry.language}|${entry.dialect ?? ""}`} className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]">
                  {formatLanguageRequirement(entry.language, entry.dialect)} — {LANGUAGE_LEVELS.find((l) => l.value === entry.level)?.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9AA3B2]">No languages yet — add them under Role details.</p>
          )}
        </div>
      </Field>

      <Field
        label="Accepted work authorization"
        htmlFor="workAuthorizations"
        hint={<><MatchHint field="workAuthorization" /><PriorityToggle preferred={screeningPreferred.includes("workAuthorization")} onChange={(p) => setRequirementPreferred("workAuthorization", p)} disabled={!askWorkAuthorizations} /><AskToggle checked={askWorkAuthorizations} onChange={setAskWorkAuthorizations} label="Ask this" /></>}
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
      </>
      )}
      </div>
      </div>

      {screeningEnabled && (
      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
      <Field label="Custom questions (optional)" htmlFor="customQuestionInput">
        <div className="flex flex-col gap-[8px] sm:flex-row">
          <div className="w-full shrink-0 sm:w-[150px]">
            <Dropdown
              id="customQuestionType"
              label="Question type"
              value={customQuestionType}
              options={SCREENING_QUESTION_TYPES.map((t) => ({ value: t, label: SCREENING_QUESTION_TYPE_LABEL[t] }))}
              onChange={(value) => {
                setCustomQuestionType(value);
                setCustomQuestionError(null);
              }}
            />
          </div>
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
            placeholder={
              customQuestionType === "number"
                ? "e.g. How many calls per day did you handle?"
                : customQuestionType === "choice"
                  ? "e.g. When can you start?"
                  : customQuestionType === "text"
                    ? "e.g. Tell us about your sales experience"
                    : "e.g. Willing to work weekends?"
            }
            maxLength={200}
            className={`${inputClass} flex-1`}
          />
          {customQuestionType === "yesno" && (
            <div className="w-full shrink-0 sm:w-[130px]">
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
          )}
          <button
            type="button"
            onClick={() => addCustomQuestion()}
            className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-brand-teal-soft px-[14px] text-sm text-brand-teal-dark hover:bg-[#CFF4F6]"
          >
            Add
          </button>
        </div>

        {customQuestionType === "choice" && (
          <div className="mt-[8px] flex flex-col gap-[8px]">
            <div className="flex gap-[8px]">
              <input
                type="text"
                value={choiceInput}
                onChange={(e) => setChoiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChoiceOption();
                  }
                }}
                placeholder="Add an option, then press Enter"
                aria-label="Add an option"
                maxLength={80}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={addChoiceOption}
                className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
              >
                Add option
              </button>
            </div>
            {choiceOptions.length > 0 && (
              <>
                <div className="flex flex-wrap gap-[6px]">
                  {choiceOptions.map((option) => {
                    const accepted = choiceAccepted.includes(option);
                    return (
                      <span
                        key={option}
                        className={`flex items-center gap-[6px] rounded-full border py-[4px] pl-[12px] pr-[8px] text-sm ${
                          accepted
                            ? "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark"
                            : "border-black/[0.1] bg-white text-[#4B5468]"
                        }`}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={accepted}
                          onClick={() =>
                            setChoiceAccepted((prev) =>
                              accepted ? prev.filter((o) => o !== option) : [...prev, option],
                            )
                          }
                          className="flex items-center gap-[6px]"
                        >
                          {accepted && <CheckIcon className="h-[9px] w-[9px]" />}
                          {option}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChoiceOption(option)}
                          aria-label={`Remove ${option}`}
                          className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
                        >
                          <XIcon className="h-[9px] w-[9px]" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-[#9AA3B2]">Ticked options qualify. Tap an option to tick or untick it.</p>
              </>
            )}
          </div>
        )}

        {customQuestionType === "number" && (
          <div className="mt-[8px]">
            <input
              type="number"
              value={customQuestionMin}
              onChange={(e) => setCustomQuestionMin(e.target.value)}
              placeholder="Minimum that qualifies (optional)"
              aria-label="Minimum that qualifies"
              className={inputClass}
            />
          </div>
        )}

        <div className="mt-[8px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px]">
          {(customQuestionType === "yesno" ||
            customQuestionType === "choice" ||
            (customQuestionType === "number" && customQuestionMin.trim() !== "")) && (
            <PriorityToggle preferred={customQuestionPreferred} onChange={setCustomQuestionPreferred} />
          )}
          <p className="text-xs text-[#9AA3B2]">
            {customQuestionType === "text"
              ? "You read the answer yourself — it doesn't change the match score."
              : customQuestionType === "number" && customQuestionMin.trim() === ""
                ? "With no minimum, you just see the number — it doesn't change the match score."
                : "Preferred: meeting it boosts the match score, missing it costs nothing."}
          </p>
        </div>

        <div className="mt-[14px]">
          <p className="text-xs text-[#4B5468]">Ready-made questions</p>
          <div role="tablist" aria-label="Question categories" className="mt-[6px] flex flex-wrap gap-[6px]">
            {SUGGESTED_QUESTION_GROUPS.map((group) => (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={suggestionGroup === group.label}
                onClick={() => setSuggestionGroup(group.label)}
                className={`rounded-full px-[12px] py-[4px] text-xs transition-colors ${
                  suggestionGroup === group.label
                    ? "bg-brand-teal-soft text-brand-teal-dark"
                    : "bg-[#F1F4F8] text-[#4B5468] hover:text-[#141B2E]"
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-[8px] flex flex-wrap gap-[6px]">
            {(() => {
              const items = (SUGGESTED_QUESTION_GROUPS.find((g) => g.label === suggestionGroup)?.items ?? []).filter(
                (s) => !customQuestions.some((q) => q.question.toLowerCase() === s.question.toLowerCase()),
              );
              if (items.length === 0) return <p className="text-xs text-[#9AA3B2]">You&rsquo;ve added them all.</p>;
              return items.map((s) => (
                <button
                  key={s.question}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
                >
                  {s.question}
                  <PlusIcon className="h-[8px] w-[8px]" />
                </button>
              ));
            })()}
          </div>
        </div>
        {customQuestionError && <p className="mt-[6px] text-xs text-red-500">{customQuestionError}</p>}

        {customQuestions.length > 0 && (
          <div className="mt-[10px] flex flex-col gap-[6px]">
            {customQuestions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-[8px] rounded-[10px] bg-[#F1F4F8] px-[12px] py-[8px] text-xs text-[#141B2E]"
              >
                <span className="min-w-0">
                  {q.question}{" "}
                  <span className="text-[#9AA3B2]">
                    —{" "}
                    {questionType(q) === "choice"
                      ? `choose one of ${(q.options ?? []).length} · accepts ${(q.acceptedOptions ?? []).join(", ")}`
                      : questionType(q) === "number"
                        ? q.minNumber != null
                          ? `number, ${q.minNumber} or more`
                          : "number, for you to read"
                        : questionType(q) === "text"
                          ? "short answer, for you to read"
                          : `must answer ${q.requiredAnswer ? "Yes" : "No"}`}
                  </span>
                </span>
                {isScorableQuestion(q) && (
                  <span className="ml-auto shrink-0">
                    <PriorityToggle preferred={q.preferred === true} onChange={(p) => setQuestionPreferred(q.id, p)} />
                  </span>
                )}
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
      </div>
      </div>
      )}

      <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
          className="flex h-[38px] shrink-0 items-center sm:flex-1 justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

    <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:w-[300px] lg:shrink-0">
      <div
        className={
          formValid
            ? gradientFrameClass("teal")
            : "rounded-[20px] bg-gradient-to-br from-[#A66A61] via-white to-[#A66A61] p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]"
        }
      >
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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

          <div className="flex flex-col gap-[16px] scrollbar-thin-teal overflow-y-auto px-[22px] py-[18px]">
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
                <span className="rounded-full bg-brand-teal-soft px-[10px] py-[3px] text-xs text-brand-teal-dark">
                  {EMPLOYMENT_TYPES.find((t) => t.value === employmentType)?.label}
                </span>
                <span className="rounded-full bg-brand-teal-soft px-[10px] py-[3px] text-xs text-brand-teal-dark">
                  {WORK_ARRANGEMENTS.find((w) => w.value === workArrangement)?.label}
                </span>
              </div>
              <div className="mt-[10px] flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-xs text-[#4B5468]">
                <span>{location || (workArrangement === "remote" ? REMOTE_LOCATION : "Location not set")}</span>
                <span className="text-[#C7CDD7]">·</span>
                <span>
                  {(showSalary &&
                    formatSalary(Number(salaryMin) || null, Number(salaryMax) || null, salaryPeriod)) ||
                    "Salary not disclosed"}
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
              className="flex h-[38px] shrink-0 items-center sm:flex-1 justify-center rounded-full border border-brand-teal-dark bg-white text-sm text-brand-teal-dark hover:bg-brand-teal-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              👁️ See jobseeker view
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("pending")}
              className="flex h-[38px] shrink-0 items-center sm:flex-1 justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

    {showQuickInvite && (
      <Modal ariaLabel="Invite a hiring manager" onClose={quickSending ? undefined : closeQuickInvite}>
        <h2 className="text-lg font-semibold text-[#141B2E]">Invite a hiring manager</h2>
        <p className="mt-[6px] text-xs text-[#4B5468]">
          They&rsquo;ll get an email to join your team, and will see only this job&rsquo;s applicants and interviews.
          The invite is sent now, not when you publish.
        </p>
        <form
          noValidate
          className="mt-[14px] flex flex-col gap-[10px]"
          onSubmit={(e) => {
            e.preventDefault();
            // The modal is portalled, but React still bubbles submit to the posting form.
            e.stopPropagation();
            if (!quickSending) void sendQuickInvite();
          }}
        >
          <input
            type="email"
            autoFocus
            value={quickEmail}
            onChange={(e) => setQuickEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            maxLength={254}
            className={inputClass}
          />
          <input
            type="text"
            value={quickPosition}
            onChange={(e) => setQuickPosition(e.target.value)}
            placeholder="Job title (optional)"
            aria-label="Job title (optional)"
            maxLength={80}
            className={inputClass}
          />
          {quickError && <p className="text-xs text-red-500">{quickError}</p>}
          <div className="mt-[4px] flex flex-col gap-[8px]">
            <button
              type="submit"
              disabled={quickSending || !quickEmail.trim()}
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {quickSending ? "Sending…" : "Send invite"}
            </button>
            <button
              type="button"
              disabled={quickSending}
              onClick={closeQuickInvite}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
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
          className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-16px_rgba(0,0,0,0.24)]"
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

          <div className="scrollbar-thin-teal flex-1 overflow-y-auto bg-brand-gold-page px-[16px] py-[20px] sm:px-[22px]">
            {/* The very same card and details panel as the jobseeker landing
                page (JobPostingDetails), filled from this form. */}
            <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[300px_1fr] lg:items-start">
              {/* Stays put while the details panel scrolls (side-by-side layout only). */}
              <div className="lg:sticky lg:top-0">
                <p className="mb-[8px] text-xs text-[#9AA3B2]">In the job list</p>
                <PostingCard posting={previewPosting} selected />
              </div>
              <div>
                <p className="mb-[8px] text-xs text-[#9AA3B2]">When they open it</p>
                <div className={gradientFrameClass("gold")}>
                  <div className="rounded-[19px] bg-white p-[16px] sm:p-[24px]">
                    <JobPostingDetails posting={previewPosting} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[8px] border-t border-black/[0.06] px-[22px] py-[16px] sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitPosting("pending")}
              className="flex h-[38px] shrink-0 items-center sm:flex-1 justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
  officeDaysPerWeek: number | null;
  location: string;
  addressLine1: string | null;
  addressLine2: string | null;
  area?: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string;
  showSalary: boolean;
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
  customScreeningQuestions: CustomQuestion[];
  screeningPreferred?: string[];
  skillSuggestions: { professionalSkills: string[]; softSkills: string[]; niceToHaveSkills: string[] } | null;
  askMinYearsExperience: boolean;
  askMinQualificationTier: boolean;
  askDrivingLicense: boolean;
  askLanguages: boolean;
  askWorkAuthorizations: boolean;
  benefits?: string[];
  startAvailability?: string | null;
  workingHours?: string | null;
  contactUserId?: string | null;
  // Only on a single posting fetched for editing (GET /api/employer/job-postings/[id]).
  hiringManagerIds?: string[];
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
  const range = formatSalary(posting.salaryMin, posting.salaryMax, posting.salaryPeriod);
  const salaryLabel = range ? (posting.showSalary ? range : `${range} (hidden)`) : "Salary not set";
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
    salary: salaryLabel,
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
  canManage,
  onView,
  onEdit,
  onDuplicate,
  onCloseJob,
  onDelete,
}: {
  posting: PostingWithId;
  // false for a Hiring manager — they can look, not edit/close/delete.
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCloseJob: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The menu is portaled to <body> with fixed coordinates: the status
  // sections wrap their rows in overflow-hidden (for the collapse animation),
  // which would otherwise clip an absolutely-positioned popover.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setConfirmingDelete(false);
    }
    function dismiss() {
      setOpen(false);
      setConfirmingDelete(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, []);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const right = window.innerWidth - rect.right;
      // ~250px covers the tallest menu (5 items); flip above if it won't fit.
      setPos(
        window.innerHeight - rect.bottom < 250
          ? { bottom: window.innerHeight - rect.top + 6, right }
          : { top: rect.bottom + 6, right },
      );
    }
    setOpen(true);
  }

  const canClose = posting.status !== "Closed";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${posting.title}`}
        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-[#141B2E]"
      >
        <DotsIcon className="h-[14px] w-[14px]" />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={pos}
          className="fixed z-50 w-[190px] rounded-[12px] border border-black/[0.08] bg-white p-[6px] shadow-[0_8px_24px_-8px_rgba(20,27,46,0.2)]"
        >
          <MenuItem
            icon={EyeIcon}
            label="View details"
            onClick={() => {
              onView();
              setOpen(false);
            }}
          />
          {canManage && (
            <>
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
            </>
          )}
        </div>,
        document.body,
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
          {onResubmit && (
            <button
              type="button"
              disabled={resubmitting}
              onClick={handleResubmit}
              className="mt-[10px] flex h-[34px] w-full items-center justify-center rounded-full border border-red-300 bg-white text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resubmitting ? "Resubmitting..." : "↻ Resubmit for Review"}
            </button>
          )}
        </div>
      )}

      {isFlagged && flagReason && (
        <div className="mt-[14px] rounded-[12px] border border-[#FBDBBE] bg-[#FFF7F0] p-[12px]">
          <p className="text-xs text-[#C2600A] mb-[4px]">Flagged — needs a fix</p>
          <p className="text-xs text-[#9A5209]">{flagReason}</p>
          {resubmitError && <p className="mt-[8px] text-xs text-[#9A5209]">{resubmitError}</p>}
          {onResubmit && (
            <button
              type="button"
              disabled={resubmitting}
              onClick={handleResubmit}
              className="mt-[10px] flex h-[34px] w-full items-center justify-center rounded-full border border-[#FBDBBE] bg-white text-sm text-[#C2600A] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resubmitting ? "Resubmitting..." : "↻ Resubmit for Review"}
            </button>
          )}
        </div>
      )}

      <dl className="mt-[16px] flex flex-col gap-[9px] text-xs">
        <DetailRow label="Location" value={posting.location} />
        <DetailRow label="Job type" value={posting.employmentType} />
        <DetailRow label="Where" value={posting.workArrangement} />
        <DetailRow
          label="Salary range"
          value={posting.salary}
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

function JobPostingsPanel({ initialPostings, canManage }: { initialPostings: DbJobPosting[]; canManage: boolean }) {
  const router = useRouter();
  const [postings, setPostings] = useState<PostingWithId[]>(() => initialPostings.map(normalizeJobPosting));
  // Keeps the full raw DB row per posting (not just what PostingWithId
  // displays) so Duplicate can resend every field — mutated directly since
  // it's a lookup cache, not something the UI renders from.
  const rawByIdRef = useRef(new Map(initialPostings.map((p) => [p.id, p])));
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  const searchTerm = search.trim().toLowerCase();
  const searching = searchTerm.length > 0;
  const visiblePostings = searching
    ? postings.filter((p) =>
        [p.title, p.location, p.employmentType, p.workArrangement, p.status].some((v) =>
          String(v ?? "").toLowerCase().includes(searchTerm),
        ),
      )
    : postings;
  const matchCount = visiblePostings.length;
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
          officeDaysPerWeek: original.officeDaysPerWeek,
          location: original.location,
          addressLine1: original.addressLine1,
          addressLine2: original.addressLine2,
          area: original.area ?? null,
          city: original.city,
          state: original.state,
          postcode: original.postcode,
          salaryMin: original.salaryMin,
          salaryMax: original.salaryMax,
          salaryPeriod: original.salaryPeriod,
          showSalary: original.showSalary,
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
          screeningPreferred: original.screeningPreferred ?? [],
          skillSuggestions: original.skillSuggestions,
          askMinYearsExperience: original.askMinYearsExperience,
          askMinQualificationTier: original.askMinQualificationTier,
          askDrivingLicense: original.askDrivingLicense,
          askLanguages: original.askLanguages,
          askWorkAuthorizations: original.askWorkAuthorizations,
          benefits: original.benefits ?? [],
          startAvailability: original.startAvailability ?? null,
          workingHours: original.workingHours ?? null,
          contactUserId: original.contactUserId ?? null,
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

  // A Hiring manager with nothing assigned yet.
  if (!canManage && postings.length === 0) {
    return (
      <div className={`animate-fade-in-up ${gradientFrameClass("teal")} mx-auto w-full max-w-[1440px]`}>
        <div className="flex flex-col items-center gap-[8px] rounded-[19px] bg-white p-[28px] text-center">
          <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#EAF0FE] text-[#3B5BDB]">
            <StackIcon className="h-[18px] w-[18px]" />
          </span>
          <p className="text-sm text-[#141B2E]">No jobs assigned to you yet</p>
          <p className="max-w-[420px] text-xs leading-[18px] text-[#4B5468]">
            An owner or admin can make you hiring manager for a job — from the Team page, or when they post it.
            You&rsquo;ll be notified as soon as they do.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
    <div className="flex min-w-0 flex-col gap-[20px] lg:flex-1">
    {canManage && (
    <>
    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
      <div className="@container relative flex flex-col gap-[16px] overflow-hidden rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <JobTitleIllustration
          lit={heroTitle.trim().length > 0}
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto [&>svg]:h-full [&>svg]:w-auto @[40rem]:block"
        />

        <div className="relative @[40rem]:max-w-[calc(100%-300px)]">
          <p className="text-sm text-[#141B2E]">Start with your job title</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            It&rsquo;s the first thing candidates see and how they&rsquo;ll find you, so a clear,
            specific title works best — think &ldquo;Sales Executive&rdquo;, not &ldquo;Rockstar
            Ninja&rdquo;. Once it&rsquo;s in, let AI draft the rest of the posting for you.
          </p>
        </div>

        <Field label="Job title" htmlFor="heroJobTitle" hint={<MatchHint field="targetRole" />} className="relative @[40rem]:max-w-[calc(100%-300px)]">
          <div className="flex flex-wrap gap-[8px]">
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
              className={`${inputClass} min-w-[180px] flex-1`}
            />
            <button
              type="button"
              onClick={startWithTitle}
              disabled={!heroTitle.trim()}
              className="flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),var(--color-brand-gold))] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SiriOrb className="h-[14px] w-[14px]" active={false} />
              Fill with AI
            </button>
          </div>
        </Field>
      </div>
    </div>

    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
      <div className="relative overflow-hidden rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        {!howItWorksOpen && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px] overflow-hidden rounded-b-[19px] sm:h-[95px] lg:h-[130px]"
          >
            {/* AnimatedRibbon renders a much taller graphic (160/220/300px) than
                this crop window — the negative margin shifts it up so the
                visible slice lands on the ribbon's actual colour ("belly")
                pools instead of the mostly-empty top of its viewBox. */}
            <div className="-mt-[67px] sm:-mt-[92px] lg:-mt-[125px]">
              <AnimatedRibbon />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHowItWorksOpen((o) => !o)}
          aria-expanded={howItWorksOpen}
          className="relative flex w-full items-center gap-[8px] text-left"
        >
          <p className="text-sm text-[#141B2E]">How posting a job works</p>
          <ChevronDownIcon
            className={`ml-auto h-[10px] w-[10px] text-[#9AA3B2] transition-transform ${howItWorksOpen ? "" : "-rotate-90"}`}
          />
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            howItWorksOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
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
          </div>
        </div>
      </div>
    </div>
    </>
    )}

    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
          <p className="text-sm text-[#141B2E]">
            {canManage ? "Your job postings, organized by status" : "Jobs you're the hiring manager for"}
          </p>
          {actionError && <p className="mt-[6px] text-xs text-red-500">{actionError}</p>}
          <div className="mt-[10px] flex items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
            <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job postings by title, location or status..."
              aria-label="Search job postings"
              className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
          {searching && matchCount === 0 && (
            <p className="mt-[12px] text-sm text-[#9AA3B2]">No job postings match &ldquo;{search.trim()}&rdquo;.</p>
          )}
          <div className="mt-[10px] flex flex-col gap-[10px]">
            {STATUS_ORDER.map((status, index) => {
              const statusPostings = visiblePostings.filter((p) => p.status === status);
              if (statusPostings.length === 0) return null;
              // Matches stay visible while searching, even in a section the
              // employer had collapsed.
              const collapsed = !searching && collapsedStatuses.has(status);
              return (
                <div
                  key={status}
                  id={`status-section-${status}`}
                  className={`animate-fade-in-up ${gradientFrameClass("teal")} scroll-mt-[100px]`}
                  style={{ animationDelay: `${180 + index * 40}ms` }}
                >
                <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                      collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                    }`}
                  >
                  <div className="overflow-hidden">
                  <div className="mt-[10px] flex flex-col gap-[10px]">
                    {statusPostings.map((posting) => (
                      <div
                        key={posting.id}
                        onClick={() => {
                          if (["Active", "Filled", "Closed", "Flagged"].includes(posting.status)) {
                            router.push(`/employer/jobs/${posting.slug}`);
                          } else if (posting.status === "Draft" && canManage) {
                            // A draft has nothing to "view" yet — go straight to finishing it.
                            router.push(`/employer/jobs/postajob?id=${posting.id}`);
                          } else {
                            setViewing(posting);
                          }
                        }}
                        className="@container cursor-pointer rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] transition-colors hover:bg-[#F1F4F8]"
                      >
                        <div className="flex flex-col gap-[8px] @[36rem]:flex-row @[36rem]:items-center @[36rem]:justify-between">
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
                            <span>{posting.salary}</span>
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
                        <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[6px] text-xs @[36rem]:shrink-0 @[36rem]:flex-nowrap">
                          <span className="whitespace-nowrap text-[#9AA3B2]">
                            {posting.views} view{posting.views === 1 ? "" : "s"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/employer/applicants?jobId=${posting.id}`);
                            }}
                            className="whitespace-nowrap rounded-full bg-brand-teal-soft px-[10px] py-[3px] text-sm text-brand-teal-dark transition-colors hover:bg-[#D2F3F5]"
                          >
                            {posting.applicants} applicants
                          </button>
                          <span className="whitespace-nowrap text-[#9AA3B2]">{posting.posted}</span>
                          <div className="ml-auto @[36rem]:ml-0" onClick={(e) => e.stopPropagation()}>
                            <PostingActionsMenu
                              posting={posting}
                              canManage={canManage}
                              onView={() => setViewing(posting)}
                              onEdit={() => router.push(`/employer/jobs/postajob?id=${posting.id}`)}
                              onDuplicate={() => duplicate(posting.id)}
                              onCloseJob={() => closeJob(posting.id)}
                              onDelete={() => deletePosting(posting.id)}
                            />
                          </div>
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                  </div>
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
          onResubmit={canManage ? resubmitPosting : undefined}
        />
      )}
    </div>
    </div>

    {canManage && (
    <div className="flex flex-col gap-[16px] lg:sticky lg:top-[85px] lg:w-[300px] lg:shrink-0">
      <div className={gradientFrameClass("teal")}>
        <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
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
    )}
    </div>
  );
}

export default function EmployerJobsView({
  authUser,
  mode = "list",
  initialPostings = [],
  addresses = [],
  companyBenefits = [],
  contactOptions = [],
  hiringManagerOptions = [],
  company = null,
  canManage = true,
}: {
  authUser: AuthUser;
  mode?: "list" | "post";
  initialPostings?: DbJobPosting[];
  addresses?: EmployerAddress[];
  companyBenefits?: string[];
  contactOptions?: ContactOption[];
  hiringManagerOptions?: HiringManagerOption[];
  company?: PostingCompany | null;
  // false = a Hiring manager's read-only "My jobs" list.
  canManage?: boolean;
}) {
  const router = useRouter();
  const composing = mode === "post";
  const postJobFormRef = useRef<PostJobFormHandle>(null);
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
      heading={composing ? "Post a job" : canManage ? "Manage Job" : "My jobs"}
      headerAction={
        !canManage ? undefined : composing ? (
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
          : canManage
            ? "Post roles and track applicants once you're ready to hire."
            : "The jobs you're the hiring manager for — open one to see its applicants and interviews."
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
        <PostJobForm
          ref={postJobFormRef}
          onClose={() => router.push("/employer/jobs")}
          addresses={addresses}
          companyBenefits={companyBenefits}
          contactOptions={contactOptions}
          hiringManagerOptions={hiringManagerOptions}
          currentUserId={authUser.id ?? null}
          company={company}
        />
      ) : (
        <JobPostingsPanel
          key={initialPostings.map((p) => p.id).join(",")}
          initialPostings={initialPostings}
          canManage={canManage}
        />
      )}
    </EmployerDashboardShell>
  );
}

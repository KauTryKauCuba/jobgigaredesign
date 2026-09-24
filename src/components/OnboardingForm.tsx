"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import DatePicker from "./DatePicker";
import Dropdown from "./Dropdown";
import MonthYearPicker from "./MonthYearPicker";
import { useDraftName } from "./DraftNameContext";
import Field from "./Field";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { CheckIcon, FileIcon, PlusIcon, UploadIcon, UserIcon, XIcon } from "./icons";
import Modal from "./Modal";
import PhoneInput from "./PhoneInput";
import RichTextEditor from "./RichTextEditor";
import { PENDING_RESUME_KEY } from "./ResumeUpload";
import SiriOrb from "./SiriOrb";
import { useRegisterUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { INDUSTRIES } from "@/lib/industries";
import { plainTextToHtml } from "@/lib/richText";
import type { JobseekerProfile } from "@/lib/jobseeker-profile";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;

const WORK_ARRANGEMENTS = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

const WORK_AUTHORIZATIONS = [
  { value: "citizen", label: "Malaysian citizen" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "work_pass_holder", label: "Work pass holder" },
  { value: "needs_sponsorship", label: "Needs sponsorship" },
] as const;

const NOTICE_PERIODS = [
  { value: "immediate", label: "Immediate" },
  { value: "one_week", label: "1 week" },
  { value: "two_weeks", label: "2 weeks" },
  { value: "one_month", label: "1 month" },
  { value: "two_months", label: "2 months" },
  { value: "more_than_two_months", label: "More than 2 months" },
] as const;

const QUALIFICATION_TIERS = [
  { value: "SPM", label: "SPM" },
  { value: "STPM", label: "STPM" },
  { value: "Diploma", label: "Diploma" },
  { value: "Degree", label: "Degree" },
  { value: "Master", label: "Master's" },
  { value: "PhD", label: "PhD" },
  { value: "Other", label: "Other" },
] as const;

const LANGUAGE_LEVELS = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
] as const;

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

const MARITAL_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

const DRIVING_LICENSES = [
  { value: "none", label: "None" },
  { value: "b2", label: "Class B2" },
  { value: "b", label: "Class B" },
  { value: "d", label: "Class D" },
  { value: "da", label: "Class DA" },
  { value: "e", label: "Class E" },
] as const;

const RESUME_ACCEPT = ".pdf,.docx";
const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const AVATAR_ACCEPT = "image/*";
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

type QualificationTier = (typeof QUALIFICATION_TIERS)[number]["value"];
type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]["value"];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

type WorkExperienceEntry = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  achievements: string;
};

function newWorkExperience(): WorkExperienceEntry {
  return { id: newId(), company: "", title: "", startDate: "", endDate: "", isCurrent: false, achievements: "" };
}

type EducationEntry = {
  id: string;
  institution: string;
  fieldOfStudy: string;
  qualificationTier: QualificationTier;
  cgpa: string;
  graduationYear: string;
};

function newEducation(): EducationEntry {
  return {
    id: newId(),
    institution: "",
    fieldOfStudy: "",
    qualificationTier: "Degree",
    cgpa: "",
    graduationYear: "",
  };
}

type CertificationEntry = {
  id: string;
  name: string;
  issuer: string;
  year: string;
};

function newCertification(): CertificationEntry {
  return { id: newId(), name: "", issuer: "", year: "" };
}

type LanguageEntry = {
  id: string;
  language: string;
  spokenLevel: LanguageLevel;
  writtenLevel: LanguageLevel;
};

function newLanguage(): LanguageEntry {
  return { id: newId(), language: "", spokenLevel: "conversational", writtenLevel: "conversational" };
}

type ReferenceEntry = {
  id: string;
  fullName: string;
  jobTitle: string;
  company: string;
  phone: string;
  email: string;
};

function newReference(): ReferenceEntry {
  return { id: newId(), fullName: "", jobTitle: "", company: "", phone: "", email: "" };
}

// Maps the saved profile's related rows (DB nulls, DB ids) onto the form's
// entry shapes (empty-string defaults, client ids reused as-is since a DB id
// is just as good a React key as a freshly generated one).
function mapWorkExperiences(rows: JobseekerProfile["workExperiences"]): WorkExperienceEntry[] {
  return rows.map((r) => ({
    id: r.id,
    company: r.company,
    title: r.title,
    startDate: r.startDate,
    endDate: r.endDate ?? "",
    isCurrent: r.isCurrent,
    achievements: r.achievements ? plainTextToHtml(r.achievements) : "",
  }));
}

function mapEducation(rows: JobseekerProfile["education"]): EducationEntry[] {
  return rows.map((r) => ({
    id: r.id,
    institution: r.institution,
    fieldOfStudy: r.fieldOfStudy ?? "",
    qualificationTier: r.qualificationTier as QualificationTier,
    cgpa: r.cgpa ?? "",
    graduationYear: r.graduationYear != null ? String(r.graduationYear) : "",
  }));
}

function mapCertifications(rows: JobseekerProfile["certifications"]): CertificationEntry[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    issuer: r.issuer ?? "",
    year: r.year != null ? String(r.year) : "",
  }));
}

function mapLanguages(rows: JobseekerProfile["languages"]): LanguageEntry[] {
  return rows.map((r) => ({
    id: r.id,
    language: r.language,
    spokenLevel: r.spokenLevel as LanguageLevel,
    writtenLevel: r.writtenLevel as LanguageLevel,
  }));
}

function mapReferences(rows: JobseekerProfile["references"]): ReferenceEntry[] {
  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    jobTitle: r.jobTitle ?? "",
    company: r.company ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
  }));
}

type ParseUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type ParsedProfile = {
  fullName: string | null;
  dateOfBirth: string | null;
  gender: (typeof GENDERS)[number]["value"] | null;
  maritalStatus: (typeof MARITAL_STATUSES)[number]["value"] | null;
  nationality: string | null;
  phone: string | null;
  drivingLicense: (typeof DRIVING_LICENSES)[number]["value"] | null;
  location: string | null;
  targetRole: string | null;
  preferredIndustry: (typeof INDUSTRIES)[number] | null;
  yearsExperience: number | null;
  professionalSkills: string[];
  softSkills: string[];
  employmentType: (typeof EMPLOYMENT_TYPES)[number]["value"] | null;
  expectedSalaryMin: number | null;
  expectedSalaryMax: number | null;
  bio: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  workExperiences: {
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    achievements: string | null;
  }[];
  education: {
    institution: string;
    fieldOfStudy: string | null;
    qualificationTier: QualificationTier;
    cgpa: string | null;
    graduationYear: number | null;
  }[];
  certifications: { name: string; issuer: string | null; year: number | null }[];
  languages: { language: string; spokenLevel: LanguageLevel; writtenLevel: LanguageLevel }[];
  references: { fullName: string; jobTitle: string | null; company: string | null; phone: string | null; email: string | null }[];
};

type DraftData = {
  avatarUrl: string | null;
  avatarIsAccountDefault: boolean;
  fullName: string;
  dateOfBirth: string;
  gender: (typeof GENDERS)[number]["value"] | "";
  maritalStatus: (typeof MARITAL_STATUSES)[number]["value"] | "";
  nationality: string;
  phone: string;
  drivingLicense: (typeof DRIVING_LICENSES)[number]["value"] | "";
  location: string;
  targetRole: string;
  preferredIndustry: (typeof INDUSTRIES)[number] | "";
  yearsExperience: string;
  professionalSkills: string[];
  softSkills: string[];
  employmentType: (typeof EMPLOYMENT_TYPES)[number]["value"];
  expectedSalaryMin: string;
  expectedSalaryMax: string;
  bio: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  workArrangement: (typeof WORK_ARRANGEMENTS)[number]["value"];
  workAuthorization: (typeof WORK_AUTHORIZATIONS)[number]["value"];
  noticePeriod: (typeof NOTICE_PERIODS)[number]["value"];
  workExperiences: Omit<WorkExperienceEntry, "id">[];
  education: Omit<EducationEntry, "id">[];
  certifications: Omit<CertificationEntry, "id">[];
  languages: Omit<LanguageEntry, "id">[];
  references: Omit<ReferenceEntry, "id">[];
  resumeFileName: string | null;
  resumeFileSize: number | null;
  resumeParseTokens: number | null;
  resumeParseDurationMs: number | null;
};

function isNonNegativeInt(value: string) {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function calculateAge(dateOfBirth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age >= 0 ? age : null;
}


const inputClass = formInputClass("gold");
const entryCardClass = "flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]";

function CategoryHeading({ label, first }: { label: string; first?: boolean }) {
  return (
    <p
      className={`col-span-full text-xl font-semibold text-[#141B2E] ${
        first ? "" : "mt-[6px] border-t border-black/[0.06] pt-[14px]"
      }`}
    >
      {label}
    </p>
  );
}

function SectionHeader({
  label,
  hint,
  onAdd,
  addLabel,
}: {
  label: string;
  hint?: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-[#4B5468]">{label}</p>
        {hint && <p className="text-xs text-[#9AA3B2]">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-[4px] rounded-full bg-[#FFF3D6] py-[6px] pl-[10px] pr-[12px] text-sm text-brand-gold-dark hover:bg-[#FFE9A6]"
      >
        <PlusIcon className="h-[10px] w-[10px]" />
        {addLabel}
      </button>
    </div>
  );
}

function EntryRemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove entry"
      className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
    >
      <XIcon className="h-[10px] w-[10px]" />
    </button>
  );
}

export default function OnboardingForm({
  mode = "onboarding",
  initialProfile,
  accountEmail: initialAccountEmail,
}: {
  mode?: "onboarding" | "edit";
  initialProfile?: JobseekerProfile;
  accountEmail?: string;
} = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveLabel = mode === "edit" ? "Save changes" : "Finish";
  // Existing profiles load locked — the user has to hit "Edit" before typing
  // unlocks the form and autosave can kick in. A brand-new profile (the
  // onboarding flow) is never locked, since there's nothing to protect yet.
  const [isEditing, setIsEditing] = useState(mode !== "edit");

  useEffect(() => {
    if (!savedAt) return;
    const timeout = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timeout);
  }, [savedAt]);

  // Same "intercept sidebar navigation" pattern as Post a Job's unsaved-work
  // guard — the dashboard shell's sidebar links call whatever guard is
  // provided via context before navigating away, so unlocking "Edit" here
  // without saving prompts the same confirm dialog rather than silently
  // discarding in-progress edits.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
  function guardNavigation(proceed: () => void) {
    if (mode === "edit" && isEditing) {
      setPendingProceed(() => proceed);
      setShowLeaveConfirm(true);
    } else {
      proceed();
    }
  }
  async function saveAndLeave() {
    setShowLeaveConfirm(false);
    const saved = await submitProfile();
    if (saved) {
      pendingProceed?.();
      setPendingProceed(null);
    }
  }
  function discardAndLeave() {
    setShowLeaveConfirm(false);
    pendingProceed?.();
    setPendingProceed(null);
  }
  // This form is rendered as `children` *inside* JobseekerDashboardShell
  // (edit mode) — its sidebar sits above this component in the tree, so a
  // context Provider rendered here could never reach it. Registers into the
  // shell's own UnsavedChangesGuardBoundary instead (see that file for why).
  useRegisterUnsavedChangesGuard(guardNavigation);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile?.avatarUrl ?? null);
  // True only while avatarUrl is still the unconfirmed Google account
  // picture auto-filled below, never something the jobseeker actually chose
  // — lets the resume-photo suggestion still offer to replace it, instead of
  // hiding just because *some* avatar happens to be set.
  const [avatarIsAccountDefault, setAvatarIsAccountDefault] = useState(false);
  // A URL can fail to load for reasons outside our control — e.g. a Google
  // account picture blocked by the viewer's own ad blocker/privacy
  // extension — without the underlying value actually being broken. Falls
  // back to the placeholder icon instead of the browser's broken-image
  // glyph. Cleared at every call site that sets a new avatarUrl, so a fresh
  // value always gets a fresh chance to load.
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [suggestedAvatarUrl, setSuggestedAvatarUrl] = useState<string | null>(null);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [restoredResume, setRestoredResume] = useState<{
    name: string;
    size: number;
    tokens: number | null;
    durationMs: number | null;
  } | null>(
    initialProfile?.resumeFileName
      ? {
          name: initialProfile.resumeFileName,
          size: initialProfile.resumeFileSize ?? 0,
          tokens: null,
          durationMs: null,
        }
      : null,
  );
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const [showResumeWarning, setShowResumeWarning] = useState(false);
  const [showParseConfirm, setShowParseConfirm] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseElapsedMs, setParseElapsedMs] = useState(0);
  const [parseUsage, setParseUsage] = useState<ParseUsage | null>(null);
  const [parseDurationMs, setParseDurationMs] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!parsing) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setParseElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [parsing]);

  const [fullName, setFullName] = useState(initialProfile?.fullName ?? "");
  const draftContext = useDraftName();
  const setDraftName = draftContext?.setDraftName;
  useEffect(() => {
    setDraftName?.(fullName);
  }, [fullName, setDraftName]);
  const setDraftAvatarUrl = draftContext?.setDraftAvatarUrl;
  useEffect(() => {
    setDraftAvatarUrl?.(avatarUrl);
  }, [avatarUrl, setDraftAvatarUrl]);
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile?.dateOfBirth ?? "");
  const [gender, setGender] = useState<(typeof GENDERS)[number]["value"] | "">(
    (initialProfile?.gender as (typeof GENDERS)[number]["value"] | null | undefined) ?? "",
  );
  const [maritalStatus, setMaritalStatus] = useState<(typeof MARITAL_STATUSES)[number]["value"] | "">(
    (initialProfile?.maritalStatus as (typeof MARITAL_STATUSES)[number]["value"] | null | undefined) ?? "",
  );
  const [nationality, setNationality] = useState(initialProfile?.nationality ?? "");
  const [accountEmail, setAccountEmail] = useState(initialAccountEmail ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [drivingLicense, setDrivingLicense] = useState<(typeof DRIVING_LICENSES)[number]["value"] | "">(
    (initialProfile?.drivingLicense as (typeof DRIVING_LICENSES)[number]["value"] | null | undefined) ?? "",
  );
  const [location, setLocation] = useState(initialProfile?.location ?? "");
  const [targetRole, setTargetRole] = useState(initialProfile?.targetRole ?? "");
  const [preferredIndustry, setPreferredIndustry] = useState<(typeof INDUSTRIES)[number] | "">(
    (initialProfile?.preferredIndustry as (typeof INDUSTRIES)[number] | null | undefined) ?? "",
  );
  const [yearsExperience, setYearsExperience] = useState(
    initialProfile?.yearsExperience != null ? String(initialProfile.yearsExperience) : "",
  );
  const [professionalSkillInput, setProfessionalSkillInput] = useState("");
  const [professionalSkills, setProfessionalSkills] = useState<string[]>(
    initialProfile?.professionalSkills ?? [],
  );
  const [softSkillInput, setSoftSkillInput] = useState("");
  const [softSkills, setSoftSkills] = useState<string[]>(initialProfile?.softSkills ?? []);
  const [skillSuggestions, setSkillSuggestions] = useState<{
    professionalSkills: string[];
    softSkills: string[];
  } | null>(null);
  const [suggestingSkills, setSuggestingSkills] = useState(false);
  const [suggestSkillsError, setSuggestSkillsError] = useState<string | null>(null);
  const [suggestSkillsStatus, setSuggestSkillsStatus] = useState<string | null>(null);
  const [suggestSkillsElapsedMs, setSuggestSkillsElapsedMs] = useState(0);
  const [suggestSkillsTokens, setSuggestSkillsTokens] = useState<number | null>(null);
  const [suggestSkillsDurationMs, setSuggestSkillsDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (!suggestingSkills) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setSuggestSkillsElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [suggestingSkills]);
  const [employmentType, setEmploymentType] = useState<(typeof EMPLOYMENT_TYPES)[number]["value"]>(
    (initialProfile?.employmentType as (typeof EMPLOYMENT_TYPES)[number]["value"] | undefined) ??
      "full_time",
  );
  const [expectedSalaryMin, setExpectedSalaryMin] = useState(
    initialProfile?.expectedSalaryMin != null ? String(initialProfile.expectedSalaryMin) : "",
  );
  const [expectedSalaryMax, setExpectedSalaryMax] = useState(
    initialProfile?.expectedSalaryMax != null ? String(initialProfile.expectedSalaryMax) : "",
  );

  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedinUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(initialProfile?.portfolioUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(initialProfile?.githubUrl ?? "");
  const [workArrangement, setWorkArrangement] = useState<(typeof WORK_ARRANGEMENTS)[number]["value"]>(
    (initialProfile?.workArrangement as (typeof WORK_ARRANGEMENTS)[number]["value"] | undefined) ??
      "onsite",
  );
  const [workAuthorization, setWorkAuthorization] = useState<
    (typeof WORK_AUTHORIZATIONS)[number]["value"]
  >(
    (initialProfile?.workAuthorization as (typeof WORK_AUTHORIZATIONS)[number]["value"] | undefined) ??
      "citizen",
  );
  const [noticePeriod, setNoticePeriod] = useState<(typeof NOTICE_PERIODS)[number]["value"]>(
    (initialProfile?.noticePeriod as (typeof NOTICE_PERIODS)[number]["value"] | undefined) ?? "immediate",
  );

  const [workExperiences, setWorkExperiences] = useState<WorkExperienceEntry[]>(
    initialProfile ? mapWorkExperiences(initialProfile.workExperiences) : [],
  );
  const [education, setEducation] = useState<EducationEntry[]>(
    initialProfile ? mapEducation(initialProfile.education) : [],
  );
  const [certifications, setCertifications] = useState<CertificationEntry[]>(
    initialProfile ? mapCertifications(initialProfile.certifications) : [],
  );
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    initialProfile ? mapLanguages(initialProfile.languages) : [],
  );
  const [references, setReferences] = useState<ReferenceEntry[]>(
    initialProfile ? mapReferences(initialProfile.references) : [],
  );

  const [draftLoaded, setDraftLoaded] = useState(mode === "edit");
  const [autosaveError, setAutosaveError] = useState(false);
  const draftSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeParseId = useRef(0);

  // Loaded once on mount so a refresh — or logging back in on any device —
  // picks up where the user left off. Saved server-side (not localStorage)
  // since a draft tied only to the browser wouldn't survive logging in
  // elsewhere and could leak between different users on a shared browser.
  // Skipped in edit mode — there's no draft to resume, the profile already
  // exists and its values were used to seed state above.
  useEffect(() => {
    if (mode === "edit") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jobseeker/onboarding-draft");
        const data = await res.json();
        const draft = (res.ok ? data.draft : null) as Partial<DraftData> | null;
        if (draft && !cancelled) {
          if (draft.avatarUrl) {
            setAvatarUrl(draft.avatarUrl);
            setAvatarIsAccountDefault(Boolean(draft.avatarIsAccountDefault));
          }
          if (draft.fullName) setFullName(draft.fullName);
          if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
          if (draft.gender) setGender(draft.gender);
          if (draft.maritalStatus) setMaritalStatus(draft.maritalStatus);
          if (draft.nationality) setNationality(draft.nationality);
          if (draft.phone) setPhone(draft.phone);
          if (draft.drivingLicense) setDrivingLicense(draft.drivingLicense);
          if (draft.location) setLocation(draft.location);
          if (draft.targetRole) setTargetRole(draft.targetRole);
          if (draft.preferredIndustry) setPreferredIndustry(draft.preferredIndustry);
          if (draft.yearsExperience) setYearsExperience(draft.yearsExperience);
          if (draft.professionalSkills?.length) setProfessionalSkills(draft.professionalSkills);
          if (draft.softSkills?.length) setSoftSkills(draft.softSkills);
          if (draft.employmentType) setEmploymentType(draft.employmentType);
          if (draft.expectedSalaryMin) setExpectedSalaryMin(draft.expectedSalaryMin);
          if (draft.expectedSalaryMax) setExpectedSalaryMax(draft.expectedSalaryMax);
          if (draft.bio) setBio(draft.bio);
          if (draft.linkedinUrl) setLinkedinUrl(draft.linkedinUrl);
          if (draft.portfolioUrl) setPortfolioUrl(draft.portfolioUrl);
          if (draft.githubUrl) setGithubUrl(draft.githubUrl);
          if (draft.workArrangement) setWorkArrangement(draft.workArrangement);
          if (draft.workAuthorization) setWorkAuthorization(draft.workAuthorization);
          if (draft.noticePeriod) setNoticePeriod(draft.noticePeriod);
          if (draft.workExperiences?.length) {
            setWorkExperiences(draft.workExperiences.map((entry) => ({ ...entry, id: newId() })));
          }
          if (draft.education?.length) {
            setEducation(draft.education.map((entry) => ({ ...entry, id: newId() })));
          }
          if (draft.certifications?.length) {
            setCertifications(draft.certifications.map((entry) => ({ ...entry, id: newId() })));
          }
          if (draft.languages?.length) {
            setLanguages(draft.languages.map((entry) => ({ ...entry, id: newId() })));
          }
          if (draft.references?.length) {
            setReferences(draft.references.map((entry) => ({ ...entry, id: newId() })));
          }
          if (draft.resumeFileName) {
            setRestoredResume({
              name: draft.resumeFileName,
              size: draft.resumeFileSize ?? 0,
              tokens: draft.resumeParseTokens ?? null,
              durationMs: draft.resumeParseDurationMs ?? null,
            });
          }
        }
        if (!cancelled) {
          try {
            const meRes = await fetch("/api/auth/me");
            const me = await meRes.json();
            if (!cancelled && meRes.ok) {
              if (!draft?.avatarUrl && me.user?.avatarUrl) {
                setAvatarUrl(me.user.avatarUrl);
                setAvatarIsAccountDefault(true);
              }
              // Email is always the account's sign-in email — shown read-only,
              // never a separately editable field here.
              if (me.user?.email) setAccountEmail(me.user.email);
            }
          } catch {
            // No account info to prefill — leave those fields empty.
          }
        }
      } catch {
        // No draft, or the fetch failed — just start from a blank form.
      } finally {
        if (!cancelled) setDraftLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Debounced autosave — waits for a pause in typing rather than saving on
  // every keystroke. Gated on draftLoaded so the initial fetch above isn't
  // immediately overwritten by the empty pre-load form state. Skipped in
  // edit mode — there's no draft to autosave to once a profile exists.
  useEffect(() => {
    if (mode === "edit" || !draftLoaded) return;
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    draftSaveTimeout.current = setTimeout(() => {
      const payload: DraftData = {
        avatarUrl,
        avatarIsAccountDefault,
        fullName,
        dateOfBirth,
        gender,
        maritalStatus,
        nationality,
        phone,
        drivingLicense,
        location,
        targetRole,
        preferredIndustry,
        yearsExperience,
        professionalSkills,
        softSkills,
        employmentType,
        expectedSalaryMin,
        expectedSalaryMax,
        bio,
        linkedinUrl,
        portfolioUrl,
        githubUrl,
        workArrangement,
        workAuthorization,
        noticePeriod,
        workExperiences: workExperiences.map((e) => ({
          company: e.company,
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          isCurrent: e.isCurrent,
          achievements: e.achievements,
        })),
        education: education.map((e) => ({
          institution: e.institution,
          fieldOfStudy: e.fieldOfStudy,
          qualificationTier: e.qualificationTier,
          cgpa: e.cgpa,
          graduationYear: e.graduationYear,
        })),
        certifications: certifications.map((e) => ({ name: e.name, issuer: e.issuer, year: e.year })),
        languages: languages.map((e) => ({
          language: e.language,
          spokenLevel: e.spokenLevel,
          writtenLevel: e.writtenLevel,
        })),
        references: references.map((e) => ({
          fullName: e.fullName,
          jobTitle: e.jobTitle,
          company: e.company,
          phone: e.phone,
          email: e.email,
        })),
        resumeFileName: resumeFile?.name ?? restoredResume?.name ?? null,
        resumeFileSize: resumeFile?.size ?? restoredResume?.size ?? null,
        resumeParseTokens: parseUsage?.total_tokens ?? restoredResume?.tokens ?? null,
        resumeParseDurationMs: parseDurationMs ?? restoredResume?.durationMs ?? null,
      };
      fetch("/api/jobseeker/onboarding-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => setAutosaveError(!res.ok))
        .catch(() => setAutosaveError(true));
    }, 1000);
    return () => {
      if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    };
  }, [
    mode,
    draftLoaded,
    avatarUrl,
    avatarIsAccountDefault,
    fullName,
    dateOfBirth,
    gender,
    maritalStatus,
    nationality,
    phone,
    drivingLicense,
    location,
    targetRole,
    preferredIndustry,
    yearsExperience,
    professionalSkills,
    softSkills,
    employmentType,
    expectedSalaryMin,
    expectedSalaryMax,
    bio,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    workArrangement,
    workAuthorization,
    noticePeriod,
    workExperiences,
    education,
    certifications,
    languages,
    references,
    resumeFile,
    restoredResume,
    parseUsage,
    parseDurationMs,
  ]);

  function updateWorkExperience(id: string, patch: Partial<WorkExperienceEntry>) {
    setWorkExperiences((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }
  function removeWorkExperience(id: string) {
    setWorkExperiences((prev) => prev.filter((entry) => entry.id !== id));
  }

  function updateEducation(id: string, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }
  function removeEducation(id: string) {
    setEducation((prev) => prev.filter((entry) => entry.id !== id));
  }

  function updateCertification(id: string, patch: Partial<CertificationEntry>) {
    setCertifications((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }
  function removeCertification(id: string) {
    setCertifications((prev) => prev.filter((entry) => entry.id !== id));
  }

  function updateLanguage(id: string, patch: Partial<LanguageEntry>) {
    setLanguages((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }
  function removeLanguage(id: string) {
    setLanguages((prev) => prev.filter((entry) => entry.id !== id));
  }
  function updateReference(id: string, patch: Partial<ReferenceEntry>) {
    setReferences((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }
  function removeReference(id: string) {
    setReferences((prev) => prev.filter((entry) => entry.id !== id));
  }

  function addProfessionalSkill() {
    const value = professionalSkillInput.trim();
    if (!value || professionalSkills.includes(value)) {
      setProfessionalSkillInput("");
      return;
    }
    setProfessionalSkills((prev) => [...prev, value]);
    setProfessionalSkillInput("");
  }

  function removeProfessionalSkill(skill: string) {
    setProfessionalSkills((prev) => prev.filter((s) => s !== skill));
  }

  function handleProfessionalSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addProfessionalSkill();
    }
  }

  function addSoftSkill() {
    const value = softSkillInput.trim();
    if (!value || softSkills.includes(value)) {
      setSoftSkillInput("");
      return;
    }
    setSoftSkills((prev) => [...prev, value]);
    setSoftSkillInput("");
  }

  function removeSoftSkill(skill: string) {
    setSoftSkills((prev) => prev.filter((s) => s !== skill));
  }

  function handleSoftSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSoftSkill();
    }
  }

  async function suggestSkills() {
    if (!targetRole.trim()) {
      setSuggestSkillsError("Enter your target role first.");
      return;
    }
    setSuggestingSkills(true);
    setSuggestSkillsError(null);
    setSuggestSkillsStatus(null);
    setSuggestSkillsElapsedMs(0);
    setSuggestSkillsTokens(null);
    setSuggestSkillsDurationMs(null);
    try {
      const res = await fetch("/api/jobseeker/suggest-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: targetRole.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't suggest skills.");
      setSkillSuggestions({
        professionalSkills: (data.suggestions?.professionalSkills ?? []).filter(
          (s: string) => !professionalSkills.includes(s),
        ),
        softSkills: (data.suggestions?.softSkills ?? []).filter((s: string) => !softSkills.includes(s)),
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

  function addSuggestedProfessionalSkill(skill: string) {
    setProfessionalSkills((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
    setSkillSuggestions((prev) =>
      prev ? { ...prev, professionalSkills: prev.professionalSkills.filter((s) => s !== skill) } : prev,
    );
  }

  function addSuggestedSoftSkill(skill: string) {
    setSoftSkills((prev) => (prev.includes(skill) ? prev : [...prev, skill]));
    setSkillSuggestions((prev) => (prev ? { ...prev, softSkills: prev.softSkills.filter((s) => s !== skill) } : prev));
  }

  // Two modes: the default only fills fields the user hasn't already typed
  // into (and adds new work/education/etc. entries alongside existing ones)
  // so a manual edit made while parsing is running is never clobbered.
  // `overwrite` is opt-in — reached only via the confirmation modal when the
  // form already has details — and replaces every field and list wholesale
  // with what this resume says, including clearing anything it doesn't
  // mention, since that's what "start over from this resume" means.
  function applyParsedProfile(profile: ParsedProfile, overwrite: boolean) {
    let filled = 0;
    const mark = () => filled++;

    if (overwrite) {
      setFullName(profile.fullName ?? "");
      setDateOfBirth(profile.dateOfBirth ?? "");
      setGender((profile.gender as (typeof GENDERS)[number]["value"] | null) ?? "");
      setMaritalStatus((profile.maritalStatus as (typeof MARITAL_STATUSES)[number]["value"] | null) ?? "");
      setNationality(profile.nationality ?? "");
      setPhone(profile.phone ?? "");
      setDrivingLicense((profile.drivingLicense as (typeof DRIVING_LICENSES)[number]["value"] | null) ?? "");
      setLocation(profile.location ?? "");
      setTargetRole(profile.targetRole ?? "");
      setYearsExperience(profile.yearsExperience !== null ? String(profile.yearsExperience) : "");
      setProfessionalSkills(profile.professionalSkills);
      setSoftSkills(profile.softSkills);
      setEmploymentType(profile.employmentType ?? "full_time");
      setExpectedSalaryMin(profile.expectedSalaryMin !== null ? String(profile.expectedSalaryMin) : "");
      setExpectedSalaryMax(profile.expectedSalaryMax !== null ? String(profile.expectedSalaryMax) : "");
      setBio(profile.bio ?? "");
      setLinkedinUrl(profile.linkedinUrl ?? "");
      setPortfolioUrl(profile.portfolioUrl ?? "");
      setGithubUrl(profile.githubUrl ?? "");
      setWorkExperiences(
        profile.workExperiences.map((entry) => ({
          id: newId(),
          company: entry.company,
          title: entry.title,
          startDate: entry.startDate,
          endDate: entry.endDate ?? "",
          isCurrent: entry.isCurrent,
          achievements: entry.achievements ? plainTextToHtml(entry.achievements) : "",
        })),
      );
      setEducation(
        profile.education.map((entry) => ({
          id: newId(),
          institution: entry.institution,
          fieldOfStudy: entry.fieldOfStudy ?? "",
          qualificationTier: entry.qualificationTier,
          cgpa: entry.cgpa ?? "",
          graduationYear: entry.graduationYear !== null ? String(entry.graduationYear) : "",
        })),
      );
      setCertifications(
        profile.certifications.map((entry) => ({
          id: newId(),
          name: entry.name,
          issuer: entry.issuer ?? "",
          year: entry.year !== null ? String(entry.year) : "",
        })),
      );
      setLanguages(
        profile.languages.map((entry) => ({
          id: newId(),
          language: entry.language,
          spokenLevel: entry.spokenLevel,
          writtenLevel: entry.writtenLevel,
        })),
      );
      setReferences(
        profile.references.map((entry) => ({
          id: newId(),
          fullName: entry.fullName,
          jobTitle: entry.jobTitle ?? "",
          company: entry.company ?? "",
          phone: entry.phone ?? "",
          email: entry.email ?? "",
        })),
      );

      setResumeStatus("Replaced with details from your resume — check everything before finishing.");
      return;
    }

    if (profile.fullName) {
      setFullName((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.fullName as string;
      });
    }
    if (profile.dateOfBirth) {
      setDateOfBirth((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.dateOfBirth as string;
      });
    }
    if (profile.gender) {
      setGender((prev) => {
        if (prev) return prev;
        mark();
        return profile.gender as (typeof GENDERS)[number]["value"];
      });
    }
    if (profile.maritalStatus) {
      setMaritalStatus((prev) => {
        if (prev) return prev;
        mark();
        return profile.maritalStatus as (typeof MARITAL_STATUSES)[number]["value"];
      });
    }
    if (profile.nationality) {
      setNationality((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.nationality as string;
      });
    }
    if (profile.phone) {
      setPhone((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.phone as string;
      });
    }
    if (profile.drivingLicense) {
      setDrivingLicense((prev) => {
        if (prev) return prev;
        mark();
        return profile.drivingLicense as (typeof DRIVING_LICENSES)[number]["value"];
      });
    }
    if (profile.location) {
      setLocation((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.location as string;
      });
    }
    if (profile.targetRole) {
      setTargetRole((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.targetRole as string;
      });
    }
    if (profile.yearsExperience !== null) {
      setYearsExperience((prev) => {
        if (prev.trim()) return prev;
        mark();
        return String(profile.yearsExperience);
      });
    }
    if (profile.professionalSkills.length > 0) {
      setProfessionalSkills((prev) => {
        mark();
        return Array.from(new Set([...prev, ...profile.professionalSkills]));
      });
    }
    if (profile.softSkills.length > 0) {
      setSoftSkills((prev) => {
        mark();
        return Array.from(new Set([...prev, ...profile.softSkills]));
      });
    }
    if (profile.employmentType) {
      setEmploymentType(profile.employmentType);
      mark();
    }
    if (profile.expectedSalaryMin !== null) {
      setExpectedSalaryMin((prev) => {
        if (prev.trim()) return prev;
        mark();
        return String(profile.expectedSalaryMin);
      });
    }
    if (profile.expectedSalaryMax !== null) {
      setExpectedSalaryMax((prev) => {
        if (prev.trim()) return prev;
        mark();
        return String(profile.expectedSalaryMax);
      });
    }
    if (profile.bio) {
      setBio((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.bio as string;
      });
    }
    if (profile.linkedinUrl) {
      setLinkedinUrl((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.linkedinUrl as string;
      });
    }
    if (profile.portfolioUrl) {
      setPortfolioUrl((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.portfolioUrl as string;
      });
    }
    if (profile.githubUrl) {
      setGithubUrl((prev) => {
        if (prev.trim()) return prev;
        mark();
        return profile.githubUrl as string;
      });
    }
    if (profile.workExperiences.length > 0) {
      setWorkExperiences((prev) => [
        ...prev,
        ...profile.workExperiences.map((entry) => ({
          id: newId(),
          company: entry.company,
          title: entry.title,
          startDate: entry.startDate,
          endDate: entry.endDate ?? "",
          isCurrent: entry.isCurrent,
          achievements: entry.achievements ? plainTextToHtml(entry.achievements) : "",
        })),
      ]);
      mark();
    }
    if (profile.education.length > 0) {
      setEducation((prev) => [
        ...prev,
        ...profile.education.map((entry) => ({
          id: newId(),
          institution: entry.institution,
          fieldOfStudy: entry.fieldOfStudy ?? "",
          qualificationTier: entry.qualificationTier,
          cgpa: entry.cgpa ?? "",
          graduationYear: entry.graduationYear !== null ? String(entry.graduationYear) : "",
        })),
      ]);
      mark();
    }
    if (profile.certifications.length > 0) {
      setCertifications((prev) => [
        ...prev,
        ...profile.certifications.map((entry) => ({
          id: newId(),
          name: entry.name,
          issuer: entry.issuer ?? "",
          year: entry.year !== null ? String(entry.year) : "",
        })),
      ]);
      mark();
    }
    if (profile.languages.length > 0) {
      setLanguages((prev) => [
        ...prev,
        ...profile.languages.map((entry) => ({
          id: newId(),
          language: entry.language,
          spokenLevel: entry.spokenLevel,
          writtenLevel: entry.writtenLevel,
        })),
      ]);
      mark();
    }
    if (profile.references.length > 0) {
      setReferences((prev) => [
        ...prev,
        ...profile.references.map((entry) => ({
          id: newId(),
          fullName: entry.fullName,
          jobTitle: entry.jobTitle ?? "",
          company: entry.company ?? "",
          phone: entry.phone ?? "",
          email: entry.email ?? "",
        })),
      ]);
      mark();
    }

    setResumeStatus(
      filled > 0
        ? "Filled in from your resume — check everything before finishing."
        : "Couldn't find much in that resume — fill in the fields manually.",
    );
  }

  function handleAvatarFile(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    if (!picked.type.startsWith("image/")) {
      setAvatarError("Choose an image file.");
      return;
    }
    if (picked.size > AVATAR_MAX_BYTES) {
      setAvatarError("Image is too large — max 3 MB.");
      return;
    }

    setAvatarError(null);
    setAvatarIsAccountDefault(false);
    setAvatarLoadFailed(false);
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setAvatarError("Couldn't read that image.");
    reader.readAsDataURL(picked);
  }

  function clearAvatar() {
    setAvatarUrl(null);
    setAvatarIsAccountDefault(false);
    setAvatarError(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  function acceptSuggestedAvatar() {
    if (!suggestedAvatarUrl) return;
    setAvatarUrl(suggestedAvatarUrl);
    setAvatarIsAccountDefault(false);
    setAvatarLoadFailed(false);
    setSuggestedAvatarUrl(null);
  }

  function dismissSuggestedAvatar() {
    setSuggestedAvatarUrl(null);
  }

  function handleResumeFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    attachResumeFile(picked);
  }

  // Just attaches the file — parsing only starts when the user explicitly
  // clicks "Parse resume", never automatically on attach.
  function attachResumeFile(picked: File) {
    if (picked.size > RESUME_MAX_BYTES) {
      setResumeError("File is too large — max 10 MB.");
      setResumeFile(null);
      return;
    }

    resumeParseId.current++;
    setResumeError(null);
    setResumeStatus(null);
    setRestoredResume(null);
    setResumeFile(picked);
    setParseUsage(null);
    setParseDurationMs(null);
    setParseElapsedMs(0);
    setParsing(false);
    setSuggestedAvatarUrl(null);
  }

  async function parseResume(overwrite: boolean) {
    if (!resumeFile) return;
    setResumeError(null);
    setResumeStatus(null);
    setParseUsage(null);
    setParseDurationMs(null);
    setParseElapsedMs(0);
    setSuggestedAvatarUrl(null);
    setParsing(true);
    const requestId = ++resumeParseId.current;
    try {
      const body = new FormData();
      body.append("resume", resumeFile);
      const res = await fetch("/api/jobseeker/parse-resume", { method: "POST", body });
      if (requestId !== resumeParseId.current) return;
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Couldn't read that resume.");
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that resume.");
      setParseUsage((data.usage as ParseUsage | undefined) ?? null);
      setParseDurationMs(typeof data.durationMs === "number" ? data.durationMs : null);
      if (typeof data.photoUrl === "string") setSuggestedAvatarUrl(data.photoUrl);
      applyParsedProfile(data.profile as ParsedProfile, overwrite);
    } catch (err) {
      if (requestId !== resumeParseId.current) return;
      setResumeError(err instanceof Error ? err.message : "Couldn't read that resume.");
    } finally {
      if (requestId === resumeParseId.current) setParsing(false);
    }
  }

  // Parsing only fills fields the user left empty and adds new work
  // experience/education/certification/language entries — it never
  // overwrites something already typed. Still, appending entries on top of
  // ones already entered by hand can come as a surprise, so anyone who's
  // already put real details into the form gets a heads-up and has to
  // confirm before the parse runs.
  function hasExistingDetails() {
    return Boolean(
      fullName.trim() ||
        location.trim() ||
        targetRole.trim() ||
        bio.trim() ||
        professionalSkills.length > 0 ||
        softSkills.length > 0 ||
        workExperiences.length > 0 ||
        education.length > 0 ||
        certifications.length > 0 ||
        languages.length > 0,
    );
  }

  function handleParseClick() {
    if (hasExistingDetails()) {
      setShowParseConfirm(true);
      return;
    }
    parseResume(false);
  }

  // Picks up a resume handed off from the landing page's ResumeUpload
  // (selected before the user had an account) so it's actually parsed here
  // instead of silently disappearing after signup.
  useEffect(() => {
    if (!draftLoaded || resumeFile || restoredResume) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_RESUME_KEY);
      sessionStorage.removeItem(PENDING_RESUME_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    (async () => {
      try {
        const { name, type, dataUrl } = JSON.parse(raw as string) as {
          name: string;
          type: string;
          dataUrl: string;
        };
        const blob = await (await fetch(dataUrl)).blob();
        attachResumeFile(new File([blob], name, { type }));
      } catch {
        // Corrupt handoff payload — just leave the form blank for manual entry.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded]);

  function clearResume() {
    resumeParseId.current++;
    setParsing(false);
    setResumeFile(null);
    setRestoredResume(null);
    setResumeError(null);
    setResumeStatus(null);
    setParseUsage(null);
    setParseDurationMs(null);
    setSuggestedAvatarUrl(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  }

  // Clears every field resume parsing can populate, back to blank/default —
  // not just the attached file (that's what clearResume does), the actual
  // values it filled in — plus removes the attachment itself so the form is
  // a clean slate for a fresh upload or manual entry.
  function resetResumeFields() {
    clearResume();
    setFullName("");
    setLocation("");
    setTargetRole("");
    setYearsExperience("");
    setProfessionalSkills([]);
    setSoftSkills([]);
    setEmploymentType("full_time");
    setExpectedSalaryMin("");
    setExpectedSalaryMax("");
    setBio("");
    setLinkedinUrl("");
    setPortfolioUrl("");
    setGithubUrl("");
    setWorkExperiences([]);
    setEducation([]);
    setCertifications([]);
    setLanguages([]);
    setReferences([]);
  }

  const formValid =
    fullName.trim().length > 0 &&
    location.trim().length > 0 &&
    targetRole.trim().length > 0 &&
    isNonNegativeInt(yearsExperience) &&
    professionalSkills.length > 0 &&
    isNonNegativeInt(expectedSalaryMin) &&
    isNonNegativeInt(expectedSalaryMax) &&
    Number(expectedSalaryMin) <= Number(expectedSalaryMax) &&
    preferredIndustry.length > 0;

  // Tells the jobseeker which required field(s) are blocking the disabled
  // Finish button — otherwise it just sits unclickable with no explanation.
  const salaryFilled = isNonNegativeInt(expectedSalaryMin) && isNonNegativeInt(expectedSalaryMax);
  const requiredFieldChecklist = [
    { label: "Full name", done: fullName.trim().length > 0, fieldId: "fullName" },
    { label: "Location", done: location.trim().length > 0, fieldId: "location" },
    { label: "Target role", done: targetRole.trim().length > 0, fieldId: "targetRole" },
    { label: "Years of experience", done: isNonNegativeInt(yearsExperience), fieldId: "yearsExperience" },
    { label: "Professional Skills", done: professionalSkills.length > 0, fieldId: "professionalSkillInput" },
    {
      label: "Min salary and Max salary (min ≤ max)",
      done: salaryFilled && Number(expectedSalaryMin) <= Number(expectedSalaryMax),
      fieldId: "expectedSalaryMin",
    },
    { label: "Preferred industry", done: preferredIndustry.length > 0, fieldId: "preferredIndustry" },
  ];

  function goToField(fieldId: string) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  // Not required to submit, but each one nudges the profile toward better
  // matches and a resume that actually stands out — friendly nudges, not
  // blockers, so this never touches formValid.
  const hasResume = Boolean(resumeFile || restoredResume);
  const boostChecklist = [
    {
      label: "Add a profile photo — profiles with a face get noticed first.",
      done: Boolean(avatarUrl),
      fieldId: "avatarUploadButton",
    },
    // In edit mode the resume card lives in the dashboard sidebar (not on
    // this page), so there's no "resumeUploadCard" element to scroll to —
    // skip the nudge here rather than point at nothing.
    ...(mode === "edit"
      ? []
      : [
          {
            label: "Upload your resume — let AI autofill your profile and back up your story.",
            done: hasResume,
            fieldId: "resumeUploadCard",
          },
        ]),
    {
      label: "Throw in a few soft skills — show you're more than just your tools.",
      done: softSkills.length > 0,
      fieldId: "softSkillInput",
    },
    {
      label: "Write a short bio — your 30-second pitch that makes recruiters remember you.",
      done: bio.trim().length > 0,
      fieldId: "bio",
    },
    {
      label: "Link your LinkedIn — let your full story back up your profile.",
      done: linkedinUrl.trim().length > 0,
      fieldId: "linkedinUrl",
    },
    {
      label: "Add a portfolio link — let your work do the talking.",
      done: portfolioUrl.trim().length > 0,
      fieldId: "portfolioUrl",
    },
    {
      label: "Share your GitHub — great for showing employers your code, not just your resume.",
      done: githubUrl.trim().length > 0,
      fieldId: "githubUrl",
    },
    {
      label: "Add a reference — a quick credibility boost once employers get to that stage.",
      done: references.length > 0,
      fieldId: "referencesSection",
    },
  ];
  const boostChecklistRemaining = boostChecklist.filter((item) => !item.done).length;

  async function submitProfile(opts: { keepalive?: boolean } = {}): Promise<boolean> {
    setError(null);
    setSavedAt(null);
    setSubmitting(true);
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    try {
      // Only a freshly-picked File (this session) has actual bytes to
      // persist — a restored draft only ever kept the filename/size, not
      // the file itself (browser File objects don't survive a reload), so
      // resuming a draft without re-attaching still submits without one.
      let resumeUrl: string | null = null;
      try {
        resumeUrl = resumeFile ? await fileToDataUrl(resumeFile) : null;
      } catch {
        resumeUrl = null;
      }
      const resumeFileName = resumeFile?.name ?? restoredResume?.name ?? null;
      const resumeFileSize = resumeFile?.size ?? restoredResume?.size ?? null;

      const res = await fetch("/api/jobseeker/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: opts.keepalive,
        body: JSON.stringify({
          avatarUrl,
          fullName,
          resumeUrl,
          resumeFileName,
          resumeFileSize,
          dateOfBirth: dateOfBirth.trim() || null,
          gender: gender || null,
          maritalStatus: maritalStatus || null,
          nationality: nationality.trim() || null,
          phone: phone.trim() || null,
          drivingLicense: drivingLicense || null,
          location,
          targetRole,
          preferredIndustry,
          yearsExperience: Number(yearsExperience),
          professionalSkills,
          softSkills,
          employmentType,
          expectedSalaryMin: Number(expectedSalaryMin),
          expectedSalaryMax: Number(expectedSalaryMax),
          bio: bio.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          portfolioUrl: portfolioUrl.trim() || null,
          githubUrl: githubUrl.trim() || null,
          noticePeriod,
          workArrangement,
          workAuthorization,
          workExperiences: workExperiences
            .filter((e) => e.company.trim() && e.title.trim() && e.startDate.trim())
            .map((e) => ({
              company: e.company.trim(),
              title: e.title.trim(),
              startDate: e.startDate.trim(),
              endDate: e.isCurrent ? null : e.endDate.trim() || null,
              isCurrent: e.isCurrent,
              achievements: e.achievements.trim() || null,
            })),
          education: education
            .filter((e) => e.institution.trim() && e.qualificationTier)
            .map((e) => ({
              institution: e.institution.trim(),
              fieldOfStudy: e.fieldOfStudy.trim() || null,
              qualificationTier: e.qualificationTier,
              cgpa: e.cgpa.trim() || null,
              graduationYear: e.graduationYear.trim() ? Number(e.graduationYear) : null,
            })),
          certifications: certifications
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name.trim(),
              issuer: c.issuer.trim() || null,
              year: c.year.trim() ? Number(c.year) : null,
            })),
          languages: languages
            .filter((l) => l.language.trim())
            .map((l) => ({
              language: l.language.trim(),
              spokenLevel: l.spokenLevel,
              writtenLevel: l.writtenLevel,
            })),
          references: references
            .filter((r) => r.fullName.trim())
            .map((r) => ({
              fullName: r.fullName.trim(),
              jobTitle: r.jobTitle.trim() || null,
              company: r.company.trim() || null,
              phone: r.phone.trim() || null,
              email: r.email.trim() || null,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your profile.");
      if (mode === "edit") {
        setSavedAt(Date.now());
        setIsEditing(false);
        router.refresh();
      } else {
        router.push("/jobseeker/dashboard");
        router.refresh();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinishClick() {
    if (!hasResume) {
      setShowResumeWarning(true);
      return;
    }
    submitProfile();
  }

  if (!draftLoaded) {
    return (
      <div className={`mx-auto flex w-full flex-col gap-[20px] lg:flex-row lg:items-start ${mode === "edit" ? "" : "max-w-[1100px]"}`}>
        <div className={`${gradientFrameClass("gold")} lg:sticky lg:top-[22px] lg:flex-[1]`}>
          <div className="h-[280px] animate-pulse rounded-[19px] bg-white" />
        </div>
        <div className="flex min-w-0 flex-col gap-[20px] lg:flex-[2]">
          <div className={gradientFrameClass("gold")}>
            <div className="h-[520px] animate-pulse rounded-[19px] bg-white" />
          </div>
          <div className={gradientFrameClass("gold")}>
            <div className="h-[420px] animate-pulse rounded-[19px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start">
      {mode !== "edit" && (
      <div className={`${gradientFrameClass("gold")} lg:sticky lg:top-[22px] lg:flex-[1]`}>
        <div id="resumeUploadCard" className="rounded-[19px] bg-white p-[22px] text-left">
          <h2 className="text-lg font-semibold text-[#141B2E]">Upload your resume</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            Optional — we&apos;ll autofill the form on the right from it.
          </p>

          <input
            ref={resumeInputRef}
            type="file"
            accept={RESUME_ACCEPT}
            className="hidden"
            onChange={(e) => handleResumeFiles(e.target.files)}
          />

          {resumeFile ? (
            <div className="mt-[14px] flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
              <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <FileIcon className="h-[17px] w-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#141B2E]">
                  {resumeFile.name}
                </p>
                <p className="text-xs text-[#9AA3B2]">
                  {parsing
                    ? `Reading your resume… ${(parseElapsedMs / 1000).toFixed(1)}s`
                    : parseUsage
                      ? `${formatSize(resumeFile.size)} · ${parseUsage.total_tokens ?? "?"} tokens · ${(
                          (parseDurationMs ?? 0) / 1000
                        ).toFixed(1)}s`
                      : formatSize(resumeFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={clearResume}
                aria-label="Remove resume"
                disabled={parsing}
                className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-[#141B2E] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <XIcon className="h-[12px] w-[12px]" />
              </button>
            </div>
          ) : restoredResume ? (
            <div className="mt-[14px] flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
              <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <FileIcon className="h-[17px] w-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#141B2E]">{restoredResume.name}</p>
                <p className="text-xs text-[#9AA3B2]">
                  {[
                    restoredResume.size > 0 ? formatSize(restoredResume.size) : null,
                    restoredResume.tokens ? `${restoredResume.tokens} tokens` : null,
                    restoredResume.durationMs ? `${(restoredResume.durationMs / 1000).toFixed(1)}s` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Uploaded earlier"}
                </p>
              </div>
              <button
                type="button"
                onClick={clearResume}
                aria-label="Remove resume"
                className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-[#141B2E]"
              >
                <XIcon className="h-[12px] w-[12px]" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleResumeFiles(e.dataTransfer.files);
              }}
              className={`mt-[14px] flex w-full flex-col items-center justify-center gap-[6px] rounded-[14px] border border-dashed px-[16px] py-[18px] text-center transition-colors ${
                dragActive
                  ? "border-brand-gold-dark bg-[#FFF3D6]"
                  : "border-[#D7DCE4] hover:border-brand-gold-dark hover:bg-[#F8FAFB]"
              }`}
            >
              <UploadIcon className="h-[18px] w-[18px] text-brand-gold-dark" />
              <span className="text-xs text-[#141B2E]">
                Click to upload or drag and drop
              </span>
              <span className="text-xs text-[#9AA3B2]">PDF or DOCX · up to 10 MB</span>
            </button>
          )}

          {resumeFile && (parsing || !parseUsage) && (
            <button
              type="button"
              onClick={handleParseClick}
              disabled={parsing}
              className={`mt-[8px] flex h-[38px] w-full items-center justify-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                parsing ? "ai-fill-pulse" : ""
              }`}
            >
              <SiriOrb className="h-[14px] w-[14px]" active={parsing} />
              {parsing
                ? `Reading your resume… ${(parseElapsedMs / 1000).toFixed(1)}s`
                : "Parse resume — autofill this form"}
            </button>
          )}

          {/* A restored resume only has its filename/size on record — the
              actual bytes never survive a reload, so there's nothing to send
              to the parser until the user re-attaches the file. Only shown
              when it was never actually parsed (no token count on record) —
              once it has been, re-parsing isn't needed. */}
          {!resumeFile && restoredResume && restoredResume.tokens === null && (
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className="mt-[8px] flex h-[38px] w-full items-center justify-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90"
            >
              <SiriOrb className="h-[14px] w-[14px]" active={false} />
              Re-upload to parse this resume
            </button>
          )}

          {(resumeFile || restoredResume) && (
            <button
              type="button"
              onClick={resetResumeFields}
              disabled={parsing}
              aria-label="Clear resume-filled details"
              className="mt-[8px] h-[38px] w-full whitespace-nowrap rounded-[12px] bg-[#F1F4F8] px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset
            </button>
          )}

          {resumeError && <p className="mt-[8px] text-xs text-red-500">{resumeError}</p>}
          {resumeStatus && !resumeError && (
            <p className="mt-[8px] text-xs text-brand-gold-dark">{resumeStatus}</p>
          )}
        </div>
      </div>
      )}

      <div className={`flex min-w-0 flex-col gap-[20px] ${mode === "edit" ? "lg:flex-1" : "lg:flex-[2]"}`}>
      <div className={gradientFrameClass("gold")}>
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">Set up your profile</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Tell us a bit about yourself so we can match you with the right roles.
          </p>
          {autosaveError && (
            <p className="mt-[6px] text-xs text-red-500">
              Couldn&apos;t save your progress — check your connection.
            </p>
          )}

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
          <fieldset disabled={mode === "edit" && !isEditing} className="contents">
          <CategoryHeading label="Basic info" first />
          <div className="col-span-full flex items-center gap-[14px]">
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={(e) => handleAvatarFile(e.target.files)}
            />
            <button
              id="avatarUploadButton"
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label={avatarUrl ? "Change profile photo" : "Upload profile photo"}
              className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.1] bg-[#F1F4F8] text-[#9AA3B2] hover:border-brand-gold-dark"
            >
              {avatarUrl && !avatarLoadFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <UserIcon className="h-[26px] w-[26px]" />
              )}
            </button>
            <div className="flex flex-col gap-[4px]">
              <div className="flex items-center gap-[10px]">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-sm text-[#141B2E] hover:bg-black/[0.08]"
                >
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="text-sm text-[#9AA3B2] hover:text-[#141B2E]"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className={`text-xs ${avatarError ? "text-red-500" : "text-[#9AA3B2]"}`}>
                {avatarError ?? "JPG or PNG · up to 3 MB"}
              </p>
            </div>
          </div>

          {suggestedAvatarUrl && (!avatarUrl || avatarIsAccountDefault) && (
            <div className="col-span-full flex items-center gap-[12px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={suggestedAvatarUrl}
                alt="Photo found in resume"
                className="h-[44px] w-[44px] shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#141B2E]">Found a photo in your resume</p>
                <p className="text-xs text-[#9AA3B2]">Use it as your profile photo?</p>
              </div>
              <button
                type="button"
                onClick={acceptSuggestedAvatar}
                className="shrink-0 rounded-full bg-[#FFE9A6] px-[12px] py-[6px] text-sm text-[#141B2E] hover:opacity-90"
              >
                Use photo
              </button>
              <button
                type="button"
                onClick={dismissSuggestedAvatar}
                aria-label="Dismiss suggested photo"
                className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-[#141B2E]"
              >
                <XIcon className="h-[12px] w-[12px]" />
              </button>
            </div>
          )}

          <Field required label="Full name" htmlFor="fullName">
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Nur Aisyah"
              className={inputClass}
            />
          </Field>
          <Field label="Date of birth (optional)" htmlFor="dateOfBirth">
            <DatePicker
              id="dateOfBirth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              accent="gold"
            />
            {calculateAge(dateOfBirth) !== null && (
              <p className="text-xs text-[#9AA3B2]">Age: {calculateAge(dateOfBirth)}</p>
            )}
          </Field>
          <Field label="Gender (optional)" htmlFor="gender">
            <Dropdown
              id="gender"
              label="Gender"
              value={gender}
              options={[{ value: "", label: "Select" }, ...GENDERS]}
              onChange={setGender}
              accent="gold"
            />
          </Field>
          <Field label="Marital status (optional)" htmlFor="maritalStatus">
            <Dropdown
              id="maritalStatus"
              label="Marital status"
              value={maritalStatus}
              options={[{ value: "", label: "Select" }, ...MARITAL_STATUSES]}
              onChange={setMaritalStatus}
              accent="gold"
            />
          </Field>
          <Field label="Nationality (optional)" htmlFor="nationality">
            <input
              id="nationality"
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. Malaysian"
              className={inputClass}
            />
          </Field>
          <Field label="Email" htmlFor="accountEmail">
            <input
              id="accountEmail"
              type="email"
              value={accountEmail}
              disabled
              readOnly
              className={`${inputClass} cursor-not-allowed bg-[#F8FAFB] text-[#9AA3B2]`}
            />
          </Field>
          <PhoneInput
            id="phone"
            label="Phone (optional)"
            accent="gold"
            value={phone}
            onChange={setPhone}
          />
          <Field label="Driving license (optional)" htmlFor="drivingLicense">
            <Dropdown
              id="drivingLicense"
              label="Driving license"
              value={drivingLicense}
              options={[{ value: "", label: "Select" }, ...DRIVING_LICENSES]}
              onChange={setDrivingLicense}
              accent="gold"
            />
          </Field>
          <Field required label="Location" htmlFor="location">
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Petaling Jaya, Selangor"
              className={inputClass}
            />
          </Field>
          <Field required label="Target role" htmlFor="targetRole">
            <input
              id="targetRole"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Graphic Designer"
              className={inputClass}
            />
          </Field>
          <Field required label="Preferred industry" htmlFor="preferredIndustry">
            <Dropdown
              id="preferredIndustry"
              label="Preferred industry"
              value={preferredIndustry}
              options={[
                { value: "" as const, label: "Select" },
                ...INDUSTRIES.map((i) => ({ value: i, label: i })),
              ]}
              onChange={setPreferredIndustry}
              accent="gold"
              searchable
              searchPlaceholder="Search industries..."
            />
          </Field>
          <Field required label="Years of experience" htmlFor="yearsExperience">
            <input
              id="yearsExperience"
              type="number"
              min={0}
              step={1}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="e.g. 3"
              className={inputClass}
            />
          </Field>
          <div className={`col-span-full ${gradientFrameClass("gold")}`}>
            <div className="flex flex-col gap-[12px] rounded-[19px] bg-white p-[22px]">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-[#141B2E]">Skills</p>
              <button
                type="button"
                onClick={suggestSkills}
                disabled={suggestingSkills}
                className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                  suggestingSkills ? "ai-fill-pulse" : ""
                }`}
              >
                <SiriOrb className="h-[14px] w-[14px]" active={suggestingSkills} />
                {suggestingSkills
                  ? `Suggesting… ${(suggestSkillsElapsedMs / 1000).toFixed(1)}s`
                  : "Suggest skills for this role"}
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

            <Field required label="Professional Skills / Tools & Technologies" htmlFor="professionalSkillInput">
              <input
                id="professionalSkillInput"
                type="text"
                value={professionalSkillInput}
                onChange={(e) => setProfessionalSkillInput(e.target.value)}
                onKeyDown={handleProfessionalSkillKeyDown}
                onBlur={addProfessionalSkill}
                placeholder="e.g. Photoshop, Figma, SQL — press Enter"
                className={inputClass}
              />
              {professionalSkills.length > 0 && (
                <div className="mt-[10px] flex flex-wrap gap-[6px]">
                  {professionalSkills.map((skill) => (
                    <span
                      key={skill}
                      className="flex items-center gap-[6px] rounded-full bg-[#FFE9A6] py-[6px] pl-[12px] pr-[8px] text-xs text-[#141B2E]"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeProfessionalSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#141B2E]/60 hover:bg-black/[0.08] hover:text-[#141B2E]"
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
                      onClick={() => addSuggestedProfessionalSkill(skill)}
                      className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-gold-dark hover:text-brand-gold-dark"
                    >
                      <PlusIcon className="h-[8px] w-[8px]" />
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Soft Skills / Work Style" htmlFor="softSkillInput">
              <input
                id="softSkillInput"
                type="text"
                value={softSkillInput}
                onChange={(e) => setSoftSkillInput(e.target.value)}
                onKeyDown={handleSoftSkillKeyDown}
                onBlur={addSoftSkill}
                placeholder="e.g. Teamwork, Communication — press Enter"
                className={inputClass}
              />
              {softSkills.length > 0 && (
                <div className="mt-[10px] flex flex-wrap gap-[6px]">
                  {softSkills.map((skill) => (
                    <span
                      key={skill}
                      className="flex items-center gap-[6px] rounded-full bg-[#FFE9A6] py-[6px] pl-[12px] pr-[8px] text-xs text-[#141B2E]"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSoftSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[#141B2E]/60 hover:bg-black/[0.08] hover:text-[#141B2E]"
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
                      className="flex items-center gap-[4px] rounded-full border border-dashed border-black/[0.15] py-[6px] pl-[12px] pr-[10px] text-sm text-[#4B5468] hover:border-brand-gold-dark hover:text-brand-gold-dark"
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
          </fieldset>
          </div>
        </div>
      </div>

      <div className={gradientFrameClass("gold")}>
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">Work preferences</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Salary, availability, and how you like to work.
          </p>

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
          <fieldset disabled={mode === "edit" && !isEditing} className="contents">
          <Field required label="Employment type" htmlFor="employmentType">
            <Dropdown
              id="employmentType"
              label="Employment type"
              value={employmentType}
              options={EMPLOYMENT_TYPES.map(({ value, label }) => ({ value, label }))}
              onChange={setEmploymentType}
              accent="gold"
            />
          </Field>
          <Field required label="Min salary (RM)" htmlFor="expectedSalaryMin">
            <input
              id="expectedSalaryMin"
              type="number"
              min={0}
              step={1}
              value={expectedSalaryMin}
              onChange={(e) => setExpectedSalaryMin(e.target.value)}
              placeholder="e.g. 3000"
              className={inputClass}
            />
          </Field>
          <Field required label="Max salary (RM)" htmlFor="expectedSalaryMax">
            <input
              id="expectedSalaryMax"
              type="number"
              min={0}
              step={1}
              value={expectedSalaryMax}
              onChange={(e) => setExpectedSalaryMax(e.target.value)}
              placeholder="e.g. 4500"
              className={inputClass}
            />
          </Field>

          <Field required label="Work arrangement" htmlFor="workArrangement">
            <Dropdown
              id="workArrangement"
              label="Work arrangement"
              value={workArrangement}
              options={WORK_ARRANGEMENTS.map(({ value, label }) => ({ value, label }))}
              onChange={setWorkArrangement}
              accent="gold"
            />
          </Field>
          <Field required label="Work authorization" htmlFor="workAuthorization">
            <Dropdown
              id="workAuthorization"
              label="Work authorization"
              value={workAuthorization}
              options={WORK_AUTHORIZATIONS.map(({ value, label }) => ({ value, label }))}
              onChange={setWorkAuthorization}
              accent="gold"
            />
          </Field>
          <Field required label="Notice period" htmlFor="noticePeriod">
            <Dropdown
              id="noticePeriod"
              label="Notice period"
              value={noticePeriod}
              options={NOTICE_PERIODS.map(({ value, label }) => ({ value, label }))}
              onChange={setNoticePeriod}
              accent="gold"
            />
          </Field>
          </fieldset>
          </div>
        </div>
      </div>

      <div className={gradientFrameClass("gold")}>
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">Experience & background</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Add your work history, education, and languages.
          </p>

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
          <fieldset disabled={mode === "edit" && !isEditing} className="contents">
          <CategoryHeading label="About you" first />
          <Field label="Professional summary (optional)" htmlFor="bio" className="col-span-full">
            <RichTextEditor
              id="bio"
              value={bio}
              onChange={setBio}
              placeholder="A couple sentences about your experience and what you're looking for"
              disabled={mode === "edit" && !isEditing}
              accent="gold"
            />
          </Field>

          <Field label="LinkedIn (optional)" htmlFor="linkedinUrl">
            <input
              id="linkedinUrl"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className={inputClass}
            />
          </Field>
          <Field label="Portfolio link (optional)" htmlFor="portfolioUrl">
            <input
              id="portfolioUrl"
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
          <Field label="GitHub (optional)" htmlFor="githubUrl">
            <input
              id="githubUrl"
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/..."
              className={inputClass}
            />
          </Field>

          <div className="col-span-full mt-[6px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]">
            <SectionHeader
              label="Work experience (optional)"
              onAdd={() => setWorkExperiences((prev) => [...prev, newWorkExperience()])}
              addLabel="Add"
            />
            {workExperiences.map((entry) => (
              <div key={entry.id} className={entryCardClass}>
                <div className="flex items-start justify-between gap-[8px]">
                  <div className="grid flex-1 grid-cols-2 gap-[8px]">
                    <input
                      type="text"
                      value={entry.title}
                      onChange={(e) => updateWorkExperience(entry.id, { title: e.target.value })}
                      placeholder="Job title"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={entry.company}
                      onChange={(e) => updateWorkExperience(entry.id, { company: e.target.value })}
                      placeholder="Company"
                      className={inputClass}
                    />
                  </div>
                  <EntryRemoveButton onClick={() => removeWorkExperience(entry.id)} />
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  <MonthYearPicker
                    value={entry.startDate}
                    onChange={(value) => updateWorkExperience(entry.id, { startDate: value })}
                    accent="gold"
                  />
                  <MonthYearPicker
                    value={entry.endDate}
                    onChange={(value) => updateWorkExperience(entry.id, { endDate: value })}
                    disabled={entry.isCurrent}
                    accent="gold"
                  />
                </div>
                <label className="flex items-center gap-[8px] text-xs text-[#4B5468]">
                  <input
                    type="checkbox"
                    checked={entry.isCurrent}
                    onChange={(e) => updateWorkExperience(entry.id, { isCurrent: e.target.checked })}
                    className="h-[14px] w-[14px] accent-brand-gold-dark"
                  />
                  I currently work here
                </label>
                <RichTextEditor
                  value={entry.achievements}
                  onChange={(html) => updateWorkExperience(entry.id, { achievements: html })}
                  placeholder="Key achievements (optional)"
                  disabled={mode === "edit" && !isEditing}
                  accent="gold"
                />
              </div>
            ))}
          </div>

          <div className="col-span-full mt-[6px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]">
            <SectionHeader
              label="Education (optional)"
              onAdd={() => setEducation((prev) => [...prev, newEducation()])}
              addLabel="Add"
            />
            {education.map((entry) => (
              <div key={entry.id} className={entryCardClass}>
                <div className="flex items-start justify-between gap-[8px]">
                  <input
                    type="text"
                    value={entry.institution}
                    onChange={(e) => updateEducation(entry.id, { institution: e.target.value })}
                    placeholder="Institution"
                    className={inputClass}
                  />
                  <EntryRemoveButton onClick={() => removeEducation(entry.id)} />
                </div>
                <input
                  type="text"
                  value={entry.fieldOfStudy}
                  onChange={(e) => updateEducation(entry.id, { fieldOfStudy: e.target.value })}
                  placeholder="Field of study (optional)"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-[8px]">
                  <Dropdown
                    label="Qualification"
                    value={entry.qualificationTier}
                    options={QUALIFICATION_TIERS.map(({ value, label }) => ({ value, label }))}
                    onChange={(value) => updateEducation(entry.id, { qualificationTier: value })}
                    accent="gold"
                  />
                  <input
                    type="number"
                    value={entry.graduationYear}
                    onChange={(e) => updateEducation(entry.id, { graduationYear: e.target.value })}
                    placeholder="Grad. year"
                    className={inputClass}
                  />
                </div>
                <input
                  type="text"
                  value={entry.cgpa}
                  onChange={(e) => updateEducation(entry.id, { cgpa: e.target.value })}
                  placeholder="CGPA (optional, e.g. 3.75/4.00)"
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div className="col-span-full mt-[6px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]">
            <SectionHeader
              label="Certifications & licenses (optional)"
              onAdd={() => setCertifications((prev) => [...prev, newCertification()])}
              addLabel="Add"
            />
            {certifications.map((entry) => (
              <div key={entry.id} className={entryCardClass}>
                <div className="flex items-start justify-between gap-[8px]">
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateCertification(entry.id, { name: e.target.value })}
                    placeholder="Certification name"
                    className={inputClass}
                  />
                  <EntryRemoveButton onClick={() => removeCertification(entry.id)} />
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  <input
                    type="text"
                    value={entry.issuer}
                    onChange={(e) => updateCertification(entry.id, { issuer: e.target.value })}
                    placeholder="Issuer (optional)"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={entry.year}
                    onChange={(e) => updateCertification(entry.id, { year: e.target.value })}
                    placeholder="Year"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="col-span-full mt-[6px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]">
            <SectionHeader
              label="Languages (optional)"
              onAdd={() => setLanguages((prev) => [...prev, newLanguage()])}
              addLabel="Add"
            />
            {languages.map((entry) => (
              <div key={entry.id} className={entryCardClass}>
                <div className="flex items-start justify-between gap-[8px]">
                  <input
                    type="text"
                    value={entry.language}
                    onChange={(e) => updateLanguage(entry.id, { language: e.target.value })}
                    placeholder="Language"
                    className={inputClass}
                  />
                  <EntryRemoveButton onClick={() => removeLanguage(entry.id)} />
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  <Dropdown
                    label="Spoken level"
                    value={entry.spokenLevel}
                    options={LANGUAGE_LEVELS.map(({ value, label }) => ({ value, label }))}
                    onChange={(value) => updateLanguage(entry.id, { spokenLevel: value })}
                    accent="gold"
                  />
                  <Dropdown
                    label="Written level"
                    value={entry.writtenLevel}
                    options={LANGUAGE_LEVELS.map(({ value, label }) => ({ value, label }))}
                    onChange={(value) => updateLanguage(entry.id, { writtenLevel: value })}
                    accent="gold"
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            id="referencesSection"
            className="col-span-full mt-[6px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]"
          >
            <SectionHeader
              label="References (optional)"
              onAdd={() => setReferences((prev) => [...prev, newReference()])}
              addLabel="Add"
            />
            {references.map((entry) => (
              <div key={entry.id} className={entryCardClass}>
                <div className="flex items-start justify-between gap-[8px]">
                  <input
                    type="text"
                    value={entry.fullName}
                    onChange={(e) => updateReference(entry.id, { fullName: e.target.value })}
                    placeholder="Full name"
                    className={inputClass}
                  />
                  <EntryRemoveButton onClick={() => removeReference(entry.id)} />
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  <input
                    type="text"
                    value={entry.jobTitle}
                    onChange={(e) => updateReference(entry.id, { jobTitle: e.target.value })}
                    placeholder="Role (e.g. Former Manager)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={entry.company}
                    onChange={(e) => updateReference(entry.id, { company: e.target.value })}
                    placeholder="Company (optional)"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  <input
                    type="text"
                    value={entry.phone}
                    onChange={(e) => updateReference(entry.id, { phone: e.target.value })}
                    placeholder="Phone (optional)"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={entry.email}
                    onChange={(e) => updateReference(entry.id, { email: e.target.value })}
                    placeholder="Email (optional)"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
          </fieldset>

          {error && <p className="col-span-full text-xs text-red-500">{error}</p>}

          {mode === "edit" && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="col-span-full mt-[8px] flex h-[38px] w-full items-center justify-center rounded-full border border-brand-gold-dark text-sm text-brand-gold-dark transition-opacity hover:opacity-90"
            >
              Edit
            </button>
          ) : (
            <button
              type="button"
              disabled={!formValid || submitting}
              onClick={handleFinishClick}
              className="col-span-full mt-[8px] flex h-[38px] w-full items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Saving…" : saveLabel}
            </button>
          )}
          {savedAt && !error && <p className="col-span-full text-xs text-brand-gold-dark">Saved.</p>}
          </div>
        </div>
      </div>
      </div>

      <div
        className={`flex flex-col gap-[16px] lg:sticky ${
          // In edit mode this page sits inside JobseekerDashboardShell, which
          // has its own sticky navbar (~85px tall) pinned above — top-[22px]
          // would tuck this column underneath it. Onboarding has no such
          // navbar, so it can sit right under the page's own top padding.
          mode === "edit" ? "lg:top-[85px] lg:w-[300px] lg:shrink-0" : "lg:top-[22px] lg:flex-[1]"
        }`}
      >
        <div
          className={
            formValid
              ? gradientFrameClass("gold")
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

          <div className={gradientFrameClass("gold")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <p className="text-left text-lg font-semibold text-[#141B2E]">
              {boostChecklistRemaining > 0
                ? "Not compulsory, but these help you match better and stand out from the crowd:"
                : "Nice — your profile is fully boosted and ready to stand out."}
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
                        : "text-[#4B5468] hover:text-brand-gold-dark hover:underline"
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

      {showParseConfirm && (
        <Modal onClose={() => setShowParseConfirm(false)}>
          <>
            <h2 className="text-lg font-semibold text-[#141B2E]">You&rsquo;ve already filled some of this in</h2>
            <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
              Parsing this resume will replace the details you&rsquo;ve already entered — fields, skills,
              work experience, education, certifications, and languages — with whatever&rsquo;s on this
              resume. Anything this resume doesn&rsquo;t mention will be cleared. Continue?
            </p>
            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setShowParseConfirm(false);
                  parseResume(true);
                }}
                className="flex h-[38px] items-center justify-center rounded-full bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] text-sm text-white transition-opacity hover:opacity-90"
              >
                Overwrite with this resume
              </button>
              <button
                type="button"
                onClick={() => setShowParseConfirm(false)}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
              >
                Cancel
              </button>
            </div>
          </>
        </Modal>
      )}

      {showResumeWarning && (
        <Modal onClose={() => setShowResumeWarning(false)}>
          <>
            <h2 className="text-lg font-semibold text-[#141B2E]">One more thing — your resume!</h2>
            <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
              Employers really do judge a profile faster when there&rsquo;s a resume attached — it&rsquo;s
              often the first thing they look for. You can still finish without one, but adding yours
              (or letting JobGiga put one together for you) gives you a much better shot at getting
              noticed.
            </p>
            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setShowResumeWarning(false);
                  // Not wired up yet — just the entry point for now.
                }}
                className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90"
              >
                Generate my resume via JobGiga
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResumeWarning(false);
                  submitProfile();
                }}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
              >
                Skip for now
              </button>
            </div>
          </>
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
          <h2 className="text-lg font-semibold text-[#141B2E]">Leave without saving?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
            You&rsquo;ve made changes to your profile that haven&rsquo;t been saved yet. Save them before
            you go, or discard and leave.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={submitting || !formValid}
              onClick={saveAndLeave}
              className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={discardAndLeave}
              className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-red-500 hover:bg-red-50"
            >
              Discard changes
            </button>
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
    </div>
  );
}

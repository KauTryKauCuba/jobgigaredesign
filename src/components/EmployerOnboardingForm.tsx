"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Dropdown from "./Dropdown";
import { useDraftName } from "./DraftNameContext";
import Field from "./Field";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { CheckIcon, PencilIcon, PlusIcon, UserIcon, XIcon } from "./icons";
import InlineIllustration from "./InlineIllustration";
import Modal from "./Modal";
import PhoneInput from "./PhoneInput";
import RichTextEditor from "./RichTextEditor";
import SiriOrb from "./SiriOrb";
import { useRegisterUnsavedChangesGuard } from "./UnsavedChangesGuard";
import type { EmployerAddress, EmployerProfile } from "@/lib/employer-profile";
import { INDUSTRIES } from "@/lib/industries";
import { MALAYSIA_STATES } from "@/lib/malaysia";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
const COMPANY_TYPES = ["Startup", "SME", "MNC", "GLC", "Government"] as const;
const SUGGESTED_BENEFITS = [
  "Medical insurance",
  "Dental coverage",
  "Outpatient coverage",
  "Performance bonus",
  "Transport allowance",
  "Meal allowance",
  "Phone/internet allowance",
  "Flexible working hours",
  "Remote/hybrid work",
  "Extra annual leave",
  "Maternity/paternity leave",
  "Training & development",
  "Parking",
  "Life insurance",
  "Personal accident insurance",
  "Wellness/gym allowance",
  "Stock options (ESOS)",
  "Festive bonus",
  "Housing allowance",
  "Birthday leave",
  "Compassionate leave",
  "Marriage leave",
  "Study/education assistance",
  "Staff discount",
  "Team building/company trips",
] as const;
const CONTACT_ROLES = [
  "Founder / Owner",
  "Director / C-level",
  "HR Manager",
  "HR Executive",
  "Talent Acquisition / Recruiter",
  "Hiring Manager",
  "Admin / Office Manager",
  "Other",
] as const;

const CURRENT_YEAR = new Date().getFullYear();

// `key` is client-only (React list identity / draft round-tripping) — the
// server assigns its own row id on save, since the whole list is replaced
// wholesale rather than diffed (see /api/employer/profile).
type AddressEntry = {
  key: string;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: (typeof MALAYSIA_STATES)[number] | "";
  postcode: string;
};

function blankAddress(label = ""): AddressEntry {
  return {
    key: Math.random().toString(36).slice(2),
    label,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
  };
}

function addressFromSaved(address: EmployerAddress): AddressEntry {
  return {
    key: address.id,
    label: address.label,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    state: MALAYSIA_STATES.find((s) => s === address.state) ?? "",
    postcode: address.postcode,
  };
}

function isCompleteAddress(a: AddressEntry) {
  return (
    a.label.trim().length > 0 &&
    a.addressLine1.trim().length > 0 &&
    a.city.trim().length > 0 &&
    a.state.length > 0 &&
    /^\d{5}$/.test(a.postcode.trim())
  );
}

function isValidFoundedYear(value: string) {
  if (value.trim() === "") return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1800 && n <= CURRENT_YEAR;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidOptionalEmail(value: string) {
  return value.trim() === "" || isValidEmail(value);
}

const AVATAR_ACCEPT = "image/*";
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const LOGO_ACCEPT = "image/*";
const LOGO_MAX_BYTES = 3 * 1024 * 1024;

const cardClass = gradientFrameClass("teal");
const inputClass = formInputClass("teal");

type DraftData = {
  avatarUrl: string | null;
  contactName: string;
  contactRole: (typeof CONTACT_ROLES)[number] | "";
  contactPhone: string;
  contactEmail: string;
  companyName: string;
  ssmNumber: string;
  industry: string;
  industryCategory: (typeof INDUSTRIES)[number] | "";
  companySize: (typeof COMPANY_SIZES)[number];
  addresses: AddressEntry[];
  companyDescription: string;
  websiteUrl: string;
  companyEmail: string;
  companyPhone: string;
  companyLinkedin: string;
  companyFacebook: string;
  companyInstagram: string;
  foundedYear: string;
  companyType: (typeof COMPANY_TYPES)[number] | "";
  logoUrl: string | null;
  officePhotoUrl: string | null;
  recentNews: { title: string; url: string }[];
  benefits: string[];
  // Whether "Fill with AI" has actually completed for the current company
  // name — persisted explicitly rather than inferred from which other
  // fields happen to be non-empty, so resuming this draft later can restore
  // the exact same locked/"Edit"-button state a completed lookup leaves
  // behind, instead of falling back to the ambiguous "ran or just typed by
  // hand?" guess.
  hasConfirmedCompanyName: boolean;
};

export default function EmployerOnboardingForm({
  mode = "onboarding",
  initialProfile,
  initialAddresses,
  only,
  sidebarSlot,
}: {
  mode?: "onboarding" | "edit";
  initialProfile?: EmployerProfile;
  initialAddresses?: EmployerAddress[];
  only?: "contact" | "company";
  // Rendered next to "About you", splitting its flex-[3] evenly into
  // flex-[1.5]/flex-[1.5] — lets the My Profile page's AiUsageCard sit
  // beside the contact card instead of stacked in its own row below, while
  // keeping the required-fields checklist (flex-[1], rendered further down
  // unconditionally) the same width it has on the Company Profile page.
  sidebarSlot?: React.ReactNode;
} = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Existing profile fields load locked — the user has to hit "Edit" before
  // typing unlocks them. New (non-edit) profiles are never locked, since
  // there's nothing to protect yet.
  const [contactEditing, setContactEditing] = useState(mode !== "edit");
  const [companyEditing, setCompanyEditing] = useState(mode !== "edit");

  // Same "intercept sidebar navigation" pattern as Post a Job's unsaved-work
  // guard and the jobseeker profile form — unlocking "Edit" here without
  // saving prompts a confirm dialog instead of silently discarding edits.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
  function guardNavigation(proceed: () => void) {
    if (mode === "edit" && (contactEditing || companyEditing)) {
      setPendingProceed(() => proceed);
      setShowLeaveConfirm(true);
    } else {
      proceed();
    }
  }
  async function saveAndLeave() {
    setShowLeaveConfirm(false);
    const saved = await handleSubmit();
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
  // This form is rendered as `children` *inside* EmployerDashboardShell
  // (edit mode) — its sidebar sits above this component in the tree, so a
  // context Provider rendered here could never reach it. Registers into the
  // shell's own UnsavedChangesGuardBoundary instead (see that file for why).
  useRegisterUnsavedChangesGuard(guardNavigation);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile?.avatarUrl ?? null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [contactName, setContactName] = useState(initialProfile?.contactName ?? "");
  const draftContext = useDraftName();
  const setDraftName = draftContext?.setDraftName;
  useEffect(() => {
    setDraftName?.(contactName);
  }, [contactName, setDraftName]);
  const setDraftAvatarUrl = draftContext?.setDraftAvatarUrl;
  useEffect(() => {
    setDraftAvatarUrl?.(avatarUrl);
  }, [avatarUrl, setDraftAvatarUrl]);
  const [contactRole, setContactRole] = useState<(typeof CONTACT_ROLES)[number] | "">(
    (initialProfile?.contactRole as (typeof CONTACT_ROLES)[number] | undefined) ?? "",
  );
  const [contactPhone, setContactPhone] = useState(initialProfile?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initialProfile?.contactEmail ?? "");
  const [companyName, setCompanyName] = useState(initialProfile?.companyName ?? "");
  const [ssmNumber, setSsmNumber] = useState(initialProfile?.ssmNumber ?? "");
  const [industry, setIndustry] = useState(initialProfile?.industry ?? "");
  // Standardized alongside the free-text `industry` above (kept as-is) so it
  // can be compared 1:1 against jobseekerProfiles.preferredIndustry and
  // jobPostings.industry, which already use this same INDUSTRIES list.
  const [industryCategory, setIndustryCategory] = useState<(typeof INDUSTRIES)[number] | "">(
    INDUSTRIES.find((i) => i === initialProfile?.industryCategory) ?? "",
  );
  const [companySize, setCompanySize] = useState<(typeof COMPANY_SIZES)[number]>(
    (initialProfile?.companySize as (typeof COMPANY_SIZES)[number] | undefined) ?? "1-10",
  );
  const [addresses, setAddresses] = useState<AddressEntry[]>(
    initialAddresses?.length ? initialAddresses.map(addressFromSaved) : [blankAddress("Headquarters")],
  );

  function addAddress() {
    setAddresses((prev) => [...prev, blankAddress()]);
  }
  function removeAddress(key: string) {
    setAddresses((prev) => (prev.length > 1 ? prev.filter((a) => a.key !== key) : prev));
  }
  function updateAddress(key: string, patch: Partial<Omit<AddressEntry, "key">>) {
    setAddresses((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }
  const [companyDescription, setCompanyDescription] = useState(initialProfile?.companyDescription ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile?.websiteUrl ?? "");
  const [companyEmail, setCompanyEmail] = useState(initialProfile?.companyEmail ?? "");
  const [companyPhone, setCompanyPhone] = useState(initialProfile?.companyPhone ?? "");
  const [companyLinkedin, setCompanyLinkedin] = useState(initialProfile?.companyLinkedin ?? "");
  const [companyFacebook, setCompanyFacebook] = useState(initialProfile?.companyFacebook ?? "");
  const [companyInstagram, setCompanyInstagram] = useState(initialProfile?.companyInstagram ?? "");
  const [foundedYear, setFoundedYear] = useState(
    initialProfile?.foundedYear != null ? String(initialProfile.foundedYear) : "",
  );
  const [companyType, setCompanyType] = useState<(typeof COMPANY_TYPES)[number] | "">(
    (initialProfile?.companyType as (typeof COMPANY_TYPES)[number] | null | undefined) ?? "",
  );

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialProfile?.logoUrl ?? null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [officePhotoUrl, setOfficePhotoUrl] = useState<string | null>(initialProfile?.officePhotoUrl ?? null);
  const [recentNews, setRecentNews] = useState<{ title: string; url: string }[]>(
    initialProfile?.recentNews ?? [],
  );

  const [benefits, setBenefits] = useState<string[]>(initialProfile?.benefits ?? ["EPF", "SOCSO", "EIS"]);
  const [benefitInput, setBenefitInput] = useState("");

  // Editing an existing profile prefills every field from initialProfile
  // above and skips the draft fetch/autosave machinery below entirely —
  // that machinery exists only to survive a refresh *before* a profile
  // exists, which doesn't apply once one does.
  const showContact = !only || only === "contact";
  const showCompany = !only || only === "company";
  const bothShown = showContact && showCompany;
  const saveLabel = mode === "edit" ? "Save changes" : "Finish";

  useEffect(() => {
    if (!savedAt) return;
    const timeout = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(timeout);
  }, [savedAt]);

  const [aiLookupLoading, setAiLookupLoading] = useState(false);
  const [aiLookupElapsedMs, setAiLookupElapsedMs] = useState(0);
  const [aiLookupError, setAiLookupError] = useState<string | null>(null);
  const [aiLookupStatus, setAiLookupStatus] = useState<string | null>(null);
  const [aiLookupTokens, setAiLookupTokens] = useState<number | null>(null);
  const [aiLookupDurationMs, setAiLookupDurationMs] = useState<number | null>(null);

  const [draftLoaded, setDraftLoaded] = useState(mode === "edit");
  const draftSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiLookupRequestId = useRef(0);
  // Name this form last ran a lookup for — seeded with whatever company name
  // it already started with (edit mode's existing profile, or "" for a
  // brand-new onboarding) rather than always `null`, so a name change is
  // detected correctly even on the very first "Fill with AI" click. Getting
  // this wrong on the edit-mode page in particular meant: change the name,
  // click "Fill with AI" once — since it's the first click ever, the old
  // (unrelated) code treated it as "no baseline yet, don't clear," which
  // fell back to only filling empty fields — and an edit-mode profile
  // already has virtually everything filled in, so nothing visibly changed.
  // Updated again once a create-mode draft's own company name loads (below),
  // so the same first-click case is handled there too. Only a genuine name
  // change *relative to this baseline* clears the AI-fillable fields — see
  // handleAiLookup.
  const lastLookedUpCompanyName = useRef<string | null>(initialProfile?.companyName?.trim() || null);
  // Locked (read-only, with an "Edit" button) whenever the name field
  // already holds a confirmed value — an existing edit-mode profile, a
  // resumed draft, or the result of a completed "Fill with AI" — so a stray
  // keystroke can never silently diverge the name from what the rest of the
  // form describes. Explicitly unlocked via the "Edit" button; a completed
  // lookup (successful or not) locks it again. Renaming without AI is still
  // fully supported: click Edit, retype, then Save/Finish directly — the
  // other fields are untouched either way, since this only gates the input
  // itself, not what gets submitted.
  const [companyNameLocked, setCompanyNameLocked] = useState(Boolean(initialProfile?.companyName?.trim()));
  // Separate from `companyNameLocked` itself: the "Edit" button stays
  // visible in both the locked AND unlocked states once something has been
  // confirmed (so it's always there to toggle back), but on a genuinely
  // blank, first-ever entry — nothing typed yet, nothing to protect — there
  // is no confirmed value for it to edit, so it shouldn't show at all. Reset
  // clears this back to false along with everything else.
  const [hasConfirmedCompanyName, setHasConfirmedCompanyName] = useState(
    Boolean(initialProfile?.companyName?.trim()),
  );
  const companyNameInputRef = useRef<HTMLInputElement | null>(null);
  // Captured the moment "Edit" unlocks the field — what to snap back to if
  // the user clicks/tabs away without clicking "Save". null whenever the
  // field isn't mid-edit.
  const preEditCompanyNameRef = useRef<string | null>(null);

  // Loaded once on mount so a refresh — or logging back in on any device —
  // picks up where the user left off. Saved server-side (not localStorage)
  // since a draft tied only to the browser wouldn't survive logging in
  // elsewhere and could leak between different users on a shared browser.
  // Skipped entirely in edit mode — there's no draft to resume, the profile
  // already exists and its values were used to seed state above.
  useEffect(() => {
    if (mode === "edit") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employer/onboarding-draft");
        const data = await res.json();
        const draft = (res.ok ? data.draft : null) as Partial<DraftData> | null;
        if (draft && !cancelled) {
          if (draft.avatarUrl) setAvatarUrl(draft.avatarUrl);
          if (draft.contactName) setContactName(draft.contactName);
          if (draft.contactRole) setContactRole(draft.contactRole);
          if (draft.contactPhone) setContactPhone(draft.contactPhone);
          if (draft.contactEmail) setContactEmail(draft.contactEmail);
          if (draft.companyName) {
            setCompanyName(draft.companyName);
            // Same reasoning as the initialProfile seed above — the first
            // "Fill with AI" click after resuming this draft must compare
            // against the name it already had, not against `null`.
            lastLookedUpCompanyName.current = draft.companyName;
          }
          if (draft.ssmNumber) setSsmNumber(draft.ssmNumber);
          if (draft.industry) setIndustry(draft.industry);
          if (draft.industryCategory) {
            const matched = INDUSTRIES.find((i) => i === draft.industryCategory);
            if (matched) setIndustryCategory(matched);
          }
          if (draft.companySize) setCompanySize(draft.companySize);
          if (draft.addresses?.length) setAddresses(draft.addresses);
          if (draft.companyDescription) setCompanyDescription(draft.companyDescription);
          if (draft.websiteUrl) setWebsiteUrl(draft.websiteUrl);
          if (draft.companyEmail) setCompanyEmail(draft.companyEmail);
          if (draft.companyPhone) setCompanyPhone(draft.companyPhone);
          if (draft.companyLinkedin) setCompanyLinkedin(draft.companyLinkedin);
          if (draft.companyFacebook) setCompanyFacebook(draft.companyFacebook);
          if (draft.companyInstagram) setCompanyInstagram(draft.companyInstagram);
          if (draft.foundedYear) setFoundedYear(draft.foundedYear);
          if (draft.companyType) setCompanyType(draft.companyType);
          if (draft.logoUrl) setLogoUrl(draft.logoUrl);
          if (draft.officePhotoUrl) setOfficePhotoUrl(draft.officePhotoUrl);
          if (draft.recentNews?.length) setRecentNews(draft.recentNews);
          if (draft.benefits?.length) setBenefits(draft.benefits);
          // Restores the exact same locked/"Edit"-visible state a completed
          // "Fill with AI" leaves behind, rather than always resuming
          // unlocked with no "Edit" button regardless of whether AI had
          // already run before the user left.
          if (draft.hasConfirmedCompanyName) {
            setHasConfirmedCompanyName(true);
            setCompanyNameLocked(true);
          }
        }
        if (!cancelled && (!draft?.avatarUrl || !draft?.contactEmail)) {
          try {
            const meRes = await fetch("/api/auth/me");
            const me = await meRes.json();
            if (!cancelled && meRes.ok) {
              if (!draft?.avatarUrl && me.user?.avatarUrl) setAvatarUrl(me.user.avatarUrl);
              // Always the account's login email — the field is read-only
              // (same as the jobseeker side's account email), so this is the
              // only place it's ever set.
              if (!draft?.contactEmail && me.user?.email) setContactEmail(me.user.email);
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
        contactName,
        contactRole,
        contactPhone,
        contactEmail,
        companyName,
        ssmNumber,
        industry,
        industryCategory,
        companySize,
        addresses,
        companyDescription,
        websiteUrl,
        companyEmail,
        companyPhone,
        companyLinkedin,
        companyFacebook,
        companyInstagram,
        foundedYear,
        companyType,
        logoUrl,
        officePhotoUrl,
        recentNews,
        benefits,
        hasConfirmedCompanyName,
      };
      fetch("/api/employer/onboarding-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    };
  }, [
    mode,
    draftLoaded,
    avatarUrl,
    contactName,
    contactRole,
    contactPhone,
    contactEmail,
    companyName,
    ssmNumber,
    industry,
    industryCategory,
    companySize,
    addresses,
    companyDescription,
    websiteUrl,
    companyEmail,
    companyPhone,
    companyLinkedin,
    companyFacebook,
    companyInstagram,
    foundedYear,
    companyType,
    logoUrl,
    officePhotoUrl,
    recentNews,
    benefits,
    hasConfirmedCompanyName,
  ]);

  useEffect(() => {
    if (!aiLookupLoading) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setAiLookupElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [aiLookupLoading]);

  const formValid =
    contactName.trim().length > 0 &&
    contactRole.trim().length > 0 &&
    contactPhone.trim().length > 0 &&
    isValidEmail(contactEmail) &&
    companyName.trim().length > 0 &&
    ssmNumber.trim().length > 0 &&
    industry.trim().length > 0 &&
    industryCategory.length > 0 &&
    addresses.length > 0 &&
    addresses.every(isCompleteAddress) &&
    isValidFoundedYear(foundedYear) &&
    isValidOptionalEmail(companyEmail);

  // Tells the employer which required field(s) are blocking the disabled
  // Finish button — otherwise it just sits unclickable with no explanation.
  const contactRequiredChecklist = [
    { label: "Full name", done: contactName.trim().length > 0, fieldId: "contactName" },
    { label: "Your role", done: contactRole.trim().length > 0, fieldId: "contactRole" },
    { label: "Phone number", done: contactPhone.trim().length > 0, fieldId: "contactPhone" },
  ];
  const companyRequiredChecklist = [
    { label: "Company name", done: companyName.trim().length > 0, fieldId: "companyName" },
    { label: "SSM registration number", done: ssmNumber.trim().length > 0, fieldId: "ssmNumber" },
    { label: "Industry", done: industry.trim().length > 0, fieldId: "industry" },
    { label: "Industry category", done: industryCategory.length > 0, fieldId: "industryCategory" },
    {
      label: "Company address",
      done: addresses.length > 0 && addresses.every(isCompleteAddress),
      fieldId: addresses.find((a) => !isCompleteAddress(a))?.key ?? "addresses",
    },
  ];
  // Full onboarding shows one continuous list; the standalone My Profile /
  // Company Profile pages each only show the fields that live on that page.
  const requiredFieldChecklist = bothShown
    ? [...contactRequiredChecklist, ...companyRequiredChecklist]
    : showCompany
      ? companyRequiredChecklist
      : contactRequiredChecklist;

  // Not required to submit, but each one makes the company profile more
  // convincing to candidates — friendly nudges, not blockers, so this never
  // touches formValid.
  const boostChecklist = [
    {
      label: "Add a company logo — postings with a logo get more clicks.",
      done: Boolean(logoUrl),
      fieldId: "logoUploadButton",
    },
    {
      label: "Write a company description — tell candidates what it's like to work there.",
      done: companyDescription.trim().length > 0,
      fieldId: "companyDescription",
    },
    {
      label: "Add your website — gives candidates somewhere to learn more.",
      done: websiteUrl.trim().length > 0,
      fieldId: "websiteUrl",
    },
    {
      label: "Add a company email — an extra way for candidates to reach you.",
      done: companyEmail.trim().length > 0,
      fieldId: "companyEmail",
    },
    {
      label: "Add a company phone number — for candidates who prefer to call.",
      done: companyPhone.trim().length > 0,
      fieldId: "companyPhone",
    },
    {
      label: "Link your LinkedIn — let candidates verify you're a real company.",
      done: companyLinkedin.trim().length > 0,
      fieldId: "companyLinkedin",
    },
    {
      label: "Add your founded year — builds a bit more trust and context.",
      done: foundedYear.trim().length > 0,
      fieldId: "foundedYear",
    },
    {
      label: "Pick a company type — helps candidates know what to expect.",
      done: companyType.trim().length > 0,
      fieldId: "companyType",
    },
  ];
  const boostChecklistRemaining = boostChecklist.filter((item) => !item.done).length;
  const requiredChecklistComplete = requiredFieldChecklist.every((item) => item.done);

  function goToField(fieldId: string) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
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
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setAvatarError("Couldn't read that image.");
    reader.readAsDataURL(picked);
  }

  function clearAvatar() {
    setAvatarUrl(null);
    setAvatarError(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  function handleLogoFile(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    if (!picked.type.startsWith("image/")) {
      setLogoError("Choose an image file.");
      return;
    }
    if (picked.size > LOGO_MAX_BYTES) {
      setLogoError("Image is too large — max 3 MB.");
      return;
    }

    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setLogoError("Couldn't read that image.");
    reader.readAsDataURL(picked);
  }

  function clearLogo() {
    setLogoUrl(null);
    setLogoError(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handleAiLookup() {
    if (!companyName.trim()) return;
    // Belt-and-suspenders with the button's own `disabled` prop below —
    // refuses to run regardless of how this got called (stale bundle,
    // timing quirk, or any other path around the disabled button):
    // - mid-edit (unlocked, not yet saved): must "Save" first.
    // - nothing to look up: the name matches what was already looked up.
    if (hasConfirmedCompanyName && !companyNameLocked) return;
    if (companyName.trim() === lastLookedUpCompanyName.current) return;
    const targetCompanyName = companyName;
    // A genuinely different company from the last lookup — clear whatever
    // the previous company's "Fill with AI" (or edit-mode profile) left in
    // these fields before firing the new one, so its stale data doesn't sit
    // mixed in with the new company's results. Skipped on the very first
    // lookup ever (ref starts null) so opening this form with an existing
    // draft/profile and clicking "Fill with AI" for that same name doesn't
    // wipe data that was already there.
    const isFreshCompany =
      lastLookedUpCompanyName.current !== null && lastLookedUpCompanyName.current !== targetCompanyName;
    if (isFreshCompany) clearAiFilledFields();
    lastLookedUpCompanyName.current = targetCompanyName;
    const requestId = ++aiLookupRequestId.current;
    setAiLookupLoading(true);
    setAiLookupError(null);
    setAiLookupStatus(null);
    setAiLookupTokens(null);
    setAiLookupDurationMs(null);
    setAiLookupElapsedMs(0);
    try {
      // Flat delay before firing anything. The requestId checks below are
      // currently dead in practice — the company-name field and this button
      // are both disabled while aiLookupLoading is true, so nothing can
      // trigger a second handleAiLookup call while one is in flight — but
      // kept as a defensive guard in case that invariant ever changes; the
      // elapsed-time counter above keeps ticking through the delay either
      // way, so it still reads as "working."
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (requestId !== aiLookupRequestId.current) return;
      const res = await fetch("/api/employer/lookup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: targetCompanyName }),
      });
      // Belt-and-suspenders with the above — see that comment.
      // while this request was in flight — a stale response must never
      // apply, since it would silently attach data for the wrong company.
      if (requestId !== aiLookupRequestId.current) return;
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Couldn't look that company up.");
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't look that company up.");
      const result = data.result as {
        companyDescription: string | null;
        industry: string | null;
        addressLine1: string | null;
        city: string | null;
        state: (typeof MALAYSIA_STATES)[number] | null;
        postcode: string | null;
        companySize: (typeof COMPANY_SIZES)[number] | null;
        websiteUrl: string | null;
        companyEmail: string | null;
        companyPhone: string | null;
        companyLinkedin: string | null;
        companyFacebook: string | null;
        companyInstagram: string | null;
        foundedYear: number | null;
        companyType: (typeof COMPANY_TYPES)[number] | null;
        ssmNumber: string | null;
        benefits: string[];
        logoUrl: string | null;
        recentNews: { title: string; url: string }[];
      };
      // The AI lookup's free-text industry guess also drives industryCategory
      // when it happens to land on one of the standardized INDUSTRIES values
      // verbatim — same "never write a value the Dropdown can't render" rule
      // as the draft-restore and initialProfile seeding above.
      const matchedIndustry = INDUSTRIES.find((i) => i === result.industry);

      // Counted against this render's own state snapshot, not inside the
      // setState updaters below — React doesn't run functional updaters
      // synchronously here (this is well after the initial await, so none
      // of the eager-update fast paths apply), so a mark() called from
      // inside an updater wouldn't have run yet by the time `filled` is
      // read for the status message a few lines down. A snapshot read can
      // theoretically be one edit stale if the user types into a field in
      // the instant between this line and the updater actually applying,
      // but that's a harmless one-word miscount on a status message, not a
      // correctness issue — the updaters themselves still decide what
      // actually gets written to state.
      //
      // `isFreshCompany` overrides every "already filled" check to "was
      // empty" — this snapshot was captured before this same function's own
      // clearAiFilledFields() call above ran, so it still shows the
      // *previous* company's leftover values, which would otherwise make a
      // fresh company's fill look like it filled nothing.
      let filled = 0;
      if (result.companyDescription && (isFreshCompany || !companyDescription.trim())) filled++;
      if (result.industry && (isFreshCompany || !industry.trim())) filled++;
      if (result.addressLine1 && (isFreshCompany || !addresses[0]?.addressLine1.trim())) filled++;
      if (result.city && (isFreshCompany || !addresses[0]?.city.trim())) filled++;
      if (result.state && (isFreshCompany || !addresses[0]?.state)) filled++;
      if (result.postcode && (isFreshCompany || !addresses[0]?.postcode.trim())) filled++;
      if (result.companySize) filled++;
      if (result.websiteUrl && (isFreshCompany || !websiteUrl.trim())) filled++;
      if (result.companyEmail && (isFreshCompany || !companyEmail.trim())) filled++;
      if (result.companyPhone && (isFreshCompany || !companyPhone.trim())) filled++;
      if (result.companyLinkedin && (isFreshCompany || !companyLinkedin.trim())) filled++;
      if (result.companyFacebook && (isFreshCompany || !companyFacebook.trim())) filled++;
      if (result.companyInstagram && (isFreshCompany || !companyInstagram.trim())) filled++;
      if (result.foundedYear && (isFreshCompany || !foundedYear.trim())) filled++;
      if (result.companyType && (isFreshCompany || !companyType.trim())) filled++;
      if (result.ssmNumber && (isFreshCompany || !ssmNumber.trim())) filled++;
      if (result.benefits.some((b) => isFreshCompany || !benefits.includes(b))) filled++;
      if (result.logoUrl && (isFreshCompany || !logoUrl)) filled++;
      if (result.recentNews.some((item) => isFreshCompany || !recentNews.some((r) => r.url === item.url)))
        filled++;

      // Only fills fields the user hasn't already entered by hand — an AI
      // guess should never clobber a manual correction. Uses functional
      // setState so it reads the latest value, not the (possibly stale)
      // value from when the lookup started.
      if (result.companyDescription) {
        setCompanyDescription((prev) => (prev.trim() ? prev : (result.companyDescription as string)));
      }
      if (result.industry) {
        setIndustry((prev) => (prev.trim() ? prev : (result.industry as string)));
      }
      if (matchedIndustry) {
        setIndustryCategory((prev) => (prev ? prev : matchedIndustry));
      }
      if (result.addressLine1 || result.city || result.state || result.postcode) {
        setAddresses((prev) =>
          prev.map((a, i) =>
            i === 0
              ? {
                  ...a,
                  addressLine1:
                    result.addressLine1 && !a.addressLine1.trim() ? result.addressLine1 : a.addressLine1,
                  city: result.city && !a.city.trim() ? result.city : a.city,
                  state: result.state && !a.state ? result.state : a.state,
                  postcode: result.postcode && !a.postcode.trim() ? result.postcode : a.postcode,
                }
              : a,
          ),
        );
      }
      if (result.companySize) {
        setCompanySize(result.companySize);
      }
      if (result.websiteUrl) {
        setWebsiteUrl((prev) => (prev.trim() ? prev : (result.websiteUrl as string)));
      }
      if (result.companyEmail) {
        setCompanyEmail((prev) => (prev.trim() ? prev : (result.companyEmail as string)));
      }
      if (result.companyPhone) {
        setCompanyPhone((prev) => (prev.trim() ? prev : (result.companyPhone as string)));
      }
      if (result.companyLinkedin) {
        setCompanyLinkedin((prev) => (prev.trim() ? prev : (result.companyLinkedin as string)));
      }
      if (result.companyFacebook) {
        setCompanyFacebook((prev) => (prev.trim() ? prev : (result.companyFacebook as string)));
      }
      if (result.companyInstagram) {
        setCompanyInstagram((prev) => (prev.trim() ? prev : (result.companyInstagram as string)));
      }
      if (result.foundedYear) {
        setFoundedYear((prev) => (prev.trim() ? prev : String(result.foundedYear)));
      }
      if (result.companyType) {
        // Unlike the other AI-fillable fields, this one is a select with no
        // empty state to check other than the "" placeholder option, so the
        // same guard still applies cleanly here.
        setCompanyType((prev) => (prev.trim() ? prev : (result.companyType as (typeof COMPANY_TYPES)[number])));
      }
      if (result.ssmNumber) {
        setSsmNumber((prev) => (prev.trim() ? prev : (result.ssmNumber as string)));
      }
      if (result.benefits.length > 0) {
        setBenefits((prev) => {
          const additions = result.benefits.filter((b) => !prev.includes(b));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }
      if (result.logoUrl) {
        setLogoUrl((prev) => prev ?? result.logoUrl);
      }
      if (result.recentNews.length > 0) {
        setRecentNews((prev) => {
          const existingUrls = new Set(prev.map((item) => item.url));
          const additions = result.recentNews.filter((item) => !existingUrls.has(item.url));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
      }

      setAiLookupTokens(typeof data.usage?.total_tokens === "number" ? data.usage.total_tokens : null);
      setAiLookupDurationMs(typeof data.durationMs === "number" ? data.durationMs : null);
      setAiLookupStatus(
        filled > 0
          ? "Filled from public web sources — unverified, please check before continuing."
          : "Couldn't find enough public info on this company — fill in the fields manually.",
      );
      // Locks the name field again now that it has a confirmed lookup behind
      // it — including a "couldn't find enough info" result, since the name
      // itself is still settled either way.
      setCompanyNameLocked(true);
      setHasConfirmedCompanyName(true);
      preEditCompanyNameRef.current = null;
    } catch (err) {
      if (requestId !== aiLookupRequestId.current) return;
      setAiLookupError(err instanceof Error ? err.message : "Couldn't look that company up.");
    } finally {
      if (requestId === aiLookupRequestId.current) setAiLookupLoading(false);
    }
  }

  // Clears every field "Fill with AI" can populate, back to blank/default —
  // shared by the manual "Reset" button (which also clears the company name
  // itself) and by handleAiLookup's own auto-clear when the name changes to
  // a genuinely different company between two lookups (which keeps it).
  function clearAiFilledFields() {
    setCompanyDescription("");
    setIndustry("");
    setIndustryCategory("");
    setAddresses((prev) =>
      prev.map((a, i) => (i === 0 ? { ...a, addressLine1: "", city: "", state: "", postcode: "" } : a)),
    );
    setCompanySize("1-10");
    setWebsiteUrl("");
    setCompanyEmail("");
    setCompanyPhone("");
    setCompanyLinkedin("");
    setCompanyFacebook("");
    setCompanyInstagram("");
    setFoundedYear("");
    setCompanyType("");
    setSsmNumber("");
    setBenefits(["EPF", "SOCSO", "EIS"]);
    setLogoUrl(null);
    setOfficePhotoUrl(null);
    setRecentNews([]);
    setAiLookupStatus(null);
    setAiLookupError(null);
    setAiLookupTokens(null);
    setAiLookupDurationMs(null);
    setAiLookupElapsedMs(0);
  }

  // Not an undo to a prior state, a full reset so the employer can start
  // over from a clean slate, including re-typing the company name itself.
  function resetAiFields() {
    setCompanyName("");
    lastLookedUpCompanyName.current = null;
    preEditCompanyNameRef.current = null;
    setCompanyNameLocked(false);
    setHasConfirmedCompanyName(false);
    clearAiFilledFields();
  }

  function updateNewsItem(index: number, patch: Partial<{ title: string; url: string }>) {
    setRecentNews((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addBenefitValue(value: string) {
    if (!value || benefits.includes(value)) return;
    setBenefits((prev) => [...prev, value]);
  }

  function addBenefit() {
    addBenefitValue(benefitInput.trim());
    setBenefitInput("");
  }

  function removeBenefit(benefit: string) {
    setBenefits((prev) => prev.filter((b) => b !== benefit));
  }

  function handleBenefitKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addBenefit();
    }
  }

  async function handleSubmit(opts: { keepalive?: boolean } = {}): Promise<boolean> {
    setError(null);
    setSavedAt(null);

    // Warn about (rather than silently drop) any "+ Add" card left with only
    // a headline or only a URL typed in — the other kind of incomplete entry
    // (both fields blank) is left out of this check since an unused blank
    // card the user never touched isn't something to warn about.
    const incompleteNews = recentNews.some(
      (item) => (item.title.trim() || item.url.trim()) && !(item.title.trim() && item.url.trim()),
    );
    if (incompleteNews) {
      setError("Finish or remove the incomplete news entry (needs both a headline and a URL).");
      return false;
    }

    setSubmitting(true);
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    try {
      const res = await fetch("/api/employer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: opts.keepalive,
        body: JSON.stringify({
          avatarUrl,
          contactName,
          contactRole,
          contactPhone,
          contactEmail,
          companyName,
          ssmNumber,
          industry,
          industryCategory: industryCategory || null,
          companySize,
          addresses: addresses.map((a) => ({
            label: a.label.trim(),
            addressLine1: a.addressLine1.trim(),
            addressLine2: a.addressLine2.trim() || null,
            city: a.city.trim(),
            state: a.state || null,
            postcode: a.postcode.trim(),
          })),
          companyDescription: companyDescription.trim() || null,
          logoUrl,
          benefits,
          websiteUrl: websiteUrl.trim() || null,
          companyEmail: companyEmail.trim() || null,
          companyPhone: companyPhone.trim() || null,
          companyLinkedin: companyLinkedin.trim() || null,
          companyFacebook: companyFacebook.trim() || null,
          companyInstagram: companyInstagram.trim() || null,
          foundedYear: foundedYear.trim() ? Number(foundedYear) : null,
          companyType: companyType || null,
          officePhotoUrl,
          recentNews: recentNews.filter((item) => item.title.trim() && item.url.trim()),
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Couldn't save your company profile.");
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your company profile.");
      if (mode === "edit") {
        setSavedAt(Date.now());
        setContactEditing(false);
        setCompanyEditing(false);
        router.refresh();
      } else {
        router.push("/employer/dashboard");
        router.refresh();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your company profile.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (!draftLoaded) {
    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-[20px] lg:flex-row lg:items-start">
        <div className={`${cardClass} lg:flex-[1]`}>
          <div className="h-[280px] animate-pulse rounded-[19px] bg-white" />
        </div>
        <div className="flex min-w-0 flex-col gap-[20px] lg:flex-[2]">
          <div className={cardClass}>
            <div className="h-[420px] animate-pulse rounded-[19px] bg-white" />
          </div>
          <div className={cardClass}>
            <div className="h-[280px] animate-pulse rounded-[19px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px] lg:flex-row lg:items-start"
    >
      {showContact && (
      // sidebarSlot wraps together with the card into one flex-[3] item
      // (matching the outer row's shape on the Company Profile page — one
      // flex-[3] card + the flex-[1] checklist further down) rather than
      // becoming a third top-level flex item. A third item would add a
      // second 20px gap to the row, which — since flex-[N] divides
      // *remaining* space after gaps — would shrink the checklist to a
      // slightly different width than it has on Company Profile even at
      // matching flex-grow ratios.
      //
      // Without sidebarSlot (onboarding, Company Profile page), this
      // wrapper collapses via `lg:contents` instead of staying a normal
      // flex item — display:contents removes it from the box model, so the
      // card becomes a direct child of the outer row below, same as the
      // checklist. Without that, the wrapper's height exactly equals the
      // card's (its only child), leaving position:sticky zero room to move
      // within its own containing block — it never visibly sticks, even
      // though the class is applied.
      <div
        className={`flex min-w-0 flex-col gap-[20px] lg:flex-row lg:items-start ${
          sidebarSlot ? (bothShown ? "lg:flex-[1]" : "lg:flex-[3]") : "lg:contents"
        }`}
      >
      <div
        className={`${cardClass} min-w-0 lg:sticky ${mode === "edit" ? "lg:top-[85px]" : "lg:top-[22px]"} ${
          sidebarSlot ? "lg:flex-1" : bothShown ? "lg:flex-[1]" : "lg:flex-[3]"
        }`}
      >
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">About you</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Tell us who&rsquo;s registering this company.
          </p>

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
            <fieldset disabled={mode === "edit" && !contactEditing} className="contents">
            <div className="col-span-full flex items-center gap-[14px]">
              <input
                ref={avatarInputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files)}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label={avatarUrl ? "Change profile photo" : "Upload profile photo"}
                className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.1] bg-[#F1F4F8] text-[#9AA3B2] hover:border-brand-teal-dark"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
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
            <Field required label="Full name" htmlFor="contactName" className="col-span-full">
              <input
                id="contactName"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Ahmad Zaki"
                className={inputClass}
              />
            </Field>
            <Field required label="Your role" htmlFor="contactRole" className="col-span-full">
              <Dropdown
                id="contactRole"
                label="Your role"
                value={contactRole}
                options={[
                  { value: "" as const, label: "Select your role" },
                  ...CONTACT_ROLES.map((r) => ({ value: r, label: r })),
                ]}
                onChange={(value) => setContactRole(value as (typeof CONTACT_ROLES)[number] | "")}
              />
            </Field>
            <PhoneInput
              required
              id="contactPhone"
              label="Phone number"
              accent="teal"
              className="col-span-full"
              value={contactPhone}
              onChange={setContactPhone}
            />
            <Field label="Email address" htmlFor="contactEmail" className="col-span-full">
              <input
                id="contactEmail"
                type="email"
                value={contactEmail}
                disabled
                readOnly
                className={`${inputClass} cursor-not-allowed bg-[#F8FAFB] text-[#9AA3B2]`}
              />
            </Field>
            </fieldset>

            {!showCompany && (
              <div className="col-span-full mt-[8px] flex flex-col gap-[8px]">
                {error && <p className="text-xs text-red-500">{error}</p>}
                {mode === "edit" && !contactEditing ? (
                  <button
                    type="button"
                    onClick={() => setContactEditing(true)}
                    className="flex h-[38px] w-full items-center justify-center rounded-full border border-brand-teal-dark text-sm text-brand-teal-dark transition-opacity hover:opacity-90"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!formValid || submitting}
                    onClick={() => handleSubmit()}
                    className="flex h-[38px] w-full items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "Saving…" : saveLabel}
                  </button>
                )}
                {savedAt && !error && <p className="text-xs text-[#008990]">Saved.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      {sidebarSlot && <div className="min-w-0 lg:flex-1">{sidebarSlot}</div>}
      </div>
      )}

      {showCompany && (
      <div className={`flex min-w-0 flex-col gap-[20px] ${bothShown ? "lg:flex-[2]" : "lg:flex-[3]"}`}>
      <div className={cardClass}>
        <div className="relative overflow-hidden rounded-[19px] bg-white p-[22px] text-left">
          <InlineIllustration
            src="/illustrations/company-name-web-search.svg"
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto [&>svg]:h-full [&>svg]:w-auto sm:block"
          />

          <h1 className="relative text-xl font-semibold text-[#141B2E] sm:max-w-[calc(100%-220px)]">Company name</h1>
          <p className="relative mt-[6px] text-sm leading-[20px] text-[#4B5468] sm:max-w-[calc(100%-220px)]">
            We&rsquo;ll use this to search public sources and help fill out the rest of your profile.
          </p>

          <div className="relative mt-[16px] sm:max-w-[calc(100%-220px)]">
            <Field required label="Company name" htmlFor="companyName">
              <div className="flex gap-[8px]">
                <input
                  ref={companyNameInputRef}
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    // Editing the name invalidates any lookup already in
                    // flight for the old name — its response, when it
                    // arrives, must not apply to what's now a different company.
                    aiLookupRequestId.current++;
                    setCompanyName(e.target.value);
                  }}
                  onBlur={() => {
                    // Clicking/tabbing away mid-edit without hitting "Save"
                    // discards the change — reverts to whatever the field
                    // held before this "Edit" click, then re-locks. Gated on
                    // `hasConfirmedCompanyName` specifically (not just "is
                    // there a lookup baseline"), matching exactly what makes
                    // the "Edit" button itself appear — otherwise a resumed
                    // draft that has a name but was never actually confirmed
                    // via a completed lookup (lastLookedUpCompanyName gets
                    // set on restore either way, for isFreshCompany's own
                    // comparison) could lock on blur with no "Edit" button
                    // visible yet to undo it.
                    //
                    // Also skipped while `aiLookupLoading`: clicking "Fill
                    // with AI" mid-rename sets that flag synchronously,
                    // before the lookup itself resolves — which disables this
                    // input (it's `companyNameLocked || aiLookupLoading`) and
                    // the browser force-blurs a focused element the instant
                    // it's disabled, well before `companyNameLocked` itself
                    // ever flips true. Without this, that blur fired the
                    // revert mid-flight — discarding the just-typed name back
                    // to the old one while the lookup underneath kept running
                    // against the (already-captured) new name regardless,
                    // leaving the field showing the old name next to results
                    // that describe the new one.
                    if (!companyNameLocked && !aiLookupLoading && hasConfirmedCompanyName) {
                      if (preEditCompanyNameRef.current !== null) {
                        setCompanyName(preEditCompanyNameRef.current);
                      }
                      preEditCompanyNameRef.current = null;
                      setCompanyNameLocked(true);
                    }
                  }}
                  disabled={companyNameLocked || aiLookupLoading}
                  placeholder="e.g. Maju Jaya Sdn Bhd"
                  className={`${inputClass} min-w-0 flex-1 disabled:bg-[#F8FAFB] disabled:text-[#4B5468]`}
                />
                {hasConfirmedCompanyName &&
                  (companyNameLocked ? (
                    <button
                      type="button"
                      // Clicking this while the (still-focused) input is what
                      // it's about to unlock would otherwise blur it first —
                      // which the input's own onBlur reacts to by reverting
                      // and re-locking — before this onClick even runs.
                      // Suppressing the default mousedown behavior stops that
                      // blur from firing at all, same pattern RichTextEditor's
                      // own toolbar buttons use to protect their
                      // contentEditable's selection from the same kind of
                      // blur-stealing.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        preEditCompanyNameRef.current = companyName;
                        setCompanyNameLocked(false);
                        // Deferred a tick — the input is still `disabled` in
                        // this same render, so focusing it now would no-op.
                        requestAnimationFrame(() => companyNameInputRef.current?.focus());
                      }}
                      aria-label="Edit company name"
                      className="flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[#F1F4F8] px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.08]"
                    >
                      <PencilIcon className="h-[13px] w-[13px]" />
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      // Same blur-suppression as "Edit" above — otherwise
                      // clicking "Save" blurs the input first, which reverts
                      // the just-typed name before this onClick ever commits it.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        // If this edit session didn't actually change
                        // anything (retyped the same name back), there's
                        // nothing new for "Fill with AI" to fetch — treat it
                        // the same as an actual completed lookup for this
                        // name, so the button correctly stays disabled
                        // instead of offering a pointless re-fetch. A
                        // genuine rename leaves `lastLookedUpCompanyName` as
                        // whatever the last real lookup was, which is what
                        // keeps "Fill with AI" enabled afterward.
                        if (preEditCompanyNameRef.current === companyName) {
                          lastLookedUpCompanyName.current = companyName;
                        }
                        preEditCompanyNameRef.current = null;
                        setCompanyNameLocked(true);
                      }}
                      aria-label="Save company name"
                      className="flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-brand-teal-dark px-[14px] text-sm text-white hover:opacity-90"
                    >
                      <CheckIcon className="h-[13px] w-[13px]" />
                      Save
                    </button>
                  ))}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAiLookup}
                  // Enabled precisely when there's a name to look up that
                  // isn't the one already looked up:
                  // - Disabled while mid-edit (unlocked, not yet saved) once
                  //   there's a confirmed name to protect — "Save" the
                  //   rename first, rather than having two different ways to
                  //   commit an in-progress edit. Not gated on
                  //   `companyNameLocked` alone though: a brand-new
                  //   onboarding's very first entry starts unlocked with
                  //   nothing confirmed yet, and must still run its first
                  //   lookup directly.
                  // - Disabled once locked/idle if the name still matches
                  //   `lastLookedUpCompanyName` — nothing changed since the
                  //   last lookup, so there's nothing new to fetch. A
                  //   genuinely different (or first-ever) name re-enables it.
                  disabled={
                    !companyName.trim() ||
                    aiLookupLoading ||
                    (hasConfirmedCompanyName && !companyNameLocked) ||
                    companyName.trim() === lastLookedUpCompanyName.current
                  }
                  className={`flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[14px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                    aiLookupLoading ? "ai-fill-pulse" : ""
                  }`}
                >
                  <SiriOrb className="h-[14px] w-[14px]" active={aiLookupLoading} />
                  {aiLookupLoading ? `Looking up… ${(aiLookupElapsedMs / 1000).toFixed(1)}s` : "Fill with AI"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={resetAiFields}
                  disabled={aiLookupLoading}
                  aria-label="Clear AI-filled details"
                  className="h-[38px] shrink-0 whitespace-nowrap rounded-[12px] bg-[#F1F4F8] px-[14px] text-sm text-[#4B5468] hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
              {(aiLookupStatus || aiLookupError) && (
                <p className={`mt-[6px] text-xs ${aiLookupError ? "text-red-500" : "text-[#008990]"}`}>
                  {aiLookupError ??
                    `${aiLookupStatus}${
                      aiLookupTokens || aiLookupDurationMs
                        ? ` (${[
                            aiLookupTokens ? `${aiLookupTokens} tokens` : null,
                            aiLookupDurationMs ? `${(aiLookupDurationMs / 1000).toFixed(1)}s` : null,
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
      </div>

      <div className={cardClass}>
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">Company profile</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Your logo and a short description shown on your postings.
          </p>

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
            <fieldset disabled={mode === "edit" && !companyEditing} className="contents">
            <div className="col-span-full flex items-center gap-[14px]">
              <input
                ref={logoInputRef}
                type="file"
                accept={LOGO_ACCEPT}
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files)}
              />
              <button
                id="logoUploadButton"
                type="button"
                onClick={() => logoInputRef.current?.click()}
                aria-label={logoUrl ? "Change company logo" : "Upload company logo"}
                className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-black/[0.1] bg-[#F1F4F8] text-[#9AA3B2] hover:border-brand-teal-dark"
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-[26px] w-[26px]" />
                )}
              </button>
              <div className="flex flex-col gap-[4px]">
                <div className="flex items-center gap-[10px]">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-sm text-[#141B2E] hover:bg-black/[0.08]"
                  >
                    {logoUrl ? "Change logo" : "Upload logo"}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="text-sm text-[#9AA3B2] hover:text-[#141B2E]"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className={`text-xs ${logoError ? "text-red-500" : "text-[#9AA3B2]"}`}>
                  {logoError ?? "JPG or PNG · up to 3 MB"}
                </p>
              </div>
            </div>
            <Field label="Company description (optional)" htmlFor="companyDescription" className="col-span-full">
              <RichTextEditor
                id="companyDescription"
                value={companyDescription}
                onChange={setCompanyDescription}
                placeholder="What your company does, and what it's like to work there"
                disabled={mode === "edit" && !companyEditing}
              />
            </Field>

            <Field label="Website (optional)" htmlFor="websiteUrl">
              <input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </Field>
            <Field label="Company email (optional)" htmlFor="companyEmail">
              <input
                id="companyEmail"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="e.g. info@company.com"
                className={inputClass}
              />
              {!isValidOptionalEmail(companyEmail) && (
                <p className="mt-[4px] text-xs text-red-500">Enter a valid email address.</p>
              )}
            </Field>
            <Field label="Company phone (optional)" htmlFor="companyPhone">
              <input
                id="companyPhone"
                type="tel"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="e.g. 03-1234 5678"
                className={inputClass}
              />
            </Field>
            <Field label="LinkedIn (optional)" htmlFor="companyLinkedin">
              <input
                id="companyLinkedin"
                type="url"
                value={companyLinkedin}
                onChange={(e) => setCompanyLinkedin(e.target.value)}
                placeholder="https://linkedin.com/company/..."
                className={inputClass}
              />
            </Field>
            <Field label="Facebook (optional)" htmlFor="companyFacebook">
              <input
                id="companyFacebook"
                type="url"
                value={companyFacebook}
                onChange={(e) => setCompanyFacebook(e.target.value)}
                placeholder="https://facebook.com/..."
                className={inputClass}
              />
            </Field>
            <Field label="Instagram (optional)" htmlFor="companyInstagram">
              <input
                id="companyInstagram"
                type="url"
                value={companyInstagram}
                onChange={(e) => setCompanyInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                className={inputClass}
              />
            </Field>
            <Field label="Founded year (optional)" htmlFor="foundedYear">
              <input
                id="foundedYear"
                type="number"
                min={1800}
                max={CURRENT_YEAR}
                step={1}
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value)}
                placeholder="e.g. 2018"
                className={inputClass}
              />
              {!isValidFoundedYear(foundedYear) && (
                <p className="mt-[4px] text-xs text-red-500">
                  Enter a whole year between 1800 and {CURRENT_YEAR}.
                </p>
              )}
            </Field>
            <Field label="Company type (optional)" htmlFor="companyType" className="col-span-full">
              <Dropdown
                id="companyType"
                label="Company type"
                value={companyType}
                options={[{ value: "" as const, label: "Not set" }, ...COMPANY_TYPES.map((t) => ({ value: t, label: t }))]}
                onChange={(value) => setCompanyType(value as (typeof COMPANY_TYPES)[number] | "")}
              />
            </Field>

            {officePhotoUrl && (
              <div className="col-span-full flex flex-col gap-[6px]">
                <p className="text-xs text-[#4B5468]">Office photo (from AI lookup)</p>
                <div className="relative w-full max-w-[320px] overflow-hidden rounded-[14px] border border-[#EAEDF2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={officePhotoUrl} alt="Office" className="h-[160px] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setOfficePhotoUrl(null)}
                    aria-label="Remove office photo"
                    className="absolute right-[8px] top-[8px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white/90 text-[#9AA3B2] hover:text-[#141B2E]"
                  >
                    <XIcon className="h-[11px] w-[11px]" />
                  </button>
                </div>
              </div>
            )}

            <div className="col-span-full flex flex-col gap-[10px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#4B5468]">Recent news (optional)</p>
                  <p className="text-xs text-[#9AA3B2]">
                    Filled by &ldquo;Fill with AI&rdquo; when available — unverified, please check before
                    continuing — or add your own.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecentNews((prev) => [...prev, { title: "", url: "" }])}
                  className="flex shrink-0 items-center gap-[4px] rounded-full bg-[#E6F9FA] py-[6px] pl-[10px] pr-[12px] text-sm text-[#008990] hover:bg-[#CFF4F6]"
                >
                  <PlusIcon className="h-[10px] w-[10px]" />
                  Add
                </button>
              </div>
              {recentNews.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                >
                  <div className="flex items-start justify-between gap-[8px]">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateNewsItem(index, { title: e.target.value })}
                      placeholder="Headline"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setRecentNews((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove entry"
                      className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
                    >
                      <XIcon className="h-[10px] w-[10px]" />
                    </button>
                  </div>
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateNewsItem(index, { url: e.target.value })}
                    placeholder="Source URL (https://...)"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            </fieldset>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="rounded-[19px] bg-white p-[22px] text-left">
          <h1 className="text-xl font-semibold text-[#141B2E]">About your company</h1>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
            Tell us a bit about your company so we can help you hire faster.
          </p>

          <div className="mt-[16px] grid grid-cols-1 gap-x-[14px] gap-y-[12px] sm:grid-cols-2">
            <fieldset disabled={mode === "edit" && !companyEditing} className="contents">
            <Field required label="SSM registration number" htmlFor="ssmNumber">
              <input
                id="ssmNumber"
                type="text"
                value={ssmNumber}
                onChange={(e) => setSsmNumber(e.target.value)}
                placeholder="e.g. 202301012345"
                className={inputClass}
              />
            </Field>
            <Field required label="Industry" htmlFor="industry">
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. F&B, Retail, Logistics"
                className={inputClass}
              />
            </Field>
            <Field required label="Industry category" htmlFor="industryCategory">
              <Dropdown
                id="industryCategory"
                label="Industry category"
                value={industryCategory}
                options={[
                  { value: "" as const, label: "Select industry" },
                  ...INDUSTRIES.map((i) => ({ value: i, label: i })),
                ]}
                onChange={(value) => setIndustryCategory(value as (typeof INDUSTRIES)[number] | "")}
                searchable
                searchPlaceholder="Search industries..."
              />
            </Field>
            <div className="col-span-full flex flex-col gap-[12px]">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#4B5468]">
                  Company address{addresses.length > 1 ? "es" : ""}
                </p>
                <button
                  type="button"
                  onClick={addAddress}
                  className="flex shrink-0 items-center gap-[4px] rounded-full bg-[#E6F9FA] py-[6px] pl-[10px] pr-[12px] text-sm text-[#008990] hover:bg-[#CFF4F6]"
                >
                  <PlusIcon className="h-[12px] w-[12px]" />
                  Add another address
                </button>
              </div>

              {addresses.map((address, i) => (
                <div
                  key={address.key}
                  className="flex flex-col gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                >
                  <div className="flex items-center justify-between gap-[10px]">
                    <input
                      type="text"
                      value={address.label}
                      onChange={(e) => updateAddress(address.key, { label: e.target.value })}
                      placeholder="e.g. Headquarters, Branch office"
                      className={`${inputClass} max-w-[260px]`}
                    />
                    {addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddress(address.key)}
                        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.06] hover:text-red-500"
                        aria-label={`Remove ${address.label || "this address"}`}
                      >
                        <XIcon className="h-[12px] w-[12px]" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-x-[14px] gap-y-[10px] sm:grid-cols-2">
                    <Field required label="Street address" htmlFor={address.key} className="col-span-full">
                      <input
                        id={address.key}
                        type="text"
                        value={address.addressLine1}
                        onChange={(e) => updateAddress(address.key, { addressLine1: e.target.value })}
                        placeholder="e.g. 12, Jalan SS 2/24"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Address line 2 (optional)" htmlFor={`${address.key}-line2`} className="col-span-full">
                      <input
                        id={`${address.key}-line2`}
                        type="text"
                        value={address.addressLine2}
                        onChange={(e) => updateAddress(address.key, { addressLine2: e.target.value })}
                        placeholder="e.g. Unit 5-1, Level 5"
                        className={inputClass}
                      />
                    </Field>
                    <Field required label="City" htmlFor={`${address.key}-city`}>
                      <input
                        id={`${address.key}-city`}
                        type="text"
                        value={address.city}
                        onChange={(e) => updateAddress(address.key, { city: e.target.value })}
                        placeholder="e.g. Petaling Jaya"
                        className={inputClass}
                      />
                    </Field>
                    <Field required label="State" htmlFor={`${address.key}-state`}>
                      <Dropdown
                        id={`${address.key}-state`}
                        label="State"
                        value={address.state}
                        options={[
                          { value: "" as const, label: "Select state" },
                          ...MALAYSIA_STATES.map((s) => ({ value: s, label: s })),
                        ]}
                        onChange={(value) =>
                          updateAddress(address.key, { state: value as (typeof MALAYSIA_STATES)[number] | "" })
                        }
                      />
                    </Field>
                    <Field required label="Postcode" htmlFor={`${address.key}-postcode`}>
                      <input
                        id={`${address.key}-postcode`}
                        type="text"
                        inputMode="numeric"
                        value={address.postcode}
                        onChange={(e) =>
                          updateAddress(address.key, { postcode: e.target.value.replace(/\D/g, "").slice(0, 5) })
                        }
                        placeholder="e.g. 47300"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  {isCompleteAddress(address) && (
                    <iframe
                      title={`Map for ${address.label || "this address"}`}
                      src={`https://www.google.com/maps?q=${encodeURIComponent(
                        `${address.addressLine1}, ${address.addressLine2 ? `${address.addressLine2}, ` : ""}${address.city}, ${address.state} ${address.postcode}, Malaysia`,
                      )}&output=embed`}
                      loading="lazy"
                      className="h-[180px] w-full rounded-[12px] border border-black/[0.08]"
                    />
                  )}
                  {i === 0 && (
                    <p className="text-xs text-[#9AA3B2]">
                      This is the address &ldquo;Fill with AI&rdquo; fills in for you, when it can find one.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Field label="Company size" htmlFor="companySize" className="col-span-full">
              <div
                id="companySize"
                role="radiogroup"
                aria-label="Company size"
                className="grid h-[38px] grid-cols-5 gap-[4px] rounded-full border border-black/[0.1] p-[3px]"
              >
                {COMPANY_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    onClick={() => setCompanySize(size)}
                    aria-checked={companySize === size}
                    className="flex h-[30px] items-center justify-center rounded-full text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-checked:bg-brand-teal-dark aria-checked:text-white aria-checked:hover:bg-brand-teal-dark"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Default benefits" htmlFor="benefitInput" className="col-span-full">
              <input
                id="benefitInput"
                type="text"
                value={benefitInput}
                onChange={(e) => setBenefitInput(e.target.value)}
                onKeyDown={handleBenefitKeyDown}
                onBlur={addBenefit}
                placeholder="Add a benefit and press Enter"
                className={inputClass}
              />
              {benefits.length > 0 && (
                <div className="mt-[10px] flex flex-wrap gap-[6px]">
                  {benefits.map((benefit) => (
                    <span
                      key={benefit}
                      className="flex items-center gap-[6px] rounded-full bg-brand-teal-dark py-[6px] pl-[12px] pr-[8px] text-xs text-white"
                    >
                      {benefit}
                      <button
                        type="button"
                        onClick={() => removeBenefit(benefit)}
                        aria-label={`Remove ${benefit}`}
                        className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white"
                      >
                        <XIcon className="h-[9px] w-[9px]" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {SUGGESTED_BENEFITS.some((b) => !benefits.includes(b)) && (
                <div className="mt-[10px] flex flex-wrap gap-[6px]">
                  {SUGGESTED_BENEFITS.filter((b) => !benefits.includes(b)).map((benefit) => (
                    <button
                      key={benefit}
                      type="button"
                      onClick={() => addBenefitValue(benefit)}
                      className="flex items-center gap-[4px] rounded-full bg-[#F1F4F8] py-[6px] pl-[10px] pr-[12px] text-sm text-[#4B5468] hover:bg-black/[0.08] hover:text-[#141B2E]"
                    >
                      <PlusIcon className="h-[9px] w-[9px]" />
                      {benefit}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            </fieldset>

            {error && <p className="col-span-full text-xs text-red-500">{error}</p>}

            {mode === "edit" && !companyEditing ? (
              <button
                type="button"
                onClick={() => setCompanyEditing(true)}
                className="col-span-full mt-[8px] flex h-[38px] w-full items-center justify-center rounded-full border border-brand-teal-dark text-sm text-brand-teal-dark transition-opacity hover:opacity-90"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                disabled={!formValid || submitting}
                onClick={() => handleSubmit()}
                className="col-span-full mt-[8px] flex h-[38px] w-full items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Saving…" : saveLabel}
              </button>
            )}
            {savedAt && !error && <p className="col-span-full text-xs text-[#008990]">Saved.</p>}
          </div>
        </div>
      </div>
      </div>
      )}

      <div
        className={`flex flex-col gap-[16px] lg:sticky lg:flex-[1] ${mode === "edit" ? "lg:top-[85px]" : "lg:top-[22px]"}`}
      >
          <div
            className={
              requiredChecklistComplete
                ? cardClass
                : "rounded-[20px] bg-gradient-to-br from-[#A66A61] via-white to-[#A66A61] p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]"
            }
          >
          <div className="rounded-[19px] bg-white p-[22px]">
            <p className="text-left text-lg font-semibold text-[#141B2E]">
              {requiredChecklistComplete ? "All required fields are complete." : "Complete these required fields to continue:"}
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

          {showCompany && (
          <div className={cardClass}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <p className="text-left text-lg font-semibold text-[#141B2E]">
              {boostChecklistRemaining > 0
                ? "Not compulsory, but these help your posting stand out to candidates:"
                : "Nice — your company profile is fully boosted and ready to stand out."}
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
          )}
        </div>

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
            You&rsquo;ve made changes that haven&rsquo;t been saved yet. Save them before you go, or
            discard and leave.
          </p>
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={submitting || !formValid}
              onClick={saveAndLeave}
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

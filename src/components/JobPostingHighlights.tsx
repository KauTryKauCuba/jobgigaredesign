"use client";

import { useEffect, useMemo, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { gradientFrameClass } from "./formStyles";
import { SearchIcon } from "./icons";
import Modal from "./Modal";
import RichTextContent from "./RichTextContent";
import { getRevealOffset, getRevealStyle } from "@/lib/cardReveal";
import { fullPostingAddress } from "@/lib/postingLocation";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam / fraud" },
  { value: "discriminatory", label: "Discriminatory" },
  { value: "misleading", label: "Misleading" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "other", label: "Other" },
] as const;

function PlaceholderLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="14" height="9" rx="1.6" />
      <path d="M7 7V5.6C7 4.72 7.72 4 8.6 4h2.8c.88 0 1.6.72 1.6 1.6V7" />
    </svg>
  );
}

// Decorative-only, one-off icons for this card's footer row (no click
// behavior — this is the public marketing page, not the real listing view).
function EyeOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M2 2l12 12" strokeLinecap="round" />
      <path d="M7 3.3A6.8 6.8 0 0 1 8 3.2c3.4 0 6.2 2.4 7 4.8-.3.9-.9 1.9-1.7 2.7M4.6 4.7C3.1 5.6 1.9 7 1 8c.9 2.6 3.8 4.8 7 4.8.9 0 1.8-.2 2.5-.5" strokeLinecap="round" />
      <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
    </svg>
  );
}

function BookmarkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M4 2.6c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v10.8l-4-2.6-4 2.6V2.6Z" strokeLinejoin="round" />
    </svg>
  );
}

function CompanyLogo({ url, className = "" }: { url: string | null; className?: string }) {
  if (!url) return <PlaceholderLogo className={className} />;
  // Company logos are stored as arbitrary uploaded URLs/data URIs (same
  // convention as EmployerOnboardingForm's own logo preview) — not a fixed
  // set of static assets next/image can optimize.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className} object-contain`} />;
}

function PostingCard({
  posting,
  selected = false,
  onClick,
}: {
  posting: JobPosting;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`h-full text-left ${gradientFrameClass("gold")} ${
        selected ? "ring-1 ring-inset ring-brand-gold-dark" : ""
      }`}
    >
      <div className="flex h-full flex-col gap-[12px] rounded-[19px] bg-white p-[16px]">
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <p className="truncate text-sm text-[#141B2E]">{posting.title}</p>
            <p className="mt-[2px] truncate text-xs text-[#4B5468]">{posting.company}</p>
            <span className="mt-[8px] inline-flex items-center rounded-full bg-[#E3F9E5] px-[10px] py-[3px] text-xs text-[#1F7A3F]">
              New to you
            </span>
          </div>
          <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center">
            <CompanyLogo url={posting.logoUrl} className="h-[54px] w-[68px]" />
          </div>
        </div>

        <div className="flex flex-col gap-[2px] text-xs text-[#141B2E]">
          <div className="flex items-center justify-between gap-[8px]">
            <span>{posting.location}</span>
            <span>{posting.jobType}</span>
          </div>
          <span>{posting.salary}</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-[10px]">
          <span className="text-xs text-[#9AA3B2]">{posting.postedAgo}</span>
          <div className="flex items-center gap-[10px] text-[#9AA3B2]">
            <EyeOffIcon className="h-[15px] w-[15px]" />
            <BookmarkIcon className="h-[15px] w-[15px]" />
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

type RequiredLanguage = { language: string; level: string };

// A "curated-*" id marks one of CURATED_JOB_POSTINGS below rather than a
// real job_postings row — used to gate the actions that assume a real
// posting exists in the DB (view tracking, apply, report).
function isCurated(id: string): boolean {
  return id.startsWith("curated-");
}

// Mirrors every field the employer "Post a job" form (EmployerJobsView)
// collects, so this preview can show the same depth of detail a jobseeker
// would actually see — not just the summary shown on the card. Built from
// real `job_postings` rows (status "active") passed down from the server,
// not mock data.
type JobPosting = {
  id: string;
  title: string;
  company: string;
  logoUrl: string | null;
  jobType: string;
  location: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  salary: string;
  postedAgo: string;
  description: string;
  responsibilities: string;
  industry: string;
  workArrangement: string;
  openings: number;
  skills: string[];
  softSkills: string[];
  minYearsExperience: number;
  minQualificationTier: string;
  drivingLicense?: string;
  languages: RequiredLanguage[];
  workAuthorizations: string[];
};

export type ActivePostingRow = {
  posting: {
    id: string;
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
    minYearsExperience: number | null;
    minQualificationTier: string | null;
    languages: { language: string; level: string }[];
    workAuthorizations: string[];
    drivingLicense: string | null;
    createdAt: string;
  };
  companyName: string;
  companyLogoUrl: string | null;
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};
const WORK_AUTHORIZATION_LABEL: Record<string, string> = {
  citizen: "Malaysian citizen",
  permanent_resident: "Permanent resident",
  work_pass_holder: "Work pass holder",
  needs_sponsorship: "Open to sponsorship",
};
const DRIVING_LICENSE_LABEL: Record<string, string> = {
  b2: "B2 (motorcycle)",
  b: "B (car)",
  d: "D (bus)",
  da: "DA (bus + trailer)",
  e: "E (lorry)",
};
const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
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

function toJobPosting(row: ActivePostingRow): JobPosting {
  const { posting, companyName, companyLogoUrl } = row;
  return {
    id: posting.id,
    title: posting.title,
    company: companyName,
    logoUrl: companyLogoUrl,
    jobType: EMPLOYMENT_TYPE_LABEL[posting.employmentType] ?? posting.employmentType,
    location: posting.location || "Not specified",
    addressLine1: posting.addressLine1,
    addressLine2: posting.addressLine2,
    city: posting.city,
    state: posting.state,
    postcode: posting.postcode,
    salary:
      posting.salaryMin && posting.salaryMax
        ? `RM ${posting.salaryMin.toLocaleString()} – RM ${posting.salaryMax.toLocaleString()} per month`
        : "Salary not disclosed",
    postedAgo: relativeTimeAgo(posting.createdAt),
    description: posting.description,
    responsibilities: posting.responsibilities,
    industry: posting.industry ?? "Not specified",
    workArrangement: WORK_ARRANGEMENT_LABEL[posting.workArrangement] ?? posting.workArrangement,
    openings: posting.openings,
    skills: posting.skills,
    softSkills: posting.softSkills,
    minYearsExperience: posting.minYearsExperience ?? 0,
    minQualificationTier: posting.minQualificationTier ?? "No requirement",
    drivingLicense: posting.drivingLicense ? DRIVING_LICENSE_LABEL[posting.drivingLicense] : undefined,
    languages: posting.languages.map((l) => ({
      language: l.language,
      level: LANGUAGE_LEVEL_LABEL[l.level] ?? l.level,
    })),
    workAuthorizations: posting.workAuthorizations.map((w) => WORK_AUTHORIZATION_LABEL[w] ?? w),
  };
}

// Curated padding — same real, verified companies (and their actual logos)
// as CompanyHighlights' CURATED_COMPANIES on the employer landing page, so a
// young platform's "Jobs posted on JobGiga" section doesn't read as empty
// and stays consistent with what a visitor already saw there. Real postings
// replace these one slot at a time (see buildDisplayPostings below); every
// "curated-" id is excluded from Apply/Report/view-tracking, since there's
// no real job_postings row behind it.
const CURATED_JOB_POSTINGS: JobPosting[] = [
  {
    id: "curated-1",
    title: "Security Engineer",
    company: "aikido",
    logoUrl: "/logos/aikido.svg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 7,000 – RM 11,000 per month",
    postedAgo: "4d ago",
    description:
      "We're looking for a Security Engineer to help build and harden the automated vulnerability scanning that powers our platform. You'll work across the stack to catch real risks early, without drowning developers in false positives.",
    responsibilities:
      "Improve detection accuracy across our scanning engines · Triage and validate newly discovered vulnerability classes · Work with engineering to remediate findings in our own codebase · Contribute to research on emerging attack techniques",
    industry: "Cybersecurity",
    workArrangement: "Remote",
    openings: 2,
    skills: ["Application security", "Static analysis", "Python"],
    softSkills: ["Attention to detail", "Communication", "Curiosity"],
    minYearsExperience: 3,
    minQualificationTier: "Degree",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident", "Work pass holder"],
  },
  {
    id: "curated-2",
    title: "Backend Engineer",
    company: "Bolt",
    logoUrl: "/logos/bolt.jpg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 8,000 – RM 13,000 per month",
    postedAgo: "1w ago",
    description:
      "Join the team building the infrastructure behind one of Europe's fastest-growing mobility and fintech platforms. You'll design and scale services that handle millions of transactions, with real ownership over reliability and performance.",
    responsibilities:
      "Design and scale high-throughput backend services · Own reliability and on-call for your team's services · Collaborate closely with product on new payment features · Mentor junior engineers on system design",
    industry: "Fintech",
    workArrangement: "Remote",
    openings: 1,
    skills: ["Go", "Distributed systems", "PostgreSQL"],
    softSkills: ["Ownership", "Problem solving", "Clear technical writing"],
    minYearsExperience: 4,
    minQualificationTier: "Degree",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident", "Work pass holder"],
  },
  {
    id: "curated-3",
    title: "Customer Success Manager",
    company: "Parim",
    logoUrl: "/logos/parim.svg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 5,000 – RM 7,500 per month",
    postedAgo: "2d ago",
    description:
      "We're hiring a Customer Success Manager to help workforce management customers get the most out of our platform. You'll be the main point of contact from onboarding through renewal, spotting risk early and turning happy customers into advocates.",
    responsibilities:
      "Own onboarding and adoption for a portfolio of accounts · Run regular check-ins and business reviews · Spot churn risk early and coordinate a save plan · Feed customer feedback back into the product roadmap",
    industry: "Workforce management",
    workArrangement: "Remote",
    openings: 1,
    skills: ["Customer success", "SaaS onboarding", "CRM tools"],
    softSkills: ["Communication", "Empathy", "Relationship building"],
    minYearsExperience: 2,
    minQualificationTier: "Degree",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident"],
  },
  {
    id: "curated-4",
    title: "Operations Coordinator",
    company: "parcelly",
    logoUrl: "/logos/parcelly.svg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 3,800 – RM 5,200 per month",
    postedAgo: "5d ago",
    description:
      "We're looking for an Operations Coordinator to help keep our parcel collection network running smoothly. You'll work closely with partner locations and the logistics team to make sure every drop-off point stays reliable for customers.",
    responsibilities:
      "Monitor partner location performance and flag issues early · Coordinate with couriers on collection scheduling · Support onboarding of new partner locations · Maintain accurate records across internal systems",
    industry: "Logistics",
    workArrangement: "Remote",
    openings: 2,
    skills: ["Operations coordination", "Logistics tools", "Excel"],
    softSkills: ["Organization", "Problem solving", "Communication"],
    minYearsExperience: 1,
    minQualificationTier: "Diploma",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident"],
  },
  {
    id: "curated-5",
    title: "Frontend Engineer",
    company: "ParcelTracker",
    logoUrl: "/logos/parceltracker.svg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 6,000 – RM 9,000 per month",
    postedAgo: "3d ago",
    description:
      "Join our product team to build the interfaces couriers and warehouse teams rely on every day to scan, sort, and track parcels. You'll have real ownership over how features look and feel, working closely with design and backend engineers.",
    responsibilities:
      "Build and maintain a shared React component library · Implement UI from Figma designs with an eye for detail · Collaborate with backend engineers on API contracts · Write tests for critical scanning and tracking flows",
    industry: "Business software",
    workArrangement: "Remote",
    openings: 1,
    skills: ["React", "TypeScript", "REST APIs"],
    softSkills: ["Communication", "Teamwork", "Attention to detail"],
    minYearsExperience: 2,
    minQualificationTier: "Degree",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident", "Work pass holder"],
  },
  {
    id: "curated-6",
    title: "Content Designer",
    company: "WHALE",
    logoUrl: "/logos/whale.svg",
    jobType: "Full time",
    location: "Remote",
    salary: "RM 4,500 – RM 6,500 per month",
    postedAgo: "6d ago",
    description:
      "We're hiring a Content Designer to help teams turn messy processes into clear, easy-to-follow SOPs. You'll shape both our own product content and the templates customers use to document their own workflows.",
    responsibilities:
      "Write and edit clear, concise process documentation · Design reusable SOP templates for customers · Partner with product on in-app copy and onboarding flows · Review customer-submitted docs for clarity",
    industry: "Process documentation software",
    workArrangement: "Remote",
    openings: 1,
    skills: ["Technical writing", "Content design", "Process documentation"],
    softSkills: ["Clarity", "Attention to detail", "Collaboration"],
    minYearsExperience: 1,
    minQualificationTier: "Degree",
    languages: [{ language: "English", level: "Fluent" }],
    workAuthorizations: ["Malaysian citizen", "Permanent resident"],
  },
];

const MAX_HIGHLIGHT_POSTINGS = 6;

// Real postings replace curated ones one slot at a time (first real posting
// bumps the last curated one, etc.) — same concept as CompanyHighlights'
// buildDisplayCompanies. Unlike that fixed 6-card grid though, this section
// is an open browse list — once there are 6+ real postings, every one of
// them shows (no cap), not just six.
function buildDisplayPostings(realPostings: JobPosting[]): JobPosting[] {
  if (realPostings.length >= MAX_HIGHLIGHT_POSTINGS) return realPostings;
  return [...realPostings, ...CURATED_JOB_POSTINGS.slice(0, MAX_HIGHLIGHT_POSTINGS - realPostings.length)];
}

export default function JobPostingHighlights({
  postings,
  canApply,
  appliedJobPostingIds,
}: {
  postings: ActivePostingRow[];
  canApply: boolean;
  appliedJobPostingIds: string[];
}) {
  const { ref, progress } = useScrollReveal();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [appliedIds, setAppliedIds] = useState(() => new Set(appliedJobPostingIds));
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reportingPostingId, setReportingPostingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]["value"] | "">("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());

  async function apply(jobPostingId: string) {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/jobseeker/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPostingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit your application.");
      setAppliedIds((prev) => new Set(prev).add(jobPostingId));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Couldn't submit your application.");
    } finally {
      setApplying(false);
    }
  }

  function closeReportModal() {
    setReportingPostingId(null);
    setReportReason("");
    setReportDetails("");
    setReportError(null);
  }

  async function submitReport() {
    if (!reportingPostingId || !reportReason) return;
    setReporting(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/jobseeker/job-postings/${reportingPostingId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit your report.");
      setReportedIds((prev) => new Set(prev).add(reportingPostingId));
      closeReportModal();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Couldn't submit your report.");
    } finally {
      setReporting(false);
    }
  }

  const allPostings = useMemo(() => buildDisplayPostings(postings.map(toJobPosting)), [postings]);
  const locations = useMemo(
    () => ["All locations", ...Array.from(new Set(allPostings.map((p) => p.location)))],
    [allPostings],
  );
  const jobTypes = useMemo(
    () => ["All types", ...Array.from(new Set(allPostings.map((p) => p.jobType)))],
    [allPostings],
  );
  const [locationFilter, setLocationFilter] = useState(locations[0]);
  const [typeFilter, setTypeFilter] = useState(jobTypes[0]);
  // Purely visual for now — there's no per-jobseeker "viewed" tracking yet,
  // so both tabs show the same filteredPostings list.
  const [postingsTab, setPostingsTab] = useState<"all" | "new">("all");

  const filteredPostings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const locQuery = locationQuery.trim().toLowerCase();
    return allPostings.filter((posting) => {
      const matchesQuery =
        !query ||
        posting.title.toLowerCase().includes(query) ||
        posting.company.toLowerCase().includes(query);
      const matchesLocationQuery = !locQuery || posting.location.toLowerCase().includes(locQuery);
      const matchesLocation = locationFilter === "All locations" || posting.location === locationFilter;
      const matchesType = typeFilter === "All types" || posting.jobType === typeFilter;
      return matchesQuery && matchesLocationQuery && matchesLocation && matchesType;
    });
  }, [allPostings, searchQuery, locationQuery, locationFilter, typeFilter]);

  // Derived rather than synced via effect: if the previously selected
  // posting drops out of the filtered results, this falls straight back to
  // the first remaining result on the very next render.
  const [selectedId, setSelectedId] = useState(allPostings[0]?.id);
  const selectedPosting = filteredPostings.find((p) => p.id === selectedId) ?? filteredPostings[0];

  // Records a unique view once per posting per jobseeker — the endpoint
  // itself is a no-op for anyone not signed in as a jobseeker, and dedupes
  // repeat views via a unique constraint, so this can fire freely. Skipped
  // for curated postings — there's no real job_postings row for the
  // endpoint to attach the view to.
  useEffect(() => {
    if (!selectedPosting || isCurated(selectedPosting.id)) return;
    fetch(`/api/jobseeker/job-postings/${selectedPosting.id}/view`, { method: "POST" }).catch(() => {});
    // Only the id should retrigger this — selectedPosting is a freshly
    // derived object every render, so depending on it directly would fire a
    // request on every keystroke in the search box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPosting?.id]);

  // See CompanyHighlights for why reduced-motion forces the settled state
  // instead of leaving cards collapsed near the ribbon.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);
  const revealProgress = reducedMotion ? 1 : progress;

  return (
    <div className="shell relative z-[1] -mt-[32px] pt-[clamp(32px,5vh,56px)] pb-[128px]">
      <div className="relative z-[1] mx-auto max-w-[560px] text-center">
        <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[14px] py-[7px] text-xs text-[#4B5468]">
          Latest openings
        </span>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{ fontSize: "clamp(24px,2.6vw,32px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
        >
          Jobs posted on JobGiga
        </h2>
      </div>

      {allPostings.length === 0 ? (
        <div
          id="job-search"
          className="scroll-mt-[90px] relative z-0 mx-auto mt-[48px] max-w-[480px] rounded-[14px] border border-[#EAEDF2] bg-white p-[22px] text-center"
        >
          <p className="text-sm text-[#4B5468]">No jobs are live yet — check back soon.</p>
        </div>
      ) : (
        <>
      <div
        ref={ref}
        className="relative z-0 mt-[128px] grid grid-cols-1 items-stretch gap-[12px] sm:grid-cols-2 lg:grid-cols-4"
      >
        {filteredPostings.map((posting, i) => {
          const revealStyle = getRevealStyle(revealProgress, getRevealOffset(i));
          return (
            <div key={posting.id} className="will-change-transform" style={revealStyle}>
              <PostingCard posting={posting} />
            </div>
          );
        })}
      </div>

      {filteredPostings.length === 0 && (
        <div className="mt-[12px] rounded-[14px] border border-[#EAEDF2] bg-white p-[22px] text-center">
          <p className="text-sm text-[#4B5468]">No roles match your search. Try adjusting your filters.</p>
        </div>
      )}

      <div className="sticky top-0 z-30 mx-auto mt-[64px] flex w-full flex-col gap-[14px] bg-[#FDFAF0] py-[14px]">
        <div
          role="group"
          aria-label="Filter jobs by location and type"
          className="mx-auto flex flex-wrap items-center justify-center gap-[4px] rounded-full border border-black/[0.1] p-[3px]"
        >
          {locations.map((location) => (
            <button
              key={location}
              type="button"
              role="radio"
              aria-checked={locationFilter === location}
              onClick={() => setLocationFilter(location)}
              className={`flex h-[30px] items-center justify-center rounded-full px-[14px] text-sm transition-colors ${
                locationFilter === location
                  ? "bg-[#FFE9A6] text-[#141B2E]"
                  : "text-[#4B5468] hover:bg-black/[0.03]"
              }`}
            >
              {location}
            </button>
          ))}

          <span className="mx-[4px] h-[20px] w-px bg-black/[0.1]" />

          {jobTypes.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              className={`flex h-[30px] items-center justify-center rounded-full px-[14px] text-sm transition-colors ${
                typeFilter === type
                  ? "bg-brand-gold-dark text-white"
                  : "text-[#4B5468] hover:bg-black/[0.03]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div
          id="job-search"
          className="scroll-mt-[90px] flex flex-col rounded-[29px] border border-black/[0.1] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:h-[58px] sm:flex-row sm:items-center"
        >
          <div className="flex h-[58px] flex-1 items-center gap-[10px] px-[18px]">
            <SearchIcon className="h-[16px] w-[16px] shrink-0 text-[#9AA3B2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title or company"
              className="h-full w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>

          <span className="mx-[6px] hidden h-[26px] w-px shrink-0 bg-black/[0.1] sm:block" />
          <span className="mx-[18px] block h-px shrink-0 bg-black/[0.1] sm:hidden" />

          <div className="flex h-[58px] flex-1 items-center gap-[10px] px-[18px]">
            <SearchIcon className="h-[16px] w-[16px] shrink-0 text-[#9AA3B2]" />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Search by location"
              className="h-full w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
        </div>
      </div>

      {selectedPosting && (
        <div className="relative z-0 mx-auto mt-[32px] grid w-full grid-cols-1 gap-[16px] lg:grid-cols-[340px_1fr] lg:items-start">
          <div className="flex flex-col gap-[12px] p-[4px]">
            <div
              role="radiogroup"
              aria-label="Job postings filter"
              className="grid h-[38px] grid-cols-2 gap-[4px] rounded-full border border-black/[0.1] p-[3px]"
            >
              <button
                type="button"
                role="radio"
                aria-checked={postingsTab === "all"}
                onClick={() => setPostingsTab("all")}
                className="flex h-[30px] items-center justify-center rounded-full text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-checked:bg-brand-gold-dark aria-checked:text-white aria-checked:hover:bg-brand-gold-dark"
              >
                All jobs
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={postingsTab === "new"}
                onClick={() => setPostingsTab("new")}
                className="flex h-[30px] items-center justify-center rounded-full text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-checked:bg-brand-gold-dark aria-checked:text-white aria-checked:hover:bg-brand-gold-dark"
              >
                New to you
              </button>
            </div>
            {filteredPostings.map((posting) => (
              <PostingCard
                key={posting.id}
                posting={posting}
                selected={selectedPosting.id === posting.id}
                onClick={() => setSelectedId(posting.id)}
              />
            ))}
          </div>

          <div className={`sticky top-[150px] ${gradientFrameClass("gold")}`}>
            <div className="rounded-[19px] bg-white p-[24px]">
              <div className="flex items-start justify-between gap-[16px]">
                <div>
                  <p className="text-lg text-[#141B2E]">{selectedPosting.title}</p>
                  <p className="mt-[4px] text-sm text-[#4B5468]">{selectedPosting.company}</p>
                </div>
                <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center">
                  <CompanyLogo url={selectedPosting.logoUrl} className="h-[44px] w-[56px]" />
                </div>
              </div>

              <div className="mt-[16px] flex flex-wrap items-center gap-[8px] text-xs">
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.industry}
                </span>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.location}
                </span>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.jobType}
                </span>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.workArrangement}
                </span>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.salary}
                </span>
                <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
                  {selectedPosting.openings} opening{selectedPosting.openings === 1 ? "" : "s"}
                </span>
                <span className="text-[#9AA3B2]">Posted {selectedPosting.postedAgo}</span>
              </div>

              <RichTextContent
                html={selectedPosting.description}
                className="mt-[20px] text-sm leading-[22px] text-[#4B5468]"
              />

              <div className="mt-[20px]">
                <p className="text-xs text-[#141B2E]">Job description</p>
                <RichTextContent
                  html={selectedPosting.responsibilities}
                  className="mt-[6px] text-sm leading-[22px] text-[#4B5468]"
                />
              </div>

              {selectedPosting.skills.length > 0 && (
                <div className="mt-[20px]">
                  <p className="text-xs text-[#141B2E]">Skills required</p>
                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                    {selectedPosting.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#FFE9A6] px-[12px] py-[6px] text-xs text-[#141B2E]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPosting.softSkills.length > 0 && (
                <div className="mt-[16px]">
                  <p className="text-xs text-[#141B2E]">Soft skills</p>
                  <div className="mt-[8px] flex flex-wrap gap-[6px]">
                    {selectedPosting.softSkills.map((skill) => (
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

              {selectedPosting.location && (
                <div className="mt-[16px]">
                  <p className="text-xs text-[#141B2E]">Location</p>
                  <p className="mt-[2px] text-sm text-[#4B5468]">{fullPostingAddress(selectedPosting)}</p>
                  <iframe
                    title={`Map for ${selectedPosting.location}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(fullPostingAddress(selectedPosting))}&output=embed`}
                    loading="lazy"
                    className="mt-[8px] h-[160px] w-full rounded-[12px] border border-black/[0.08]"
                  />
                </div>
              )}

              <div className="mt-[24px] border-t border-black/[0.06] pt-[16px]">
                <p className="text-sm text-[#141B2E]">Screening requirements</p>
                <div className="mt-[12px] grid grid-cols-1 gap-x-[20px] gap-y-[12px] sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-[#4B5468]">Minimum experience</p>
                    <p className="mt-[2px] text-sm text-[#141B2E]">
                      {selectedPosting.minYearsExperience === 0
                        ? "No requirement"
                        : `${selectedPosting.minYearsExperience} year${selectedPosting.minYearsExperience === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4B5468]">Minimum education</p>
                    <p className="mt-[2px] text-sm text-[#141B2E]">{selectedPosting.minQualificationTier}</p>
                  </div>
                  {selectedPosting.drivingLicense && (
                    <div>
                      <p className="text-xs text-[#4B5468]">Driving license</p>
                      <p className="mt-[2px] text-sm text-[#141B2E]">{selectedPosting.drivingLicense}</p>
                    </div>
                  )}
                  {selectedPosting.languages.length > 0 && (
                    <div>
                      <p className="text-xs text-[#4B5468]">Languages required</p>
                      <p className="mt-[2px] text-sm text-[#141B2E]">
                        {selectedPosting.languages.map((l) => `${l.language} (${l.level})`).join(", ")}
                      </p>
                    </div>
                  )}
                  {selectedPosting.workAuthorizations.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-[#4B5468]">Accepted work authorization</p>
                      <p className="mt-[2px] text-sm text-[#141B2E]">
                        {selectedPosting.workAuthorizations.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                // Curated postings have no real job_postings row behind
                // them — Apply/Report only make sense for real ones.
                if (isCurated(selectedPosting.id)) {
                  return (
                    <p className="mt-[24px] text-xs text-[#9AA3B2]">
                      Sample listing — real roles open up for applications as employers post them.
                    </p>
                  );
                }
                const applied = appliedIds.has(selectedPosting.id);
                if (!canApply) {
                  return (
                    <p className="mt-[24px] text-xs text-[#4B5468]">
                      <a href="#top" className="text-brand-gold-dark hover:underline">
                        Sign in as a jobseeker
                      </a>{" "}
                      to apply for this role.
                    </p>
                  );
                }
                return (
                  <>
                    <button
                      type="button"
                      disabled={applied || applying}
                      onClick={() => apply(selectedPosting.id)}
                      className="mt-[24px] flex h-[42px] items-center rounded-full bg-[#FFE9A6] px-[22px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applied ? "Applied" : applying ? "Applying…" : "Apply now"}
                    </button>
                    {applyError && <p className="mt-[8px] text-xs text-red-500">{applyError}</p>}
                  </>
                );
              })()}

              {canApply &&
                !isCurated(selectedPosting.id) &&
                (reportedIds.has(selectedPosting.id) ? (
                  <p className="mt-[10px] text-xs text-[#9AA3B2]">Reported — thanks for the heads up.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReportingPostingId(selectedPosting.id)}
                    className="mt-[10px] text-sm text-[#9AA3B2] underline hover:text-[#141B2E]"
                  >
                    Report this posting
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {reportingPostingId && (
        <Modal ariaLabel="Report this posting" onClose={closeReportModal}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Report this posting</h2>
          <p className="mt-[6px] text-xs text-[#4B5468]">
            Let us know what&rsquo;s wrong — a superadmin will review it.
          </p>

          <div
            role="radiogroup"
            aria-label="Report reason"
            className="mt-[14px] grid grid-cols-2 gap-[6px]"
          >
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reportReason === r.value}
                onClick={() => setReportReason(r.value)}
                className="h-[34px] rounded-full border border-black/[0.1] text-sm text-[#4B5468] transition-colors aria-checked:border-brand-gold-dark aria-checked:bg-[#FFF3D6] aria-checked:text-[#A67C00]"
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={3}
            placeholder="Any extra details (optional)"
            className="mt-[10px] w-full resize-none rounded-[12px] border border-black/[0.1] px-[14px] py-[10px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-gold-dark"
          />

          {reportError && <p className="mt-[8px] text-xs text-red-500">{reportError}</p>}

          <div className="mt-[14px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={!reportReason || reporting}
              onClick={submitReport}
              className="flex h-[38px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reporting ? "Submitting…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={closeReportModal}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

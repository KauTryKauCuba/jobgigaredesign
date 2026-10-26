"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import Dropdown from "./Dropdown";
import FeaturedJobAds, { type FeaturedJobAd } from "./FeaturedJobAds";
import { gradientFrameClass, inputClass as formInputClass } from "./formStyles";
import { SearchIcon } from "./icons";
import Modal from "./Modal";
import SaveJobButton from "./SaveJobButton";
import { getRevealOffset, getRevealStyle } from "@/lib/cardReveal";
import { formatLanguageRequirement } from "@/lib/languages";
import { questionType, type CustomAnswer } from "@/lib/screening-questions";
import { sampleJobAdFill } from "@/lib/sample-job-ads";
import JobPostingDetails, {
  DRIVING_LICENSE_LABEL,
  LANGUAGE_LEVEL_LABEL,
  PostingCard,
  toJobPosting,
  WORK_AUTHORIZATION_LABEL,
  type ActivePostingRow,
  type JobPosting,
} from "./JobPostingDetails";

export type { ActivePostingRow };

/** A live job ad from the server — the card's job details come from the posting itself (see featuredAds below). */
export type LiveJobAd = {
  id: string;
  jobPostingId: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  companyVerified: boolean;
};

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam / fraud" },
  { value: "discriminatory", label: "Discriminatory" },
  { value: "misleading", label: "Misleading" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "other", label: "Other" },
] as const;

// A "curated-*" id marks one of CURATED_JOB_POSTINGS below rather than a
// real job_postings row — used to gate the actions that assume a real
// posting exists in the DB (view tracking, apply, report).
function isCurated(id: string): boolean {
  return id.startsWith("curated-");
}

// Mirrors QUALIFICATION_TIERS in EmployerJobsView.tsx — the same fixed list
// the employer picks a minimum from, offered here for the jobseeker to
// answer with their own highest level.
const QUALIFICATION_TIERS = ["SPM", "STPM", "Diploma", "Degree", "Master", "PhD", "Other"] as const;

type ScreeningAnswers = {
  yearsExperience: string;
  qualificationTier: string;
  drivingLicense: string;
  languageLevels: Record<string, string>;
  workAuthorization: string;
  // Keyed by question id, kept as typed: "yes"/"no" for yes/no questions, the
  // picked option, a number as text, or free text. Missing/"" means unanswered,
  // distinct from an explicit "no".
  customAnswers: Record<string, string>;
};

// What the apply request carries for each answered question, by its type.
function customAnswersPayload(
  answers: Record<string, string>,
  questions: { id: string; type: "yesno" | "choice" | "number" | "text" }[],
): CustomAnswer[] {
  const out: CustomAnswer[] = [];
  for (const q of questions) {
    const raw = (answers[q.id] ?? "").trim();
    if (!raw) continue;
    switch (questionType(q)) {
      case "choice":
        out.push({ questionId: q.id, choice: raw });
        break;
      case "number": {
        const n = Number(raw);
        if (Number.isFinite(n)) out.push({ questionId: q.id, number: n });
        break;
      }
      case "text":
        out.push({ questionId: q.id, text: raw });
        break;
      default:
        out.push({ questionId: q.id, answer: raw === "yes" });
    }
  }
  return out;
}

function blankScreeningAnswers(): ScreeningAnswers {
  return {
    yearsExperience: "",
    qualificationTier: "",
    drivingLicense: "",
    languageLevels: {},
    workAuthorization: "",
    customAnswers: {},
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
    screeningEnabled: false,
    customQuestions: [],
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
    screeningEnabled: false,
    customQuestions: [],
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
    screeningEnabled: false,
    customQuestions: [],
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
    screeningEnabled: false,
    customQuestions: [],
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
    screeningEnabled: false,
    customQuestions: [],
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
    screeningEnabled: false,
    customQuestions: [],
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
  savedJobPostingIds = [],
  hasVideoPitch = false,
  jobAds = [],
}: {
  postings: ActivePostingRow[];
  canApply: boolean;
  appliedJobPostingIds: string[];
  savedJobPostingIds?: string[];
  // Without one, a nudge to record a pitch appears right after applying.
  hasVideoPitch?: boolean;
  // Approved job posting ads running today — shown above the search.
  jobAds?: LiveJobAd[];
}) {
  const { ref, progress } = useScrollReveal();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [appliedIds, setAppliedIds] = useState(() => new Set(appliedJobPostingIds));
  // Kept here (not just inside each heart) so switching between postings in
  // the detail panel shows each one's current saved state.
  const [savedIds, setSavedIds] = useState(() => new Set(savedJobPostingIds));
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  // Only opened for a posting with screeningEnabled — everything else keeps
  // applying a single click, exactly as before this feature existed.
  const [screeningPostingId, setScreeningPostingId] = useState<string | null>(null);
  const [screeningAnswers, setScreeningAnswers] = useState<ScreeningAnswers>(() => blankScreeningAnswers());
  const [reportingPostingId, setReportingPostingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]["value"] | "">("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());

  async function apply(jobPostingId: string, answers?: ScreeningAnswers) {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/jobseeker/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPostingId,
          screeningAnswers: answers
            ? {
                yearsExperience: answers.yearsExperience.trim() ? Number(answers.yearsExperience) : null,
                qualificationTier: answers.qualificationTier || null,
                drivingLicense: answers.drivingLicense || null,
                // Keyed "language|dialect" — one answer per requirement.
                languages: Object.entries(answers.languageLevels)
                  .filter(([, level]) => level)
                  .map(([key, level]) => {
                    const [language, dialect] = key.split("|");
                    return { language, dialect: dialect || null, level };
                  }),
                workAuthorization: answers.workAuthorization || null,
                customAnswers: customAnswersPayload(answers.customAnswers, screeningPosting?.customQuestions ?? []),
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit your application.");
      setAppliedIds((prev) => new Set(prev).add(jobPostingId));
      setScreeningPostingId(null);
      setScreeningAnswers(blankScreeningAnswers());
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Couldn't submit your application.");
    } finally {
      setApplying(false);
    }
  }

  function startApply(posting: JobPosting) {
    setApplyError(null);
    if (posting.screeningEnabled) {
      setScreeningAnswers(blankScreeningAnswers());
      setScreeningPostingId(posting.id);
      return;
    }
    apply(posting.id);
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
  const detailRef = useRef<HTMLDivElement>(null);
  // Below lg the detail panel stacks under the list, so picking a posting
  // needs to bring it into view or the tap looks like it did nothing.
  function selectPosting(id: string) {
    setSelectedId(id);
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
  const selectedPosting = filteredPostings.find((p) => p.id === selectedId) ?? filteredPostings[0];

  // Each ad's job details come from the posting shown on this page (same
  // labels as its listing); an ad whose posting isn't listed is skipped.
  // Like the employer page's Company spotlight, sample ads for the curated
  // showcase companies fill the slots real ads don't use (see
  // sampleJobAdFill) — a sample opens its sample listing while that's shown.
  const featuredAds = useMemo<FeaturedJobAd[]>(() => {
    const byId = new Map(allPostings.map((p) => [p.id, p]));
    const real = jobAds.flatMap((ad) => {
      const posting = byId.get(ad.jobPostingId);
      if (!posting) return [];
      return [
        {
          ...ad,
          jobTitle: posting.title,
          companyName: posting.company,
          companyLogoUrl: posting.logoUrl,
          location: posting.location,
          jobType: posting.jobType,
        },
      ];
    });
    const samples = sampleJobAdFill(
      real.length,
      real.map((a) => a.companyName),
    ).map((sample) => {
      const listing = CURATED_JOB_POSTINGS.find((p) => p.company === sample.company && p.title === sample.jobTitle);
      return {
        id: `sample-${sample.company}-${sample.jobTitle}`,
        jobPostingId: listing?.id ?? "",
        mediaType: "image" as const,
        mediaUrl: sample.artwork,
        companyVerified: false,
        jobTitle: sample.jobTitle,
        companyName: sample.company,
        companyLogoUrl: sample.companyLogoUrl,
        location: sample.location,
        jobType: sample.jobType,
        selectable: !!listing && byId.has(listing.id),
      };
    });
    return [...real, ...samples];
  }, [jobAds, allPostings]);

  const resultsRef = useRef<HTMLDivElement>(null);
  // A featured job opens in the details panel: filters are cleared so it's
  // in the results, then the results are brought into view.
  function openFeaturedJob(id: string) {
    setSearchQuery("");
    setLocationQuery("");
    setLocationFilter(locations[0]);
    setTypeFilter(jobTypes[0]);
    setSelectedId(id);
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    requestAnimationFrame(() =>
      (wide ? resultsRef : detailRef).current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  const screeningPosting = screeningPostingId ? allPostings.find((p) => p.id === screeningPostingId) : undefined;

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
      <div className="relative z-[1] mx-auto max-w-[720px] text-center">
        {/* Wider than a typical centered pill section, so "Jobs posted on
            JobGiga" fits on one line at the hero's font size.
            A block wrapper, not just the inline-flex span itself — the h2
            below is display:inline-block (needed for the gradient-clip
            trick), so without this the pill and heading can share a text
            line and get centered together as one group instead of each
            getting its own row. */}
        <div>
          <span className="inline-flex items-center rounded-full bg-brand-gold-soft px-[14px] py-[7px] text-xs text-brand-gold-dark">
            Latest openings
          </span>
        </div>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{
            fontSize: "clamp(34px, 4vw, 56px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            // Same size and gold-into-teal gradient as the jobseeker landing
            // page's own hero heading ("Start With What You Already Have.").
            backgroundImage: "var(--brand-gradient-jobseeker)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            display: "inline-block",
            paddingBottom: "0.08em",
          }}
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

      <FeaturedJobAds ads={featuredAds} onSelect={openFeaturedJob} />

      <div
        className={`z-30 mx-auto flex w-full flex-col gap-[14px] bg-brand-gold-page py-[14px] lg:sticky lg:top-0 ${
          featuredAds.length > 0 ? "mt-[56px]" : "mt-[64px]"
        }`}
      >
        <div
          role="group"
          aria-label="Filter jobs by location and type"
          className="scrollbar-hide mx-auto flex w-fit max-w-full items-center gap-[4px] overflow-x-auto rounded-full border border-black/[0.1] p-[3px]"
        >
          {locations.map((location) => (
            <button
              key={location}
              type="button"
              role="radio"
              aria-checked={locationFilter === location}
              onClick={() => setLocationFilter(location)}
              className={`flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-[14px] text-sm transition-colors ${
                locationFilter === location
                  ? "bg-brand-gold text-[#141B2E]"
                  : "text-[#4B5468] hover:bg-black/[0.03]"
              }`}
            >
              {location}
            </button>
          ))}

          <span className="mx-[4px] h-[20px] w-px shrink-0 bg-black/[0.1]" />

          {jobTypes.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              className={`flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-[14px] text-sm transition-colors ${
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
          <div className="flex h-[58px] shrink-0 items-center gap-[10px] px-[18px] sm:flex-1">
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

          <div className="flex h-[58px] shrink-0 items-center gap-[10px] px-[18px] sm:flex-1">
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
        <div
          ref={resultsRef}
          // Clears the sticky search bar above when a featured job scrolls here.
          className="relative z-0 mx-auto mt-[32px] grid w-full scroll-mt-[16px] grid-cols-1 gap-[16px] lg:scroll-mt-[170px] lg:grid-cols-[340px_1fr] lg:items-start"
        >
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
                onClick={() => selectPosting(posting.id)}
              />
            ))}
          </div>

          <div ref={detailRef} className={`scroll-mt-[16px] lg:sticky lg:top-[150px] ${gradientFrameClass("gold")}`}>
            <div className="rounded-[19px] bg-white p-[16px] sm:p-[24px]">
              <JobPostingDetails posting={selectedPosting} />

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
                    <div className="mt-[24px] flex flex-wrap items-center gap-[8px]">
                      <button
                        type="button"
                        disabled={applied || applying}
                        onClick={() => startApply(selectedPosting)}
                        className="flex h-[42px] items-center rounded-full bg-brand-gold px-[22px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {applied ? "Applied" : applying ? "Applying…" : "Apply now"}
                      </button>
                      <SaveJobButton
                        // Remount per posting so the heart reflects that posting.
                        key={selectedPosting.id}
                        variant="pill"
                        jobPostingId={selectedPosting.id}
                        initialSaved={savedIds.has(selectedPosting.id)}
                        onChange={(saved) =>
                          setSavedIds((prev) => {
                            const next = new Set(prev);
                            if (saved) next.add(selectedPosting.id);
                            else next.delete(selectedPosting.id);
                            return next;
                          })
                        }
                      />
                    </div>
                    {applyError && <p className="mt-[8px] text-xs text-red-500">{applyError}</p>}
                    {applied && !hasVideoPitch && (
                      <p className="mt-[10px] rounded-[12px] bg-brand-gold-soft px-[12px] py-[8px] text-xs text-[#4B5468]">
                        🎥 Want to stand out? Add a 60-second video pitch — employers see it first.{" "}
                        <a href="/jobseeker/profile#video-pitch" className="text-brand-gold-dark underline">
                          Record it now
                        </a>
                      </p>
                    )}
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
                className="h-[34px] rounded-full border border-black/[0.1] text-sm text-[#4B5468] transition-colors aria-checked:border-brand-gold-dark aria-checked:bg-brand-gold-soft aria-checked:text-brand-gold-dark"
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
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-gold text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

      {screeningPosting && (
        <Modal
          ariaLabel="Screening questions"
          onClose={() => {
            setScreeningPostingId(null);
            setApplyError(null);
          }}
        >
          <h2 className="text-lg font-semibold text-[#141B2E]">Before you apply</h2>
          <p className="mt-[6px] text-xs text-[#4B5468]">
            {screeningPosting.company} set a few requirements for this role — answer them and we&rsquo;ll let you
            know how you match.
          </p>

          <div className="mt-[14px] flex flex-col gap-[12px]">
            {screeningPosting.minYearsExperience != null && (
              <label className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                Years of experience (requires {screeningPosting.minYearsExperience}+)
                <input
                  type="number"
                  min={0}
                  value={screeningAnswers.yearsExperience}
                  onChange={(e) =>
                    setScreeningAnswers((prev) => ({ ...prev, yearsExperience: e.target.value }))
                  }
                  className={formInputClass("gold")}
                />
              </label>
            )}

            {screeningPosting.minQualificationTier !== "No requirement" && (
              <label className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                Your highest education level (requires {screeningPosting.minQualificationTier}+)
                <Dropdown
                  label="Highest education level"
                  value={screeningAnswers.qualificationTier}
                  accent="gold"
                  options={[
                    { value: "", label: "Select" },
                    ...QUALIFICATION_TIERS.map((tier) => ({ value: tier, label: tier })),
                  ]}
                  onChange={(value) => setScreeningAnswers((prev) => ({ ...prev, qualificationTier: value }))}
                />
              </label>
            )}

            {screeningPosting.drivingLicense && (
              <label className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                Driving license (requires {DRIVING_LICENSE_LABEL[screeningPosting.drivingLicense] ?? screeningPosting.drivingLicense})
                <Dropdown
                  label="Driving license"
                  value={screeningAnswers.drivingLicense}
                  accent="gold"
                  options={[
                    { value: "", label: "Select" },
                    ...Object.entries(DRIVING_LICENSE_LABEL).map(([value, label]) => ({ value, label })),
                  ]}
                  onChange={(value) => setScreeningAnswers((prev) => ({ ...prev, drivingLicense: value }))}
                />
              </label>
            )}

            {(screeningPosting.screeningLanguages ?? screeningPosting.languages).map((required) => {
              const answerKey = `${required.language}|${required.dialect ?? ""}`;
              const name = formatLanguageRequirement(required.language, required.dialect);
              return (
                <label key={answerKey} className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                  {name} (requires {LANGUAGE_LEVEL_LABEL[required.level] ?? required.level}+)
                  <Dropdown
                    label={`${name} level`}
                    value={screeningAnswers.languageLevels[answerKey] ?? ""}
                    accent="gold"
                    options={[
                      { value: "", label: "Select" },
                      ...Object.entries(LANGUAGE_LEVEL_LABEL).map(([value, label]) => ({ value, label })),
                    ]}
                    onChange={(value) =>
                      setScreeningAnswers((prev) => ({
                        ...prev,
                        languageLevels: { ...prev.languageLevels, [answerKey]: value },
                      }))
                    }
                  />
                </label>
              );
            })}

            {screeningPosting.workAuthorizations.length > 0 && (
              <label className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                Work authorization (accepts{" "}
                {screeningPosting.workAuthorizations.map((w) => WORK_AUTHORIZATION_LABEL[w] ?? w).join(", ")})
                <Dropdown
                  label="Work authorization"
                  value={screeningAnswers.workAuthorization}
                  accent="gold"
                  options={[
                    { value: "", label: "Select" },
                    ...Object.entries(WORK_AUTHORIZATION_LABEL).map(([value, label]) => ({ value, label })),
                  ]}
                  onChange={(value) => setScreeningAnswers((prev) => ({ ...prev, workAuthorization: value }))}
                />
              </label>
            )}

            {screeningPosting.customQuestions.map((q) => {
              const setAnswer = (value: string) =>
                setScreeningAnswers((prev) => ({ ...prev, customAnswers: { ...prev.customAnswers, [q.id]: value } }));
              const value = screeningAnswers.customAnswers[q.id] ?? "";
              const type = questionType(q);
              const pillClass =
                "min-h-[34px] rounded-[10px] border border-black/[0.1] px-[12px] text-sm text-[#4B5468] transition-colors aria-pressed:border-brand-gold-dark aria-pressed:bg-brand-gold-soft aria-pressed:text-brand-gold-dark";
              return (
                <div key={q.id} className="flex flex-col gap-[4px] text-xs text-[#4B5468]">
                  {q.question}
                  {type === "choice" ? (
                    <div className="flex flex-wrap gap-[8px]">
                      {(q.options ?? []).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={value === option}
                          onClick={() => setAnswer(option)}
                          className={pillClass}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : type === "number" ? (
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setAnswer(e.target.value)}
                      aria-label={q.question}
                      className={formInputClass("gold")}
                    />
                  ) : type === "text" ? (
                    <textarea
                      value={value}
                      onChange={(e) => setAnswer(e.target.value)}
                      aria-label={q.question}
                      rows={3}
                      maxLength={1000}
                      className="w-full resize-none rounded-[12px] border border-black/[0.1] px-[14px] py-[10px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-gold-dark"
                    />
                  ) : (
                    <div className="flex gap-[8px]">
                      {(["yes", "no"] as const).map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          aria-pressed={value === choice}
                          onClick={() => setAnswer(choice)}
                          className={`${pillClass} flex-1`}
                        >
                          {choice === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {applyError && <p className="mt-[10px] text-xs text-red-500">{applyError}</p>}

          <div className="mt-[14px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={applying}
              onClick={() => apply(screeningPosting.id, screeningAnswers)}
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-gold text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying ? "Submitting…" : "Submit and apply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setScreeningPostingId(null);
                setApplyError(null);
              }}
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

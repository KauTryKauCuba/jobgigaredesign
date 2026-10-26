import { gradientFrameClass } from "./formStyles";
import PostingConditions from "./PostingConditions";
import RichTextContent from "./RichTextContent";
import { formatSalary, officeDaysLabel, REMOTE_LOCATION, startAvailabilityLabel } from "@/lib/job-posting-options";
import type { PostingContact } from "@/lib/posting-contact-types";
import { formatLanguageRequirement } from "@/lib/languages";
import { fullPostingAddress } from "@/lib/postingLocation";
import type { PublicCustomQuestion } from "@/lib/screening-questions";

// A job posting exactly as jobseekers see it on the jobseeker landing page —
// the browse card and the full details panel. Shared with the employer's
// "Preview as jobseeker" on the Post a job form so the two can't drift apart.

// A language, ONE dialect or none ("any dialect"), and the minimum level.
export type RequiredLanguage = { language: string; dialect?: string | null; level: string };

// Mirrors every field the employer "Post a job" form (EmployerJobsView)
// collects, so this can show the same depth of detail a jobseeker would
// actually see — not just the summary shown on the card.
export type JobPosting = {
  id: string;
  title: string;
  company: string;
  logoUrl: string | null;
  jobType: string;
  location: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  area?: string | null;
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
  // null means "no requirement" — distinct from 0 ("requires 0 years",
  // i.e. open to freshers), which is a real, meetable requirement that must
  // still show the screening question. Coalescing to 0 here previously
  // collapsed both cases together and hid the question for either.
  minYearsExperience: number | null;
  minQualificationTier: string;
  drivingLicense?: string;
  languages: RequiredLanguage[];
  // The languages the screening modal asks about — empty when the employer
  // listed languages on the posting but didn't switch on screening by them.
  // Absent on the static showcase postings, which screen by all of them.
  screeningLanguages?: RequiredLanguage[];
  // Benefits & working conditions, and the "Posted by" contact — absent on
  // the static showcase postings.
  benefits?: string[];
  startLabel?: string | null;
  workingHours?: string | null;
  officeDays?: string | null;
  contact?: PostingContact | null;
  workAuthorizations: string[];
  screeningEnabled: boolean;
  // requiredAnswer stays server-side (see CustomScreeningQuestion in
  // JobPostingHighlights) — a jobseeker shouldn't be able to read the
  // "correct" answer off the page.
  customQuestions: PublicCustomQuestion[];
};

export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
  temporary: "Temporary",
};
export const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};
export const WORK_AUTHORIZATION_LABEL: Record<string, string> = {
  citizen: "Malaysian citizen",
  permanent_resident: "Permanent resident",
  work_pass_holder: "Work pass holder",
  needs_sponsorship: "Open to sponsorship",
};
export const DRIVING_LICENSE_LABEL: Record<string, string> = {
  b2: "B2 (motorcycle)",
  b: "B (car)",
  d: "D (bus)",
  da: "DA (bus + trailer)",
  e: "E (lorry)",
};
export const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native",
};

function PlaceholderLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="14" height="9" rx="1.6" />
      <path d="M7 7V5.6C7 4.72 7.72 4 8.6 4h2.8c.88 0 1.6.72 1.6 1.6V7" />
    </svg>
  );
}

// Decorative-only, one-off icons for the card's footer row (no click
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

export function CompanyLogo({ url, className = "" }: { url: string | null; className?: string }) {
  if (!url) return <PlaceholderLogo className={className} />;
  // Company logos are stored as arbitrary uploaded URLs/data URIs (same
  // convention as EmployerOnboardingForm's own logo preview) — not a fixed
  // set of static assets next/image can optimize.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className} object-contain`} />;
}

// The browse card on the left of the jobseeker landing page's job list.
export function PostingCard({
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

/**
 * The full posting panel (right side of the jobseeker landing page's job
 * list): header, chips, description, skills, conditions, location map and
 * screening requirements. Actions (Apply/Save/Report) are the caller's.
 */
export default function JobPostingDetails({ posting }: { posting: JobPosting }) {
  // A remote role with no office address stores "Remote" as its location —
  // that's not a place, so it gets no map (it'd search for anything called
  // "Remote"), and no second "Remote" chip next to the workplace one.
  const isRemoteOnly = posting.location === REMOTE_LOCATION && !posting.addressLine1 && !posting.city;
  return (
    <>
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <p className="text-lg text-[#141B2E]">{posting.title}</p>
          <p className="mt-[4px] text-sm text-[#4B5468]">{posting.company}</p>
        </div>
        <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center">
          <CompanyLogo url={posting.logoUrl} className="h-[44px] w-[56px]" />
        </div>
      </div>

      <div className="mt-[16px] flex flex-wrap items-center gap-[8px] text-xs">
        <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.industry}</span>
        {!isRemoteOnly && (
          <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.location}</span>
        )}
        <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.jobType}</span>
        <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.workArrangement}</span>
        <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">{posting.salary}</span>
        <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px] text-[#4B5468]">
          {posting.openings} opening{posting.openings === 1 ? "" : "s"}
        </span>
        <span className="text-[#9AA3B2]">Posted {posting.postedAgo}</span>
      </div>

      <RichTextContent html={posting.description} className="mt-[20px] text-sm leading-[22px] text-[#4B5468]" />

      <div className="mt-[20px]">
        <p className="text-xs text-[#141B2E]">Job description</p>
        <RichTextContent html={posting.responsibilities} className="mt-[6px] text-sm leading-[22px] text-[#4B5468]" />
      </div>

      {posting.skills.length > 0 && (
        <div className="mt-[20px]">
          <p className="text-xs text-[#141B2E]">Skills required</p>
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {posting.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-brand-gold px-[12px] py-[6px] text-xs text-[#141B2E]">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {posting.softSkills.length > 0 && (
        <div className="mt-[16px]">
          <p className="text-xs text-[#141B2E]">Soft skills</p>
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {posting.softSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {posting.languages.length > 0 && (
        <div className="mt-[16px]">
          <p className="text-xs text-[#141B2E]">Languages</p>
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {posting.languages.map((l) => (
              <span
                key={`${l.language}|${l.dialect ?? ""}`}
                className="rounded-full bg-[#F1F4F8] px-[12px] py-[6px] text-xs text-[#141B2E]"
              >
                {formatLanguageRequirement(l.language, l.dialect)} · {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
              </span>
            ))}
          </div>
        </div>
      )}

      <PostingConditions
        benefits={posting.benefits ?? []}
        startLabel={posting.startLabel ?? null}
        workingHours={posting.workingHours ?? null}
        officeDays={posting.officeDays ?? null}
        contact={posting.contact ?? null}
      />

      {posting.location && (
        <div className="mt-[16px]">
          <p className="text-xs text-[#141B2E]">Location</p>
          <p className="mt-[2px] text-sm text-[#4B5468]">
            {isRemoteOnly ? "Remote — work from anywhere" : fullPostingAddress(posting)}
          </p>
          {!isRemoteOnly && (
            <iframe
              title={`Map for ${posting.location}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(fullPostingAddress(posting))}&output=embed`}
              loading="lazy"
              className="mt-[8px] h-[160px] w-full rounded-[12px] border border-black/[0.08]"
            />
          )}
        </div>
      )}

      {posting.screeningEnabled && (
        <div className="mt-[24px] border-t border-black/[0.06] pt-[16px]">
          <p className="text-sm text-[#141B2E]">Screening requirements</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">You&rsquo;ll be asked to answer these when you apply.</p>
          <div className="mt-[12px] grid grid-cols-1 gap-x-[20px] gap-y-[12px] sm:grid-cols-2">
            {posting.minYearsExperience != null && (
              <div>
                <p className="text-xs text-[#4B5468]">Minimum experience</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {posting.minYearsExperience} year{posting.minYearsExperience === 1 ? "" : "s"}
                </p>
              </div>
            )}
            {posting.minQualificationTier !== "No requirement" && (
              <div>
                <p className="text-xs text-[#4B5468]">Minimum education</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">{posting.minQualificationTier}</p>
              </div>
            )}
            {posting.drivingLicense && (
              <div>
                <p className="text-xs text-[#4B5468]">Driving license</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {DRIVING_LICENSE_LABEL[posting.drivingLicense] ?? posting.drivingLicense}
                </p>
              </div>
            )}
            {(posting.screeningLanguages ?? posting.languages).length > 0 && (
              <div>
                <p className="text-xs text-[#4B5468]">Languages required</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {(posting.screeningLanguages ?? posting.languages)
                    .map((l) => `${formatLanguageRequirement(l.language, l.dialect)} — ${LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}`)
                    .join(", ")}
                </p>
              </div>
            )}
            {posting.workAuthorizations.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[#4B5468]">Accepted work authorization</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {posting.workAuthorizations.map((w) => WORK_AUTHORIZATION_LABEL[w] ?? w).join(", ")}
                </p>
              </div>
            )}
            {posting.customQuestions.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[#4B5468]">Additional questions</p>
                <p className="mt-[2px] text-sm text-[#141B2E]">
                  {posting.customQuestions.length} question{posting.customQuestions.length === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// A job_postings row (plus company) as the jobseeker-facing pages receive it.
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
    area?: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: string;
    openings: number;
    skills: string[];
    softSkills: string[];
    minYearsExperience: number | null;
    minQualificationTier: string | null;
    languages: { language: string; dialect?: string | null; level: string }[];
    askLanguages?: boolean;
    benefits?: string[];
    startAvailability?: string | null;
    workingHours?: string | null;
    officeDaysPerWeek?: number | null;
    contact?: PostingContact | null;
    workAuthorizations: string[];
    drivingLicense: string | null;
    screeningEnabled: boolean;
    // Stripped of requiredAnswer before this ever reaches the client (see
    // jobseeker/page.tsx) — the page's initial props are visible in the
    // page source, so the "correct" answer can never travel in this shape.
    customScreeningQuestions: PublicCustomQuestion[];
    createdAt: string;
  };
  companyName: string;
  companyLogoUrl: string | null;
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

// Turns a posting row into what the card and details panel show.
export function toJobPosting(row: ActivePostingRow): JobPosting {
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
    area: posting.area,
    city: posting.city,
    state: posting.state,
    postcode: posting.postcode,
    salary: formatSalary(posting.salaryMin, posting.salaryMax, posting.salaryPeriod, "long") ?? "Salary not disclosed",
    postedAgo: relativeTimeAgo(posting.createdAt),
    description: posting.description,
    responsibilities: posting.responsibilities,
    industry: posting.industry ?? "Not specified",
    workArrangement: WORK_ARRANGEMENT_LABEL[posting.workArrangement] ?? posting.workArrangement,
    openings: posting.openings,
    skills: posting.skills,
    softSkills: posting.softSkills,
    minYearsExperience: posting.minYearsExperience,
    minQualificationTier: posting.minQualificationTier ?? "No requirement",
    // Kept as raw values (not label-mapped here) — the screening modal needs
    // the same raw values the posting stored to submit as answers; the
    // display block below maps them to labels at render time instead.
    drivingLicense: posting.drivingLicense ?? undefined,
    languages: posting.languages,
    screeningLanguages: posting.askLanguages === false ? [] : posting.languages,
    benefits: posting.benefits ?? [],
    startLabel: startAvailabilityLabel(posting.startAvailability),
    workingHours: posting.workingHours ?? null,
    officeDays: posting.workArrangement === "hybrid" ? officeDaysLabel(posting.officeDaysPerWeek) : null,
    contact: posting.contact ?? null,
    workAuthorizations: posting.workAuthorizations,
    screeningEnabled: posting.screeningEnabled,
    customQuestions: posting.customScreeningQuestions,
  };
}

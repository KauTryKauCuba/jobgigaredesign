import "server-only";
import type { getJobPostingForEmployer } from "./job-postings";

export const POSTER_STYLES = ["playful", "photo_corporate"] as const;
export type PosterStyle = (typeof POSTER_STYLES)[number];

export function isPosterStyle(value: unknown): value is PosterStyle {
  return typeof value === "string" && (POSTER_STYLES as readonly string[]).includes(value);
}

export function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Rich-text fields (responsibilities) store sanitized HTML — stripped down
// to plain lines here since the AI prompt is plain text, not markup. Good
// enough for a handful of bullet lines; not a general-purpose HTML-to-text
// converter.
export function htmlToLines(html: string, maxLines: number): string[] {
  const text = html
    .replace(/<\/(p|li|div|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

export type PostingContent = {
  requirementLines: string[];
  responsibilityLines: string[];
  location: string;
  salaryLine: string;
  employmentType: string;
  title: string;
};

export function derivePostingContent(
  posting: NonNullable<Awaited<ReturnType<typeof getJobPostingForEmployer>>>,
): PostingContent {
  const requirementLines = [
    ...posting.skills.slice(0, 3).map((s) => `Proficiency in ${s}`),
    // `!= null` (not truthy) — 0 is a real, meetable requirement ("open to
    // freshers"), not "no requirement", and was previously dropped silently.
    posting.minYearsExperience != null
      ? posting.minYearsExperience > 0
        ? `${posting.minYearsExperience}+ years experience`
        : "Open to fresh graduates"
      : null,
    posting.minQualificationTier ? `${humanize(posting.minQualificationTier)} qualification` : null,
  ].filter((line): line is string => !!line);

  const salaryLine =
    posting.salaryMin != null && posting.salaryMax != null
      ? `RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
      : "Salary undisclosed";

  return {
    requirementLines: requirementLines.length > 0 ? requirementLines : ["See full posting on JobGiga"],
    responsibilityLines: htmlToLines(posting.responsibilities, 4),
    location: posting.location,
    salaryLine,
    employmentType: humanize(posting.employmentType),
    title: posting.title,
  };
}

export type CompanyInfo = { name: string; contactEmail: string | null; hasLogo: boolean };

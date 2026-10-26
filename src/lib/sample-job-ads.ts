import { AD_SLOTS } from "./ad-slots";
import { CURATED_COMPANIES } from "./curated-companies";

// Sample job posting ads for the jobseeker page's "Featured jobs" row — like
// the employer page's Company spotlight samples, they fill the slots real
// job ads don't use yet, so a young platform's row never looks empty. All
// for the curated showcase companies (src/lib/curated-companies.ts), with our
// own square artwork (public/ads/showcase-jobs); roles and pay are
// illustrative. The first six match the sample listings in
// JobPostingHighlights' CURATED_JOB_POSTINGS (same company and title), so
// picking one opens that listing while it's shown.

export type SampleJobAd = {
  company: string;
  jobTitle: string;
  location: string;
  jobType: string;
  artwork: string;
};

export const SAMPLE_JOB_ADS: SampleJobAd[] = [
  { company: "aikido", jobTitle: "Security Engineer", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/aikido.svg" },
  { company: "Bolt", jobTitle: "Backend Engineer", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/bolt.svg" },
  { company: "Parim", jobTitle: "Customer Success Manager", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/parim.svg" },
  { company: "parcelly", jobTitle: "Operations Coordinator", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/parcelly.svg" },
  { company: "ParcelTracker", jobTitle: "Frontend Engineer", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/parceltracker.svg" },
  { company: "WHALE", jobTitle: "Content Designer", location: "Remote", jobType: "Full time", artwork: "/ads/showcase-jobs/whale.svg" },
  { company: "aikido", jobTitle: "Product Designer", location: "Kuala Lumpur", jobType: "Full time", artwork: "/ads/showcase-jobs/aikido-designer.svg" },
  { company: "Bolt", jobTitle: "Data Analyst", location: "Petaling Jaya", jobType: "Full time", artwork: "/ads/showcase-jobs/bolt-analyst.svg" },
  { company: "Parim", jobTitle: "Sales Executive", location: "Cyberjaya", jobType: "Full time", artwork: "/ads/showcase-jobs/parim-sales.svg" },
  { company: "WHALE", jobTitle: "Marketing Lead", location: "Bangsar South", jobType: "Full time", artwork: "/ads/showcase-jobs/whale-marketing.svg" },
];

const LOGOS = new Map(CURATED_COMPANIES.map((c) => [c.name, c.src]));

/**
 * The samples to show next to `realCount` real job ads: enough to fill the
 * slots, skipping companies that already have a real ad (a real company with
 * a showcase name, e.g. the ParcelTracker/WHALE demo companies, shows as itself).
 */
export function sampleJobAdFill(realCount: number, realCompanyNames: string[] = []) {
  const taken = new Set(realCompanyNames.map((n) => n.trim().toLowerCase()));
  return SAMPLE_JOB_ADS.filter((s) => !taken.has(s.company.toLowerCase()))
    .slice(0, Math.max(0, AD_SLOTS - realCount))
    .map((s) => ({ ...s, companyLogoUrl: LOGOS.get(s.company) ?? null }));
}

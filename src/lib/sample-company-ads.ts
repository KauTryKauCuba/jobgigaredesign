import { AD_SLOTS } from "./ad-slots";
import { CURATED_COMPANIES } from "./curated-companies";

// Sample company ads for the employer page's Company spotlight: they fill
// every slot real ads don't use (AD_SLOTS in all), like the jobseeker page's
// Featured jobs samples (src/lib/sample-job-ads.ts). Each curated showcase
// company's own sample ad first, then a second one for four of them (our own
// 16:9 artwork in public/ads/showcase; headlines are illustrative).

const EXTRA_ADS: { company: string; ad: string; adHeadline: string }[] = [
  { company: "aikido", ad: "/ads/showcase/aikido-2.svg", adHeadline: "Ship secure code without slowing down" },
  { company: "Bolt", ad: "/ads/showcase/bolt-2.svg", adHeadline: "Move faster with a team that ships daily" },
  { company: "Parim", ad: "/ads/showcase/parim-2.svg", adHeadline: "Make every shift run smoother" },
  { company: "WHALE", ad: "/ads/showcase/whale-2.svg", adHeadline: "Turn know-how into a team superpower" },
];

const SAMPLE_COMPANY_ADS = [
  ...CURATED_COMPANIES.map((c) => ({ company: c, ad: c.ad, adHeadline: c.adHeadline })),
  ...EXTRA_ADS.flatMap((extra) => {
    const company = CURATED_COMPANIES.find((c) => c.name === extra.company);
    return company ? [{ company, ad: extra.ad, adHeadline: extra.adHeadline }] : [];
  }),
];

/**
 * The sample ads to show next to `realCount` real ones: enough to fill the
 * slots, skipping companies that already have a real ad (a real company with
 * a showcase name, e.g. the ParcelTracker/WHALE demo companies, shows as itself).
 */
export function sampleCompanyAdFill(realCount: number, realCompanyNames: string[] = []) {
  const taken = new Set(realCompanyNames.map((n) => n.trim().toLowerCase()));
  return SAMPLE_COMPANY_ADS.filter((s) => !taken.has(s.company.name.toLowerCase()))
    .slice(0, Math.max(0, AD_SLOTS - realCount))
    .map((s) => ({
      id: `sample-${s.ad}`,
      mediaType: "image" as const,
      mediaUrl: s.ad,
      headline: s.adHeadline,
      companyName: s.company.name,
      companyLogoUrl: s.company.src,
      companyIndustry: s.company.industry,
    }));
}

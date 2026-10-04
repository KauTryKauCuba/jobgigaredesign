// Curated showcase companies — real, verified outside companies (logos from
// their own sites) used to fill out "who's hiring" displays while JobGiga
// still has few real employers. "openRoles", "location" and "companySize"
// are illustrative for every one — not the companies' actual figures.
// Shared by the employer landing page's logo row (CompanyHighlights) and the
// public Find companies directory, so both use the same set and fill logic.

export type CuratedCompany = {
  name: string;
  industry: string;
  openRoles: number;
  location: string;
  companySize: string;
  src: string;
  width: number;
  height: number;
};

export const CURATED_COMPANIES: CuratedCompany[] = [
  {
    name: "aikido",
    industry: "Cybersecurity",
    openRoles: 8,
    location: "Kuala Lumpur",
    companySize: "51-200",
    src: "/logos/aikido.svg",
    width: 88,
    height: 20,
  },
  {
    name: "Bolt",
    industry: "Fintech",
    openRoles: 5,
    location: "Petaling Jaya, Selangor",
    companySize: "201-500",
    src: "/logos/bolt.jpg",
    width: 132,
    height: 64,
  },
  {
    name: "Parim",
    industry: "Workforce management",
    openRoles: 12,
    location: "Cyberjaya, Selangor",
    companySize: "51-200",
    src: "/logos/parim.svg",
    width: 104,
    height: 32,
  },
  {
    name: "parcelly",
    industry: "Logistics",
    openRoles: 4,
    location: "Shah Alam, Selangor",
    companySize: "11-50",
    src: "/logos/parcelly.svg",
    width: 90,
    height: 31,
  },
  {
    name: "ParcelTracker",
    industry: "Business software",
    openRoles: 6,
    location: "Puchong, Selangor",
    companySize: "11-50",
    src: "/logos/parceltracker.svg",
    width: 168,
    height: 30,
  },
  {
    name: "WHALE",
    industry: "Process documentation software",
    openRoles: 7,
    location: "Bangsar South, Kuala Lumpur",
    companySize: "11-50",
    src: "/logos/whale.svg",
    width: 104,
    height: 22,
  },
];

// Real employers replace curated ones one slot at a time (first real company
// bumps the last curated one, second bumps the second-to-last, …) so a
// display never looks sparse early on, and the curated set disappears
// entirely once there are this many real companies.
export const CURATED_FILL_TARGET = 6;

/** The curated companies to show alongside `realCount` real ones. */
export function curatedFill(realCount: number, realNames: string[] = []): CuratedCompany[] {
  const taken = new Set(realNames.map((n) => n.trim().toLowerCase()));
  return CURATED_COMPANIES.slice(0, Math.max(0, CURATED_FILL_TARGET - realCount)).filter(
    // A real company with the same name (e.g. the ParcelTracker/WHALE demo
    // companies) is shown as itself, not twice.
    (c) => !taken.has(c.name.toLowerCase()),
  );
}

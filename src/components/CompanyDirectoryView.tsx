"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CompanyBanner from "./CompanyBanner";
import Dropdown from "./Dropdown";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon, SearchIcon } from "./icons";
import BadgeMedal from "./BadgeMedal";
import { BADGE_DEFINITIONS, type BadgeKey } from "@/lib/badge-definitions";
import { curatedFill, type CuratedCompany } from "@/lib/curated-companies";

export type DirectoryCompanyRow = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  industry: string;
  companySize: string;
  location: string | null;
  openRoles: number;
  badgeKeys: BadgeKey[];
};

const MAX_CARD_BADGES = 5;

/** The company's earned badges as small medals (hover for the name), in badge display order. */
function CardBadges({ keys }: { keys: BadgeKey[] }) {
  const earned = BADGE_DEFINITIONS.filter((b) => keys.includes(b.key));
  if (earned.length === 0) return null;
  const shown = earned.slice(0, MAX_CARD_BADGES);
  const extra = earned.length - shown.length;
  return (
    <div
      className="flex items-center gap-[2px] rounded-full bg-white/85 px-[6px] py-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur-sm"
      aria-label={`${earned.length} badge${earned.length === 1 ? "" : "s"}: ${earned.map((b) => b.label).join(", ")}`}
    >
      {shown.map((b) => (
        <span key={b.key} title={b.label} className="block w-[26px]">
          <BadgeMedal badge={b} earned />
        </span>
      ))}
      {extra > 0 && <span className="pl-[2px] pr-[2px] text-[11px] text-[#4B5468]">+{extra}</span>}
    </div>
  );
}

// A directory card — a real company (curated = null) or one of the curated
// showcase companies filling in while there are few real ones.
type DirectoryEntry = DirectoryCompanyRow & { curated: CuratedCompany | null };

const ALL = "__all__";

export function CompanyLogo({ url, size = 48 }: { url: string | null; size?: number }) {
  if (!url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-[12px] bg-[#E6F9FA] text-brand-teal-dark"
        style={{ width: size, height: size }}
      >
        <BuildingIcon className="h-[45%] w-[45%]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-[12px] bg-white object-contain p-[4px]"
      style={{ width: size, height: size }}
    />
  );
}

/** The public "Find companies" page: search, an industry filter and a grid of company cards. */
export default function CompanyDirectoryView({ companies }: { companies: DirectoryCompanyRow[] }) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState(ALL);
  const [hiringOnly, setHiringOnly] = useState(false);
  const term = search.trim().toLowerCase();

  // Real companies first, then the same curated showcase companies the
  // landing page uses, filling up to CURATED_FILL_TARGET while JobGiga has
  // few real employers (each real company that joins replaces one).
  const allCompanies: DirectoryEntry[] = useMemo(
    () => [
      ...companies.map((c) => ({ ...c, curated: null })),
      ...curatedFill(
        companies.length,
        companies.map((c) => c.companyName),
      ).map((c) => ({
        id: `curated-${c.name}`,
        companyName: c.name,
        logoUrl: c.src,
        bannerUrl: null,
        industry: c.industry,
        companySize: c.companySize,
        location: c.location,
        openRoles: c.openRoles,
        badgeKeys: [],
        curated: c,
      })),
    ],
    [companies],
  );

  const industryOptions = useMemo(
    () => [
      { value: ALL, label: "All industries" },
      ...[...new Set(allCompanies.map((c) => c.industry).filter(Boolean))].sort().map((i) => ({ value: i, label: i })),
    ],
    [allCompanies],
  );

  const visible = allCompanies.filter((c) => {
    if (hiringOnly && c.openRoles === 0) return false;
    if (industry !== ALL && c.industry !== industry) return false;
    if (!term) return true;
    return [c.companyName, c.industry, c.location].filter((v): v is string => !!v).some((v) => v.toLowerCase().includes(term));
  });
  const hiringCount = allCompanies.filter((c) => c.openRoles > 0).length;

  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <div className="flex flex-col gap-[8px] lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
            <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies by name, industry or location..."
              aria-label="Search companies"
              className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
          <div className="lg:w-[240px]">
            <Dropdown label="Industry" value={industry} options={industryOptions} onChange={setIndustry} searchable />
          </div>
          <label className="flex h-[38px] shrink-0 cursor-pointer items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] text-sm text-[#141B2E]">
            <input
              type="checkbox"
              checked={hiringOnly}
              onChange={(e) => setHiringOnly(e.target.checked)}
              className="h-[14px] w-[14px] accent-brand-teal-dark"
            />
            Hiring now
            <span className="text-xs text-[#9AA3B2]">({hiringCount})</span>
          </label>
        </div>

        <p className="mt-[16px] text-xs text-[#9AA3B2]">
          {visible.length} compan{visible.length === 1 ? "y" : "ies"}
          {term || industry !== ALL || hiringOnly ? " match your filters" : " on JobGiga"}
        </p>

        {visible.length === 0 ? (
          <p className="mt-[10px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#9AA3B2]">
            {allCompanies.length === 0 ? "No companies have joined yet — check back soon." : "No companies match these filters."}
          </p>
        ) : (
          <div className="mt-[10px] grid grid-cols-1 gap-[12px] sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => {
              const body = (
                <>
                  {/* Cover banner (or the grey fallback) with the logo
                      overlapping its bottom edge. */}
                  <div className="relative aspect-[3/1] w-full overflow-hidden">
                    <CompanyBanner url={c.bannerUrl} />
                    <div className="absolute top-[8px] right-[8px]">
                      <CardBadges keys={c.badgeKeys} />
                    </div>
                  </div>
                  <div className="flex items-end gap-[12px] px-[16px]">
                    <div className="relative -mt-[34px] shrink-0 rounded-[14px] bg-white p-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                      <CompanyLogo url={c.logoUrl} size={58} />
                    </div>
                    <div className="min-w-0 pb-[1px]">
                      <p className="truncate text-sm font-semibold text-[#141B2E] group-hover:text-brand-teal-dark">
                        {c.companyName}
                      </p>
                      <p className="truncate text-xs text-[#4B5468]">{c.industry}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-[6px] px-[16px] pb-[16px] text-xs">
                    {c.location && <span className="rounded-full bg-white px-[9px] py-[3px] text-[#4B5468]">{c.location}</span>}
                    {c.companySize && (
                      <span className="rounded-full bg-white px-[9px] py-[3px] text-[#4B5468]">{c.companySize} staff</span>
                    )}
                    <span
                      className={`ml-auto rounded-full px-[9px] py-[3px] ${
                        c.openRoles > 0 ? "bg-[#E7F6EC] text-[#2F9E56]" : "bg-[#F1F4F8] text-[#9AA3B2]"
                      }`}
                    >
                      {c.openRoles > 0 ? `${c.openRoles} open role${c.openRoles === 1 ? "" : "s"}` : "Not hiring right now"}
                    </span>
                  </div>
                </>
              );
              const cardClass =
                "flex flex-col gap-[12px] overflow-hidden rounded-[16px] border border-[#EAEDF2] bg-[#F8FAFB]";
              // Showcase companies have no JobGiga page to open.
              return c.curated ? (
                <div key={c.id} className={cardClass}>
                  {body}
                </div>
              ) : (
                <Link
                  key={c.id}
                  href={`/companies/${c.id}`}
                  className={`group ${cardClass} transition-colors hover:border-brand-teal-dark/40 hover:bg-white`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Dropdown from "./Dropdown";
import ResponsivenessBadge from "./ResponsivenessBadge";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { BuildingIcon, SearchIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import type { EmployerResponsiveness } from "@/lib/responsiveness";

type EmployerRow = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  contactName: string;
  contactEmail: string;
  email: string;
  industry: string;
  location: string;
  createdAt: string;
  jobPostingCount: number;
  applicationCount: number;
  waitingLong: number;
  responsiveness: EmployerResponsiveness | null;
};

type SortKey = "newest" | "waiting" | "slowest" | "applications";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "waiting", label: "Most applicants waiting" },
  { value: "slowest", label: "Slowest to reply" },
  { value: "applications", label: "Most applications" },
];

function Logo({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
        <BuildingIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-[10px] border border-[#EAEDF2] bg-white object-contain p-[3px]" />;
}

export default function SuperadminEmployersView({
  authUser,
  employers,
}: {
  authUser: AuthUser;
  employers: EmployerRow[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const searchTerm = search.trim().toLowerCase();

  const visible = useMemo(() => {
    const filtered = searchTerm
      ? employers.filter((e) =>
          [e.companyName, e.contactName, e.contactEmail, e.email, e.industry, e.location]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(searchTerm)),
        )
      : employers;
    const sorted = [...filtered];
    if (sort === "waiting") sorted.sort((a, b) => b.waitingLong - a.waitingLong);
    if (sort === "applications") sorted.sort((a, b) => b.applicationCount - a.applicationCount);
    // Employers without enough history to judge go last.
    if (sort === "slowest")
      sorted.sort((a, b) => (b.responsiveness?.medianHours ?? -1) - (a.responsiveness?.medianHours ?? -1));
    return sorted;
  }, [employers, searchTerm, sort]);

  const ghostingCount = employers.filter((e) => e.waitingLong > 0).length;

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="employers"
      heading="Employers"
      subheading="Every employer account on the platform — and how quickly each one replies to applicants."
    >
      <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <p className="text-sm text-[#141B2E]">All employers</p>
            <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">{employers.length}</span>
            {ghostingCount > 0 && (
              <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-[#A67C00]">
                {ghostingCount} with applicants waiting 3+ days
              </span>
            )}
          </div>

          <div className="mt-[14px] flex flex-col gap-[8px] sm:flex-row">
            <div className="flex flex-1 items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
              <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, contact, email, industry or location..."
                aria-label="Search employers"
                className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
              />
            </div>
            <div className="sm:w-[230px]">
              <Dropdown label="Sort by" value={sort} options={SORT_OPTIONS} onChange={setSort} />
            </div>
          </div>

          {employers.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">No employers have signed up yet.</p>
          ) : visible.length === 0 ? (
            <p className="mt-[14px] text-sm text-[#9AA3B2]">No employers match &ldquo;{search.trim()}&rdquo;.</p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visible.map((employer) => (
                <div
                  key={employer.id}
                  className="flex flex-col gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                    <Logo url={employer.logoUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#141B2E]">{employer.companyName}</p>
                      <p className="mt-[1px] truncate text-xs text-[#4B5468]">
                        {employer.industry || "Industry not set"} · {employer.location || "Location not set"}
                      </p>
                      <p className="mt-[1px] truncate text-xs text-[#9AA3B2]">
                        {employer.contactName} · {employer.contactEmail || employer.email}
                      </p>
                      <div className="mt-[6px] flex flex-wrap gap-[6px]">
                        {employer.responsiveness ? (
                          <ResponsivenessBadge responsiveness={employer.responsiveness} showRate />
                        ) : (
                          employer.applicationCount > 0 && (
                            <span className="rounded-full bg-[#F1F4F8] px-[9px] py-[3px] text-xs text-[#9AA3B2]">
                              Not enough history to rate replies
                            </span>
                          )
                        )}
                        {employer.waitingLong > 0 && (
                          <span className="rounded-full bg-[#FFF3D6] px-[9px] py-[3px] text-xs text-[#A67C00]">
                            {employer.waitingLong} applicant{employer.waitingLong === 1 ? "" : "s"} waiting 3+ days
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-[6px] text-xs text-[#9AA3B2] sm:flex-col sm:items-end sm:gap-[4px]">
                    <span className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark">
                      {employer.jobPostingCount} posting{employer.jobPostingCount === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">
                      {employer.applicationCount} application{employer.applicationCount === 1 ? "" : "s"}
                    </span>
                    <span>Joined {new Date(employer.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperadminDashboardShell>
  );
}

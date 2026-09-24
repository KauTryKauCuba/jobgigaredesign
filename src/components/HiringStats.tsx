"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";
import { gradientFrameClass } from "./formStyles";
import { BuildingIcon } from "./icons";
import { relativeTimeAgo } from "@/lib/applicationStatus";

type HiringCompany = {
  companyName: string;
  industry: string;
  location: string;
  logoUrl: string | null;
  activeCount: number;
  totalCount: number;
};

type LatestPosting = {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  createdAt: string;
};

type LatestActivity = {
  id: string;
  status: string;
  jobTitle: string;
  companyName: string;
  companyLogoUrl: string | null;
  updatedAt: string;
};

const PAGE_ORDER = ["hiring", "posted", "activity"] as const;
type Page = (typeof PAGE_ORDER)[number];

// Padding for a young platform with few real postings so far — clearly
// placeholder-flavored names, not passed off as real companies. Drop these
// once there are consistently 5+ real employers with postings.
const DUMMY_COMPANIES: HiringCompany[] = [
  { companyName: "Northwind Retail Group", industry: "Retail", location: "Petaling Jaya, Selangor", logoUrl: null, activeCount: 2, totalCount: 2 },
  { companyName: "Cempaka Health Clinics", industry: "Healthcare", location: "Kuala Lumpur", logoUrl: null, activeCount: 1, totalCount: 1 },
  { companyName: "Bintang Logistics", industry: "Logistics", location: "Shah Alam, Selangor", logoUrl: null, activeCount: 4, totalCount: 5 },
  { companyName: "Lumino Software Studio", industry: "Technology", location: "Cyberjaya", logoUrl: null, activeCount: 3, totalCount: 3 },
  { companyName: "Sentosa Hospitality Group", industry: "Hospitality", location: "George Town, Penang", logoUrl: null, activeCount: 2, totalCount: 2 },
];

// Same padding intent as DUMMY_COMPANIES above, just shaped for the "Just
// posted" page — plausible relative times so the page doesn't look frozen.
const DUMMY_POSTINGS: LatestPosting[] = [
  { id: "dummy-1", title: "Retail Store Supervisor", companyName: "Northwind Retail Group", companyLogoUrl: null, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: "dummy-2", title: "Clinic Front Desk Executive", companyName: "Cempaka Health Clinics", companyLogoUrl: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "dummy-3", title: "Warehouse Operations Lead", companyName: "Bintang Logistics", companyLogoUrl: null, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "dummy-4", title: "Frontend Engineer", companyName: "Lumino Software Studio", companyLogoUrl: null, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: "dummy-5", title: "Guest Relations Executive", companyName: "Sentosa Hospitality Group", companyLogoUrl: null, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
];

// Same padding intent again, for the "Latest activity" page — no candidate
// identity here (real rows don't carry one either, see
// getLatestShortlistAndInterviewActivity), just proof employers are moving
// people through their pipeline.
const DUMMY_ACTIVITY: LatestActivity[] = [
  { id: "dummy-1", status: "shortlisted", jobTitle: "Retail Store Supervisor", companyName: "Northwind Retail Group", companyLogoUrl: null, updatedAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: "dummy-2", status: "interview", jobTitle: "Frontend Engineer", companyName: "Lumino Software Studio", companyLogoUrl: null, updatedAt: new Date(Date.now() - 7 * 3600000).toISOString() },
  { id: "dummy-3", status: "shortlisted", jobTitle: "Warehouse Operations Lead", companyName: "Bintang Logistics", companyLogoUrl: null, updatedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: "dummy-4", status: "interview", jobTitle: "Guest Relations Executive", companyName: "Sentosa Hospitality Group", companyLogoUrl: null, updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: "dummy-5", status: "shortlisted", jobTitle: "Clinic Front Desk Executive", companyName: "Cempaka Health Clinics", companyLogoUrl: null, updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
];

const PAGE_COPY: Record<Page, { title: string; subtitle: string }> = {
  hiring: { title: "Companies already hiring here", subtitle: "Real teams screening real candidates with AI, right now." },
  posted: { title: "Just posted", subtitle: "The newest roles added to the platform." },
  activity: { title: "Moving fast", subtitle: "Candidates being shortlisted and interviewed, right now." },
};

function CompanyLogo({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#E6F9FA]">
        <BuildingIcon className="h-[16px] w-[16px] text-brand-teal-dark" />
      </div>
    );
  }
  // Company logos are arbitrary uploaded URLs/data URIs, same convention as
  // the employer onboarding logo preview — not a fixed set of static assets.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[34px] w-[34px] shrink-0 rounded-[10px] object-contain" />;
}

export default function HiringStats({
  hiringCompanies,
  latestPostings,
  latestActivity,
  isSignedInEmployer,
}: {
  hiringCompanies: HiringCompany[];
  latestPostings: LatestPosting[];
  latestActivity: LatestActivity[];
  isSignedInEmployer: boolean;
}) {
  const router = useRouter();
  const [showSignup, setShowSignup] = useState(false);
  const [page, setPage] = useState<Page>("hiring");

  // Auto-rotates between the three pages instead of a manual tab control —
  // paused while the signup modal is open so it doesn't flip pages behind a
  // dialog the visitor is actively filling in.
  useEffect(() => {
    if (showSignup) return;
    const id = setInterval(() => {
      setPage((prev) => PAGE_ORDER[(PAGE_ORDER.indexOf(prev) + 1) % PAGE_ORDER.length]);
    }, 6000);
    return () => clearInterval(id);
  }, [showSignup]);

  const displayCompanies =
    hiringCompanies.length >= 5
      ? hiringCompanies
      : [...hiringCompanies, ...DUMMY_COMPANIES.slice(0, 5 - hiringCompanies.length)];
  const displayPostings =
    latestPostings.length >= 5
      ? latestPostings
      : [...latestPostings, ...DUMMY_POSTINGS.slice(0, 5 - latestPostings.length)];
  const displayActivity =
    latestActivity.length >= 5
      ? latestActivity
      : [...latestActivity, ...DUMMY_ACTIVITY.slice(0, 5 - latestActivity.length)];

  return (
    <div className={`mx-auto mt-[24px] w-full max-w-[440px] ${gradientFrameClass("teal")}`}>
      <div className="rounded-[19px] bg-white p-[22px] text-left">
        <p className="text-sm text-[#141B2E]">{PAGE_COPY[page].title}</p>
        <p className="mt-[2px] text-xs leading-[19px] text-[#4B5468]">{PAGE_COPY[page].subtitle}</p>

        {page === "hiring" && (
          <div className="mt-[14px] flex flex-col gap-[10px]">
            {displayCompanies.map((company) => (
              <div
                key={company.companyName}
                className="flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] px-[12px] py-[10px]"
              >
                <CompanyLogo url={company.logoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#141B2E]">{company.companyName}</p>
                  <p className="truncate text-xs text-[#9AA3B2]">
                    {company.industry} · {company.location}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E6F9FA] px-[9px] py-[3px] text-xs text-brand-teal-dark">
                  {company.activeCount > 0
                    ? `${company.activeCount} live role${company.activeCount === 1 ? "" : "s"}`
                    : "Getting started"}
                </span>
              </div>
            ))}
          </div>
        )}

        {page === "posted" && (
          <div className="mt-[14px] flex flex-col gap-[10px]">
            {displayPostings.map((posting) => (
              <div
                key={posting.id}
                className="flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] px-[12px] py-[10px]"
              >
                <CompanyLogo url={posting.companyLogoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#141B2E]">{posting.title}</p>
                  <p className="truncate text-xs text-[#9AA3B2]">{posting.companyName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E6F9FA] px-[9px] py-[3px] text-xs text-brand-teal-dark">
                  {relativeTimeAgo(posting.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        {page === "activity" && (
          <div className="mt-[14px] flex flex-col gap-[10px]">
            {displayActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] px-[12px] py-[10px]"
              >
                <CompanyLogo url={activity.companyLogoUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#141B2E]">{activity.companyName}</p>
                  <p className="truncate text-xs text-[#9AA3B2]">
                    {activity.status === "interview" ? "Interviewing for" : "Shortlisted for"} {activity.jobTitle}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#E6F9FA] px-[9px] py-[3px] text-xs text-brand-teal-dark">
                  {relativeTimeAgo(activity.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Purely a "which page am I on" indicator — the rotation itself is
            automatic (see the interval above), not driven by clicking these. */}
        <div aria-hidden className="mt-[14px] flex items-center justify-center gap-[6px]">
          {PAGE_ORDER.map((tab) => (
            <span
              key={tab}
              className={`h-[6px] rounded-full transition-all ${
                page === tab ? "w-[18px] bg-brand-teal-dark" : "w-[6px] bg-black/[0.12]"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isSignedInEmployer ? router.push("/employer/jobs") : setShowSignup(true))}
          className="mt-[16px] flex h-[38px] w-full items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90"
        >
          {isSignedInEmployer ? "Manage your jobs" : "Join the list"}
        </button>

        {showSignup && (
          <AuthModal
            mode="get-started"
            initialRole="employer"
            lockRole
            onClose={() => setShowSignup(false)}
            onAuthenticated={() => setShowSignup(false)}
          />
        )}
      </div>
    </div>
  );
}

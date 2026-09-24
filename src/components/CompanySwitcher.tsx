"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, ChevronDownIcon } from "./icons";

type Company = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  role: "owner" | "admin";
  ownerName: string;
  industry: string;
  companySize: string;
  joinedAt: string;
};

const ROLE_LABEL: Record<Company["role"], string> = { owner: "Owner", admin: "Admin" };
const ROLE_PILL: Record<Company["role"], string> = {
  owner: "bg-[#FFF3D6] text-[#A67C00]",
  admin: "bg-[#E6F9FA] text-[#008990]",
};

function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// Dispatched by anything that adds/removes a company the current user has
// access to (currently just the "Get/Remove dummy data" buttons) so this
// switcher — mounted once in EmployerDashboardShell, fetching its own data
// independently of the page's server components — knows to refetch.
// router.refresh() alone doesn't reach it: that only re-runs server
// components, and this component's own mount-time fetch never re-fires on
// its own without something telling it to.
export const COMPANIES_CHANGED_EVENT = "employer:companies-changed";

// Every employer page renders EmployerDashboardShell itself rather than
// sharing a persisted layout.tsx, so this component fully unmounts and
// remounts on every sidebar click — without this, each of those remounts
// started from `null` and popped the switcher in once its fetch resolved,
// reading as the whole sidebar area flickering on every single navigation.
// Module-scope state survives that remount (the module itself isn't
// re-evaluated on a client-side route change, only the component tree is),
// so a first mount in this page load still fetches fresh, but every
// remount after that renders with data already in hand — refetching in the
// background to stay current, never flashing back to empty first.
let cachedCompanies: Company[] | null = null;
let cachedCurrentId: string | null = null;

function CompanyLogo({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F4F8] text-[#9AA3B2]">
        <BuildingIcon className="h-[13px] w-[13px]" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full object-cover" />;
}

// Self-fetching and self-contained so it can drop into EmployerDashboardShell
// once, rather than every employer page having to fetch and pass company
// lists down. Renders nothing for the common case (one company, nothing to
// switch between) — only shows up once someone actually belongs to more
// than one.
export default function CompanySwitcher() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(cachedCompanies);
  const [currentId, setCurrentId] = useState<string | null>(cachedCurrentId);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refetch() {
      fetch("/api/employer/companies")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          cachedCompanies = data.companies;
          cachedCurrentId = data.currentId;
          setCompanies(data.companies);
          setCurrentId(data.currentId);
        })
        .catch(() => {});
    }
    refetch();
    window.addEventListener(COMPANIES_CHANGED_EVENT, refetch);
    return () => window.removeEventListener(COMPANIES_CHANGED_EVENT, refetch);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function switchTo(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/employer/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerProfileId: id }),
      });
      if (res.ok) {
        cachedCurrentId = id;
        setCurrentId(id);
        setOpen(false);
        // Every server component under this layout resolved its data from
        // the old session cookie value — a client-side route change alone
        // wouldn't re-run any of that, only a full refresh does.
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  // Covers both "still loading" and "just one company" — no flash of an
  // unusable single-item switcher while the fetch is in flight.
  if (!companies || companies.length < 2) return null;

  const current = companies.find((c) => c.id === currentId) ?? companies[0];

  return (
    <div ref={menuRef} className="relative shrink-0 rounded-[14px] border border-[#EAEDF2] bg-white p-[22px]">
      <div className="flex items-center justify-between gap-[8px]">
        <p className="text-xs text-[#4B5468]">Company</p>
        <div className="flex shrink-0 items-center gap-[6px]">
          <span className={`rounded-full px-[9px] py-[3px] text-xs ${ROLE_PILL[current.role]}`}>
            {ROLE_LABEL[current.role]}
          </span>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? "Hide company details" : "Show company details"}
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05]"
          >
            <ChevronDownIcon className={`h-[9px] w-[9px] transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      <div className="mt-[14px] flex items-center gap-[10px]">
        <CompanyLogo url={current.logoUrl} />
        <span className="min-w-0 flex-1 truncate text-sm text-[#141B2E]">{current.companyName}</span>
      </div>

      {detailsOpen && (
        <div className="mt-[12px] flex flex-col gap-[4px] text-xs text-[#4B5468]">
          <p>
            <span className="text-[#9AA3B2]">Owner:</span> {current.ownerName}
          </p>
          <p>
            <span className="text-[#9AA3B2]">Joined:</span> {formatJoinedDate(current.joinedAt)}
          </p>
          <p>
            <span className="text-[#9AA3B2]">Industry:</span> {current.industry}
          </p>
          <p>
            <span className="text-[#9AA3B2]">Size:</span> {current.companySize} employees
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={switching}
        className="mt-[14px] flex w-full items-center justify-center gap-[4px] rounded-full border border-[#EAEDF2] px-[10px] py-[5px] text-xs text-[#4B5468] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Change company
        <ChevronDownIcon className="h-[8px] w-[8px] shrink-0 text-[#9AA3B2]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] left-0 z-30 w-full min-w-[220px] rounded-[14px] border border-black/[0.06] bg-white py-[6px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              role="menuitem"
              onClick={() => switchTo(company.id)}
              className={`flex w-full items-center gap-[10px] px-[14px] py-[9px] text-left text-sm hover:bg-black/[0.03] ${
                company.id === current.id ? "text-[#141B2E]" : "text-[#4B5468]"
              }`}
            >
              <CompanyLogo url={company.logoUrl} />
              <span className="min-w-0 flex-1 truncate">{company.companyName}</span>
              <span className="shrink-0 text-xs text-[#9AA3B2]">{ROLE_LABEL[company.role]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { BuildingIcon, ChevronDownIcon, PlusIcon } from "./icons";
import { TEAM_ROLE_LABEL, TEAM_ROLE_PILL, type TeamRole } from "@/lib/team-roles";

type Company = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  role: TeamRole;
  ownerName: string;
  industry: string;
  companySize: string;
  joinedAt: string;
};

const ROLE_LABEL = TEAM_ROLE_LABEL;
const ROLE_PILL = Object.fromEntries(
  Object.entries(TEAM_ROLE_PILL).map(([role, pill]) => [role, `${pill.bg} ${pill.text}`]),
) as Record<TeamRole, string>;

function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

// Dispatched by anything that adds/removes a company the current user has
// access to (currently just My Profile's "Add/Remove sample data" card) so this
// switcher — mounted once in EmployerDashboardShell, fetching its own data
// independently of the page's server components — knows to refetch.
// router.refresh() alone doesn't reach it: that only re-runs server
// components, and this component's own mount-time fetch never re-fires on
// its own without something telling it to.
export const COMPANIES_CHANGED_EVENT = "employer:companies-changed";

// Dispatched after switching to another company, for client components that
// fetch per-company state themselves (e.g. the sample-data bar).
export const COMPANY_SWITCHED_EVENT = "employer:company-switched";

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
type CompanyLimit = { used: number; limit: number; canAdd: boolean };
let cachedLimit: CompanyLimit | null = null;

function CompanyLogo({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F4F8] text-[#9AA3B2]">
        <BuildingIcon className="h-[13px] w-[13px]" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[26px] w-[26px] shrink-0 rounded-[7px] border border-[#EAEDF2] bg-white object-contain p-[2px]" />;
}

// Self-fetching and self-contained so it can drop into EmployerDashboardShell
// once, rather than every employer page having to fetch and pass company
// lists down. Renders nothing for the common case (one company, nothing to
// switch between) — only shows up once someone actually belongs to more
// than one.
export default function CompanySwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(cachedCompanies);
  const [currentId, setCurrentId] = useState<string | null>(cachedCurrentId);
  const [companyLimit, setCompanyLimit] = useState<CompanyLimit | null>(cachedLimit);
  const guardNavigation = useUnsavedChangesGuard();
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
          cachedLimit = data.companyLimit ?? null;
          setCompanies(data.companies);
          setCurrentId(data.currentId);
          setCompanyLimit(data.companyLimit ?? null);
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
        window.dispatchEvent(new Event(COMPANY_SWITCHED_EVENT));
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
    <div
      ref={menuRef}
      className={`emp-company-switcher relative shrink-0 rounded-[14px] border border-[#EAEDF2] bg-white py-[22px] ${
        collapsed ? "xl:h-[150px] xl:px-[6px]" : "px-[22px]"
      }`}
    >
      {/* Full card — always shown below xl (where collapse doesn't apply); at
          xl+ only when expanded. */}
      <div className={`emp-switcher-full ${collapsed ? "xl:hidden" : ""}`}>
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

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
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
          </div>
        </div>

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
      </div>

      {/* Collapsed — xl+ only, same outer height as the full card above
          (pinned via xl:h-[150px] on the wrapper), just the current
          company's logo, centered, still opening the same menu. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Switch company — currently ${current.companyName}`}
          title={current.companyName}
          disabled={switching}
          className="emp-switcher-collapsed hidden h-full w-full flex-col items-center justify-center gap-[6px] rounded-[10px] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60 xl:flex"
        >
          <CompanyLogo url={current.logoUrl} />
          <ChevronDownIcon className="h-[8px] w-[8px] shrink-0 text-[#9AA3B2]" />
        </button>
      )}

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
          {companyLimit && (
            <div className="mt-[6px] border-t border-black/[0.06] pt-[6px]">
              {companyLimit.canAdd ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    guardNavigation(() => router.push("/employer/companies/new"));
                  }}
                  className="flex w-full items-center gap-[10px] px-[14px] py-[9px] text-left text-sm text-brand-teal-dark hover:bg-black/[0.03]"
                >
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft">
                    <PlusIcon className="h-[10px] w-[10px]" />
                  </span>
                  Add a company
                </button>
              ) : (
                <p className="px-[14px] py-[9px] text-xs leading-[17px] text-[#9AA3B2]">
                  You&rsquo;ve reached your limit of {companyLimit.limit} companies. Contact JobGiga to add more.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

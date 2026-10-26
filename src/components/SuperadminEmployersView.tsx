"use client";

import { useMemo, useState } from "react";
import Dropdown from "./Dropdown";
import Modal from "./Modal";
import ResponsivenessBadge from "./ResponsivenessBadge";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import VerifiedBadge, { VerifiedBadgeIcon } from "./VerifiedBadge";
import { BuildingIcon, SearchIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import type { EmployerResponsiveness } from "@/lib/responsiveness";

type SsmStatus = "unverified" | "pending" | "verified" | "rejected";

type CompanyLimit = { used: number; limit: number; custom: boolean; canAdd: boolean };

const DEFAULT_COMPANY_LIMIT = 5;

type EmployerRow = {
  id: string;
  userId: string;
  ownerCompanyLimit: CompanyLimit | null;
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
  ssmNumber: string;
  ssmDocumentUrl: string | null;
  ssmVerificationStatus: SsmStatus;
  ssmRejectionReason: string | null;
};

type SortKey = "newest" | "waiting" | "slowest" | "applications" | "ssmPending";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "waiting", label: "Most applicants waiting" },
  { value: "slowest", label: "Slowest to reply" },
  { value: "applications", label: "Most applications" },
  { value: "ssmPending", label: "SSM pending review first" },
];

function Logo({ url, verified }: { url: string | null; verified: boolean }) {
  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-[38px] w-[38px] rounded-[10px] border border-[#EAEDF2] bg-white object-contain p-[3px]" />
      ) : (
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand-teal-soft text-brand-teal-dark">
          <BuildingIcon className="h-[16px] w-[16px]" />
        </div>
      )}
      {verified && <VerifiedBadge size={14} />}
    </div>
  );
}

const SSM_STATUS_LABEL: Record<SsmStatus, string> = {
  unverified: "No SSM document",
  pending: "SSM pending review",
  verified: "SSM verified",
  rejected: "SSM rejected",
};
const SSM_STATUS_CLASS: Record<SsmStatus, string> = {
  unverified: "bg-[#F1F4F8] text-[#9AA3B2]",
  pending: "bg-[#FFF3D6] text-[#A67C00]",
  verified: "bg-brand-teal-soft text-brand-teal-dark",
  rejected: "bg-[#FDE8E8] text-[#C0362C]",
};

export default function SuperadminEmployersView({
  authUser,
  employers,
}: {
  authUser: AuthUser;
  employers: EmployerRow[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [rows, setRows] = useState(employers);
  const [reviewing, setReviewing] = useState<EmployerRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingLimit, setEditingLimit] = useState<EmployerRow | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSaving, setLimitSaving] = useState(false);

  async function saveCompanyLimit(userId: string, limit: number | null) {
    setLimitSaving(true);
    setLimitError(null);
    try {
      const res = await fetch(`/api/superadmin/users/${userId}/company-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the limit.");
      // Every company this person registered shows the same count.
      setRows((prev) => prev.map((e) => (e.userId === userId ? { ...e, ownerCompanyLimit: data.companyLimit } : e)));
      setEditingLimit(null);
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : "Couldn't update the limit.");
    } finally {
      setLimitSaving(false);
    }
  }
  const searchTerm = search.trim().toLowerCase();

  async function runSsmAction(id: string, action: "verify" | "reject", reason?: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/superadmin/employers/${id}/ssm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update this document.");
      setRows((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                ssmVerificationStatus: action === "verify" ? "verified" : "rejected",
                ssmRejectionReason: action === "reject" ? (reason ?? null) : null,
              }
            : e,
        ),
      );
      setReviewing(null);
      setRejectReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't update this document.");
    } finally {
      setActionLoading(false);
    }
  }

  const visible = useMemo(() => {
    const employers = rows;
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
    if (sort === "ssmPending")
      sorted.sort((a, b) => Number(b.ssmVerificationStatus === "pending") - Number(a.ssmVerificationStatus === "pending"));
    return sorted;
  }, [rows, searchTerm, sort]);

  const ghostingCount = rows.filter((e) => e.waitingLong > 0).length;
  const pendingSsmCount = rows.filter((e) => e.ssmVerificationStatus === "pending").length;

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
            <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">{rows.length}</span>
            {ghostingCount > 0 && (
              <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-[#A67C00]">
                {ghostingCount} with applicants waiting 3+ days
              </span>
            )}
            {pendingSsmCount > 0 && (
              <button
                type="button"
                onClick={() => setSort("ssmPending")}
                className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-[#A67C00] hover:opacity-90"
              >
                {pendingSsmCount} SSM document{pendingSsmCount === 1 ? "" : "s"} awaiting review
              </button>
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

          {rows.length === 0 ? (
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
                    <Logo url={employer.logoUrl} verified={employer.ssmVerificationStatus === "verified"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#141B2E]">{employer.companyName}</p>
                      <p className="mt-[1px] truncate text-xs text-[#4B5468]">
                        {employer.industry || "Industry not set"} · {employer.location || "Location not set"}
                      </p>
                      <p className="mt-[1px] truncate text-xs text-[#9AA3B2]">
                        {employer.contactName} · {employer.contactEmail || employer.email}
                      </p>
                      <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
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
                        <span className={`inline-flex items-center gap-[4px] rounded-full px-[9px] py-[3px] text-xs ${SSM_STATUS_CLASS[employer.ssmVerificationStatus]}`}>
                          {employer.ssmVerificationStatus === "verified" && <VerifiedBadgeIcon className="h-[10px] w-[10px]" />}
                          {SSM_STATUS_LABEL[employer.ssmVerificationStatus]}
                        </span>
                        {employer.ownerCompanyLimit && (
                          <span className="inline-flex items-center gap-[6px] rounded-full bg-[#F1F4F8] py-[3px] pl-[9px] pr-[4px] text-xs text-[#4B5468]">
                            Owner has {employer.ownerCompanyLimit.used} of {employer.ownerCompanyLimit.limit} companies
                            {employer.ownerCompanyLimit.custom && <span className="text-[#7C5CD1]">· custom</span>}
                            <button
                              type="button"
                              onClick={() => {
                                setLimitError(null);
                                setLimitInput(String(employer.ownerCompanyLimit?.limit ?? DEFAULT_COMPANY_LIMIT));
                                setEditingLimit(employer);
                              }}
                              className="rounded-full bg-white px-[8px] py-[1px] text-brand-teal-dark hover:bg-brand-teal-soft"
                            >
                              Edit limit
                            </button>
                          </span>
                        )}
                        {employer.ssmDocumentUrl && (employer.ssmVerificationStatus === "pending" || employer.ssmVerificationStatus === "rejected") && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setRejectReason("");
                              setReviewing(employer);
                            }}
                            className="rounded-full bg-brand-teal-dark px-[9px] py-[3px] text-xs text-white hover:opacity-90"
                          >
                            Review document
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-[6px] text-xs text-[#9AA3B2] sm:flex-col sm:items-end sm:gap-[4px]">
                    <span className="rounded-full bg-brand-teal-soft px-[10px] py-[3px] text-xs text-brand-teal-dark">
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

      {reviewing && (
        <Modal onClose={() => (actionLoading ? undefined : setReviewing(null))} ariaLabel="Review SSM document">
          <p className="text-sm font-semibold text-[#141B2E]">Review {reviewing.companyName}&rsquo;s SSM document</p>
          <p className="mt-[4px] text-xs text-[#9AA3B2]">SSM registration number: {reviewing.ssmNumber}</p>
          {reviewing.ssmDocumentUrl && (
            <a
              href={reviewing.ssmDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-[14px] flex h-[40px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
            >
              Open document
            </a>
          )}
          <label className="mt-[14px] block text-xs text-[#4B5468]" htmlFor="ssmRejectReason">
            Reason (only needed to reject)
          </label>
          <textarea
            id="ssmRejectReason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Document is blurry, or the company name doesn't match."
            className="mt-[6px] w-full resize-none rounded-[12px] border border-black/[0.1] p-[10px] text-sm text-[#141B2E] outline-none focus:border-brand-teal-dark"
          />
          {actionError && <p className="mt-[8px] text-xs text-red-500">{actionError}</p>}
          <div className="mt-[16px] flex items-center gap-[8px]">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => runSsmAction(reviewing.id, "verify")}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white hover:opacity-90 disabled:opacity-60"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={actionLoading || !rejectReason.trim()}
              onClick={() => runSsmAction(reviewing.id, "reject", rejectReason)}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full border border-[#E5484D] text-sm text-[#E5484D] hover:bg-[#FDE8E8] disabled:opacity-60"
            >
              Reject
            </button>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setReviewing(null)}
            className="mt-[8px] flex h-[36px] w-full items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
          >
            Cancel
          </button>
        </Modal>
      )}
      {editingLimit && (
        <Modal onClose={() => (limitSaving ? undefined : setEditingLimit(null))} ariaLabel="Edit company limit">
          <p className="text-sm font-semibold text-[#141B2E]">Company limit</p>
          <p className="mt-[4px] text-xs leading-[17px] text-[#4B5468]">
            How many companies {editingLimit.contactName} ({editingLimit.email}) can register. They have{" "}
            {editingLimit.ownerCompanyLimit?.used ?? 0} now. The default is {DEFAULT_COMPANY_LIMIT}.
          </p>
          <input
            type="number"
            min={1}
            max={100}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="mt-[12px] h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none focus:border-brand-teal-dark"
          />
          {editingLimit.ownerCompanyLimit && Number(limitInput) < editingLimit.ownerCompanyLimit.used && (
            <p className="mt-[6px] text-xs text-[#A67C00]">
              That&rsquo;s below what they already have — nothing is removed, they just can&rsquo;t add more.
            </p>
          )}
          {limitError && <p className="mt-[6px] text-xs text-red-500">{limitError}</p>}
          <div className="mt-[14px] flex gap-[8px]">
            <button
              type="button"
              disabled={limitSaving}
              onClick={() => saveCompanyLimit(editingLimit.userId, null)}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:opacity-60"
            >
              Reset to {DEFAULT_COMPANY_LIMIT}
            </button>
            <button
              type="button"
              disabled={limitSaving || !/^\d+$/.test(limitInput.trim())}
              onClick={() => saveCompanyLimit(editingLimit.userId, Number(limitInput))}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}

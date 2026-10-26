"use client";

import { useState } from "react";
import { gradientFrameClass, inputClass } from "./formStyles";
import Modal from "./Modal";
import { call, dangerBtn, jsonInit, primaryBtn, sideStyle } from "./SuperadminCampaignParts";
import { SearchIcon } from "./icons";
import {
  CLAIM_STATUS_LABEL,
  formatMytDateTime,
  REJECT_REASON_MAX,
  type Campaign,
  type CampaignClaimRow,
  type CampaignClaimStatus,
} from "@/lib/campaigns-shared";

export type PeopleFilter = "waiting" | "everyone";

// Words for superadmins: "Picked" (a draw winner not announced yet) reads
// better than the raw claim status here.
const STATUS_TEXT: Record<CampaignClaimStatus, string> = { ...CLAIM_STATUS_LABEL, selected: "Picked — not announced yet" };

const STATUS_PILL: Record<CampaignClaimStatus, string> = {
  pending: "bg-[#FFF3D6] text-[#A67C00]",
  selected: "bg-[#EEF2FF] text-[#4F46E5]",
  approved: "bg-[#E7F6EC] text-[#2F7D4F]",
  won: "bg-[#E7F6EC] text-[#2F7D4F]",
  entered: "bg-[#EEF2FF] text-[#4F46E5]",
  not_selected: "bg-[#F1F4F8] text-[#9AA3B2]",
  rejected: "bg-red-50 text-red-500",
};

/**
 * Everyone who got (or is waiting for) a reward. Waiting vouchers have big
 * Approve / Reject buttons and an "Approve all" at the top.
 */
export default function CampaignPeople({
  campaign,
  claims,
  filter,
  onFilter,
  onUpdate,
}: {
  campaign: Campaign;
  claims: CampaignClaimRow[];
  filter: PeopleFilter;
  onFilter: (f: PeopleFilter) => void;
  onUpdate: (campaign: Campaign, claims: CampaignClaimRow[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<CampaignClaimRow | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const waiting = claims.filter((c) => c.status === "pending");
  const term = search.trim().toLowerCase();
  const visible = (filter === "waiting" ? waiting : claims).filter(
    (c) => !term || [c.userName, c.userEmail, c.phone, c.companyName, c.code].some((v) => v?.toLowerCase().includes(term)),
  );

  async function review(ids: string[], decision: "approve" | "reject") {
    setBusy(ids.length > 1 ? "all" : ids[0]);
    setError(null);
    setNote(null);
    try {
      const data = await call<{ campaign: Campaign; claims: CampaignClaimRow[]; updated: number }>(
        `/api/superadmin/campaigns/${campaign.id}/claims`,
        jsonInit("POST", { ids, decision, reason: decision === "reject" ? reason : undefined }),
      );
      onUpdate(data.campaign, data.claims);
      setRejecting(null);
      setConfirmAll(false);
      setReason("");
      setNote(decision === "approve" ? `Approved ${data.updated} — they've been told and can see their code.` : "Rejected — the code went back into stock.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={gradientFrameClass("teal")}>
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-[10px]">
          <h2 className="text-base font-semibold text-[#141B2E]">People</h2>
          <div className="flex gap-[6px]">
            {(
              [
                ["waiting", `Waiting for approval (${waiting.length})`],
                ["everyone", `Everyone (${claims.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-full border px-[12px] py-[6px] text-xs transition-colors ${
                  filter === key ? "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark" : "border-black/[0.1] text-[#4B5468] hover:bg-black/[0.03]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {claims.length > 5 && (
          <div className="mt-[12px] flex items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
            <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone or code..."
              aria-label="Search people"
              className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
            />
          </div>
        )}

        {note && <p className="mt-[12px] rounded-[12px] border border-[#CDEBD7] bg-[#E7F6EC] p-[10px] text-sm text-[#2F7D4F]">{note}</p>}
        {error && !rejecting && !confirmAll && <p className="mt-[12px] text-sm text-red-500">{error}</p>}

        {filter === "waiting" && waiting.length > 1 && !term && (
          <div className="mt-[12px] flex flex-wrap items-center justify-between gap-[10px] rounded-[12px] bg-[#F8FAFB] px-[12px] py-[8px]">
            <p className="text-sm text-[#4B5468]">{waiting.length} people are waiting for their voucher.</p>
            <button type="button" onClick={() => setConfirmAll(true)} disabled={busy !== null} className={`${primaryBtn} h-[34px]`}>
              Approve all {waiting.length}
            </button>
          </div>
        )}

        {claims.length === 0 ? (
          <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#9AA3B2]">Nobody has a reward yet. People show up here as they verify their phone.</p>
        ) : visible.length === 0 ? (
          <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#9AA3B2]">
            {filter === "waiting" && !term ? "✅ All caught up — nobody is waiting for approval." : "Nobody matches."}
          </p>
        ) : (
          <ul className="mt-[12px] flex flex-col gap-[8px]">
            {visible.map((c) => (
              <li key={c.id} className="flex flex-col gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-[6px]">
                    <p className="truncate text-sm text-[#141B2E]">{c.userName || c.userEmail}</p>
                    <span
                      style={sideStyle(c.audience)}
                      className={`rounded-full px-[8px] py-[1px] text-xs ${c.audience === "jobseeker" ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark"}`}
                    >
                      {c.audience === "jobseeker" ? "Jobseeker" : "Employer"}
                    </span>
                    <span className={`rounded-full px-[8px] py-[1px] text-xs ${STATUS_PILL[c.status]}`}>{STATUS_TEXT[c.status]}</span>
                  </div>
                  <p className="mt-[2px] truncate text-xs text-[#4B5468]">
                    {c.userEmail} · {c.phone}
                    {c.companyName ? ` · ${c.companyName}` : ""}
                  </p>
                  <div className="mt-[6px] flex flex-wrap gap-[6px]">
                    {c.checks.map((check) => (
                      <span key={check.label} className={`rounded-full px-[8px] py-[1px] text-xs ${check.ok ? "bg-[#E7F6EC] text-[#2F7D4F]" : "bg-[#F1F4F8] text-[#9AA3B2]"}`}>
                        {check.ok ? "✓" : "•"} {check.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-[6px] text-xs text-[#9AA3B2]">
                    {formatMytDateTime(c.createdAt)}
                    {c.code && c.status === "approved" ? ` · Code ${c.code}` : ""}
                    {c.reviewedAt && c.status !== "won" ? ` · ${c.status === "rejected" ? "Rejected" : "Approved"} by ${c.reviewedByEmail}` : ""}
                    {c.rejectReason ? ` · “${c.rejectReason}”` : ""}
                  </p>
                </div>
                {c.status === "pending" && (
                  <div className="flex shrink-0 gap-[8px]">
                    <button type="button" onClick={() => setRejecting(c)} disabled={busy !== null} className={dangerBtn}>
                      Reject
                    </button>
                    <button type="button" onClick={() => review([c.id], "approve")} disabled={busy !== null} className={primaryBtn}>
                      {busy === c.id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {rejecting && (
        <Modal ariaLabel="Reject this voucher?" onClose={() => busy === null && setRejecting(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Reject {rejecting.userName || "this person"}?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">They won&rsquo;t get the voucher, and the code goes back into stock for someone else.</p>
          <label htmlFor="reject-reason" className="mt-[12px] block text-sm text-[#141B2E]">
            Reason <span className="text-[#9AA3B2]">(optional — they&rsquo;ll see it)</span>
          </label>
          <input
            id="reject-reason"
            value={reason}
            maxLength={REJECT_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This looks like a duplicate account."
            className={`${inputClass("teal")} mt-[6px]`}
          />
          {error && <p className="mt-[10px] text-sm text-red-500">{error}</p>}
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button type="button" disabled={busy !== null} onClick={() => review([rejecting.id], "reject")} className={dangerBtn}>
              {busy ? "Rejecting…" : "Reject"}
            </button>
            <button type="button" onClick={() => setRejecting(null)} className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {confirmAll && (
        <Modal ariaLabel="Approve everyone waiting?" onClose={() => busy === null && setConfirmAll(false)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">Approve all {waiting.length}?</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">Each person sees their voucher code straight away and is told in the app and by email.</p>
          {error && <p className="mt-[10px] text-sm text-red-500">{error}</p>}
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button type="button" disabled={busy !== null} onClick={() => review(waiting.slice(0, 1000).map((c) => c.id), "approve")} className={primaryBtn}>
              {busy ? "Approving…" : `Approve all ${waiting.length}`}
            </button>
            <button type="button" onClick={() => setConfirmAll(false)} className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

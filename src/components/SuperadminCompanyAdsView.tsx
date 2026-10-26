"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CompanyAdCard from "./CompanyAdCard";
import Modal from "./Modal";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { CalendarIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import { AD_SLOTS, addDays, daysBetween, formatAdDate, formatAdRun, type AdPhase } from "@/lib/ad-slots";

type AdRow = {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  headline: string;
  phase: AdPhase;
  rejectionReason: string | null;
  startDate: string;
  endDate: string;
  submittedAt: string;
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyIndustry: string | null;
  companyVerified: boolean;
};

type Tab = "pending" | "upcoming" | "live" | "past";

const TABS: { value: Tab; label: string; empty: string }[] = [
  { value: "pending", label: "Waiting for review", empty: "Nothing waiting for review." },
  { value: "upcoming", label: "Upcoming", empty: "No approved ads waiting to start." },
  { value: "live", label: "Live", empty: "No ads are live right now." },
  { value: "past", label: "Past & rejected", empty: "Nothing here yet." },
];

const PHASE = {
  pending: { label: "Waiting for review", className: "bg-[#FFF3D6] text-[#A67C00]" },
  scheduled: { label: "Scheduled", className: "bg-[#F1ECFB] text-[#7C5CD1]" },
  live: { label: "Live", className: "bg-brand-teal-soft text-brand-teal-dark" },
  ended: { label: "Ended", className: "bg-[#F1F4F8] text-[#9AA3B2]" },
  rejected: { label: "Rejected", className: "bg-[#FDE8E8] text-[#C0362C]" },
} as const;

function inTab(ad: AdRow, tab: Tab) {
  if (tab === "pending") return ad.phase === "pending";
  if (tab === "upcoming") return ad.phase === "scheduled";
  if (tab === "live") return ad.phase === "live";
  return ad.phase === "ended" || ad.phase === "rejected";
}

export default function SuperadminCompanyAdsView({ authUser, ads, today }: { authUser: AuthUser; ads: AdRow[]; today: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(ads.some((a) => a.phase === "pending") ? "pending" : "live");
  const [rejecting, setRejecting] = useState<AdRow | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(id: string, action: "approve" | "reject", rejectReason?: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/company-ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: rejectReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update this ad.");
      setRejecting(null);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this ad.");
    } finally {
      setBusyId(null);
    }
  }

  const live = ads.filter((a) => a.phase === "live").sort((a, b) => a.endDate.localeCompare(b.endDate));
  // Pending ads hold their slot too — the board shows them as reserved.
  const holdingToday = ads.filter((a) => a.phase === "pending" && a.startDate <= today);
  const visible = ads.filter((a) => inTab(a, tab));
  const count = (t: Tab) => ads.filter((a) => inTab(a, t)).length;
  const nextOpening = live.length >= AD_SLOTS ? live[0]?.endDate : null;

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="company-ads"
      heading="Company Ads"
      subheading={`The employer landing page has ${AD_SLOTS} ad slots. Each booking runs 30 days and is reviewed here before it starts.`}
    >
      <div className="flex flex-col gap-[20px]">
        {/* Slot board */}
        <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div className="flex flex-wrap items-end justify-between gap-[10px]">
              <div>
                <p className="text-xs text-[#9AA3B2]">Slots today</p>
                <p className="mt-[2px] text-xl font-semibold text-[#141B2E]">
                  {live.length} of {AD_SLOTS} live
                </p>
              </div>
              <p className="text-sm text-[#4B5468]">
                {nextOpening ? (
                  <>
                    Next opening: <span className="font-medium text-brand-teal-dark">{formatAdDate(nextOpening)}</span>
                  </>
                ) : (
                  <>
                    {AD_SLOTS - live.length} slot{AD_SLOTS - live.length === 1 ? "" : "s"} open
                  </>
                )}
              </p>
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-[8px] sm:grid-cols-5">
              {Array.from({ length: AD_SLOTS }, (_, i) => {
                const ad = live[i];
                if (ad) {
                  const left = daysBetween(today, ad.endDate);
                  return (
                    <div key={i} className="rounded-[12px] border border-[#BFEDEF] bg-[#F2FBFB] p-[10px]">
                      <p className="text-[10px] text-[#9AA3B2]">Slot {i + 1}</p>
                      <p className="mt-[2px] truncate text-sm text-[#141B2E]">{ad.companyName}</p>
                      <p className="mt-[2px] text-xs text-brand-teal-dark">
                        Ends {formatAdDate(addDays(ad.endDate, -1), false)} · {left}d
                      </p>
                    </div>
                  );
                }
                const held = holdingToday[i - live.length];
                return held ? (
                  <div key={i} className="rounded-[12px] border border-[#FBE7B3] bg-[#FFFBEF] p-[10px]">
                    <p className="text-[10px] text-[#9AA3B2]">Slot {i + 1}</p>
                    <p className="mt-[2px] truncate text-sm text-[#141B2E]">{held.companyName}</p>
                    <p className="mt-[2px] text-xs text-[#A67C00]">Held · needs review</p>
                  </div>
                ) : (
                  <div key={i} className="rounded-[12px] border border-dashed border-black/[0.12] p-[10px]">
                    <p className="text-[10px] text-[#9AA3B2]">Slot {i + 1}</p>
                    <p className="mt-[2px] text-sm text-[#9AA3B2]">Free</p>
                    <p className="mt-[2px] text-xs text-[#C0C6D0]">Sample ad shows</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bookings */}
        <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div className="flex flex-wrap gap-[6px]">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={`rounded-full px-[12px] py-[6px] text-xs ${
                    tab === t.value ? "bg-brand-teal-dark text-white" : "bg-[#F1F4F8] text-[#4B5468] hover:bg-[#E6EAF0]"
                  }`}
                >
                  {t.label} ({count(t.value)})
                </button>
              ))}
            </div>

            {error && !rejecting && <p className="mt-[10px] text-xs text-red-500">{error}</p>}

            {visible.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                {TABS.find((t) => t.value === tab)!.empty}
              </p>
            ) : (
              <div className="mt-[14px] grid gap-[16px] md:grid-cols-2 xl:grid-cols-3">
                {visible.map((ad) => (
                  <div key={ad.id} className="flex flex-col gap-[10px] rounded-[16px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                    <CompanyAdCard ad={ad} linked={false} />
                    <div className="flex flex-wrap items-center gap-[6px] text-xs">
                      <span className={`rounded-full px-[9px] py-[3px] ${PHASE[ad.phase].className}`}>{PHASE[ad.phase].label}</span>
                      <span className="flex items-center gap-[4px] text-[#4B5468]">
                        <CalendarIcon className="h-[11px] w-[11px] text-[#9AA3B2]" />
                        {formatAdRun(ad.startDate, ad.endDate)}
                      </span>
                      <a
                        href={`/companies/${ad.companyId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-brand-teal-dark hover:underline"
                      >
                        Company page
                      </a>
                    </div>
                    {ad.phase === "pending" && (
                      <p className="text-xs leading-[17px] text-[#A67C00]">
                        {ad.startDate <= today
                          ? "Starts today — approve now or it moves to the next free date."
                          : `Starts in ${daysBetween(today, ad.startDate)} day${daysBetween(today, ad.startDate) === 1 ? "" : "s"} — review before then.`}
                      </p>
                    )}
                    {ad.phase === "rejected" && ad.rejectionReason && (
                      <p className="text-xs leading-[17px] text-[#4B5468]">Reason: {ad.rejectionReason}</p>
                    )}
                    {(ad.phase === "pending" || ad.phase === "scheduled" || ad.phase === "live") && (
                      <div className="flex gap-[8px]">
                        {ad.phase === "pending" && (
                          <button
                            type="button"
                            disabled={busyId === ad.id}
                            onClick={() => review(ad.id, "approve")}
                            className="flex h-[36px] flex-1 items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === ad.id}
                          onClick={() => {
                            setError(null);
                            setReason("");
                            setRejecting(ad);
                          }}
                          className="flex h-[36px] flex-1 items-center justify-center rounded-full border border-[#E5484D] text-sm text-[#E5484D] hover:bg-[#FDE8E8] disabled:opacity-60"
                        >
                          {ad.phase === "pending" ? "Reject" : ad.phase === "live" ? "Take down" : "Cancel booking"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {rejecting && (
        <Modal onClose={() => (busyId ? undefined : setRejecting(null))} ariaLabel="Reject advertisement">
          <p className="text-sm font-semibold text-[#141B2E]">
            {rejecting.phase === "live" ? "Take down" : rejecting.phase === "scheduled" ? "Cancel" : "Reject"} {rejecting.companyName}&rsquo;s ad?
          </p>
          <p className="mt-[4px] text-xs text-[#9AA3B2]">
            Its slot is freed straight away. The employer sees this reason and can edit and resubmit.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. The image is low quality, or the headline is misleading."
            className="mt-[12px] w-full resize-none rounded-[12px] border border-black/[0.1] p-[10px] text-sm text-[#141B2E] outline-none focus:border-brand-teal-dark"
          />
          {error && <p className="mt-[6px] text-xs text-red-500">{error}</p>}
          <div className="mt-[14px] flex gap-[8px]">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
            >
              Keep it
            </button>
            <button
              type="button"
              disabled={!reason.trim() || busyId === rejecting.id}
              onClick={() => review(rejecting.id, "reject", reason.trim())}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-[#E5484D] text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {rejecting.phase === "live" ? "Take down" : rejecting.phase === "scheduled" ? "Cancel booking" : "Reject"}
            </button>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}

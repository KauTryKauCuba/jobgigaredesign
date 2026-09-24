"use client";

import { useMemo, useState } from "react";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { gradientFrameClass } from "./formStyles";
import RichTextContent from "./RichTextContent";
import type { AuthUser } from "./AuthModal";

type PendingRow = {
  posting: {
    id: string;
    title: string;
    description: string;
    responsibilities: string;
    industry: string | null;
    location: string;
    salaryMin: number | null;
    salaryMax: number | null;
    openings: number;
    skills: string[];
    createdAt: string;
    flagReason?: string | null;
  };
  companyName: string;
  companyLogoUrl: string | null;
};

const REPORT_REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  scam: "Scam / fraud",
  discriminatory: "Discriminatory",
  misleading: "Misleading",
  inappropriate: "Inappropriate",
  other: "Other",
};

type ReportRow = {
  report: { id: string; reason: string; details: string | null; createdAt: string };
  postingId: string;
  postingTitle: string;
  postingStatus: string;
  companyName: string;
  reporterName: string;
};

const TABS = [
  { key: "pending", label: "Pending review" },
  { key: "active", label: "Active" },
  { key: "flagged", label: "Flagged" },
  { key: "reports", label: "Reports" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function SuperadminJobPostingsView({
  authUser,
  initialPending,
  initialActive,
  initialFlagged,
  initialReports,
}: {
  authUser: AuthUser;
  initialPending: PendingRow[];
  initialActive: PendingRow[];
  initialFlagged: PendingRow[];
  initialReports: ReportRow[];
}) {
  const [tab, setTab] = useState<TabKey>("pending");
  const [rows, setRows] = useState(initialPending);
  const [activeRows, setActiveRows] = useState(initialActive);
  const [flaggedRows] = useState(initialFlagged);
  const [reportRows, setReportRows] = useState(initialReports);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleRows = tab === "pending" ? rows : tab === "active" ? activeRows : flaggedRows;

  // Grouped by posting so a posting reported by several jobseekers shows as
  // one card listing every reason, rather than one row per report.
  const groupedReports = useMemo(() => {
    const groups = new Map<
      string,
      { postingId: string; postingTitle: string; postingStatus: string; companyName: string; reports: ReportRow["report"][]; reporterNames: string[] }
    >();
    for (const r of reportRows) {
      const existing = groups.get(r.postingId);
      if (existing) {
        existing.reports.push(r.report);
        existing.reporterNames.push(r.reporterName);
      } else {
        groups.set(r.postingId, {
          postingId: r.postingId,
          postingTitle: r.postingTitle,
          postingStatus: r.postingStatus,
          companyName: r.companyName,
          reports: [r.report],
          reporterNames: [r.reporterName],
        });
      }
    }
    return Array.from(groups.values());
  }, [reportRows]);

  async function approve(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/superadmin/job-postings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't approve this posting.");
      setRows((prev) => prev.filter((r) => r.posting.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't approve this posting.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/superadmin/job-postings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't reject this posting.");
      setRows((prev) => prev.filter((r) => r.posting.id !== id));
      setRejectingId(null);
      setRejectReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reject this posting.");
    } finally {
      setBusyId(null);
    }
  }

  async function flag(id: string) {
    if (!flagReason.trim()) return;
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/superadmin/job-postings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flag", reason: flagReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't flag this posting.");
      // Flagging moves the posting out of "active" — same loop-back-to-
      // pending workflow as rejecting, so it drops off this list until the
      // employer edits and resubmits it. Also clears any reports for it
      // (the API deletes them server-side too) since they're now resolved.
      setActiveRows((prev) => prev.filter((r) => r.posting.id !== id));
      setReportRows((prev) => prev.filter((r) => r.postingId !== id));
      setFlaggingId(null);
      setFlagReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't flag this posting.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissReports(postingId: string) {
    setError(null);
    setBusyId(postingId);
    try {
      const res = await fetch(`/api/superadmin/job-postings/${postingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_reports" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't dismiss these reports.");
      setReportRows((prev) => prev.filter((r) => r.postingId !== postingId));
      setDismissingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't dismiss these reports.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="job-postings"
      heading="Job Postings"
      subheading="Review pending postings, or see what's currently live."
    >
      <div
        role="radiogroup"
        aria-label="Job posting status"
        className="grid h-[38px] grid-cols-4 gap-[4px] rounded-full border border-black/[0.1] p-[3px]"
      >
        {TABS.map((t) => {
          const count =
            t.key === "pending"
              ? rows.length
              : t.key === "active"
                ? activeRows.length
                : t.key === "flagged"
                  ? flaggedRows.length
                  : groupedReports.length;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              onClick={() => setTab(t.key)}
              aria-checked={tab === t.key}
              className="flex h-[30px] items-center justify-center rounded-full text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-checked:bg-brand-teal-dark aria-checked:text-white aria-checked:hover:bg-brand-teal-dark"
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className={`mt-[16px] ${gradientFrameClass("teal")}`}>
        <div className="rounded-[19px] bg-white p-[22px]">
          {error && <p className="text-xs text-red-500">{error}</p>}

          {tab === "reports" ? (
            groupedReports.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                No reports right now.
              </p>
            ) : (
              <div className="mt-[14px] flex flex-col gap-[12px]">
                {groupedReports.map((group) => (
                  <div
                    key={group.postingId}
                    className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[16px]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-[8px]">
                      <div>
                        <p className="text-sm text-[#141B2E]">{group.postingTitle}</p>
                        <p className="mt-[2px] text-xs text-[#4B5468]">{group.companyName}</p>
                      </div>
                      <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                        {group.reports.length} report{group.reports.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="mt-[10px] flex flex-col gap-[8px]">
                      {group.reports.map((r, i) => (
                        <div key={r.id} className="rounded-[12px] border border-[#FBDBBE] bg-[#FFF7F0] p-[10px]">
                          <div className="flex items-center justify-between gap-[8px]">
                            <span className="text-xs text-[#C2600A]">
                              {REPORT_REASON_LABEL[r.reason] ?? r.reason}
                            </span>
                            <span className="text-xs text-[#9A5209]">{group.reporterNames[i]}</span>
                          </div>
                          {r.details && <p className="mt-[4px] text-xs text-[#9A5209]">{r.details}</p>}
                        </div>
                      ))}
                    </div>

                    {flaggingId === group.postingId ? (
                      <div className="mt-[12px] flex flex-col gap-[8px] border-t border-black/[0.06] pt-[12px]">
                        <input
                          type="text"
                          autoFocus
                          value={flagReason}
                          onChange={(e) => setFlagReason(e.target.value)}
                          placeholder="Why is this being flagged?"
                          className="h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark"
                        />
                        <div className="flex gap-[8px]">
                          <button
                            type="button"
                            disabled={!flagReason.trim() || busyId === group.postingId}
                            onClick={() => flag(group.postingId)}
                            className="flex h-[36px] items-center justify-center rounded-full bg-orange-500 px-[16px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Confirm flag
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFlaggingId(null);
                              setFlagReason("");
                            }}
                            className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : dismissingId === group.postingId ? (
                      <div className="mt-[12px] flex flex-col gap-[8px] border-t border-black/[0.06] pt-[12px]">
                        <p className="text-xs text-[#4B5468]">Dismiss every report on this posting?</p>
                        <div className="flex gap-[8px]">
                          <button
                            type="button"
                            disabled={busyId === group.postingId}
                            onClick={() => dismissReports(group.postingId)}
                            className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Confirm dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => setDismissingId(null)}
                            className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-[12px] flex gap-[8px] border-t border-black/[0.06] pt-[12px]">
                        {group.postingStatus === "active" && (
                          <button
                            type="button"
                            disabled={busyId === group.postingId}
                            onClick={() => setFlaggingId(group.postingId)}
                            className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Flag posting
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === group.postingId}
                          onClick={() => setDismissingId(group.postingId)}
                          className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Dismiss reports
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : visibleRows.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              {tab === "pending"
                ? "Nothing waiting on review right now."
                : tab === "active"
                  ? "No active postings right now."
                  : "No flagged postings right now."}
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[12px]">
              {visibleRows.map(({ posting, companyName }) => (
                <div key={posting.id} className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[16px]">
                  <div className="flex flex-wrap items-start justify-between gap-[8px]">
                    <div>
                      <p className="text-sm text-[#141B2E]">{posting.title}</p>
                      <p className="mt-[2px] text-xs text-[#4B5468]">{companyName}</p>
                    </div>
                    <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[3px] text-xs text-[#4B5468]">
                      {posting.industry ?? "No industry set"}
                    </span>
                  </div>

                  <div className="mt-[8px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                    <span>{posting.location || "Location not set"}</span>
                    <span className="text-[#C7CDD7]">·</span>
                    <span>
                      {posting.salaryMin && posting.salaryMax
                        ? `RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
                        : "Salary not disclosed"}
                    </span>
                    <span className="text-[#C7CDD7]">·</span>
                    <span>
                      {posting.openings} opening{posting.openings === 1 ? "" : "s"}
                    </span>
                  </div>

                  {posting.description && (
                    <RichTextContent html={posting.description} className="mt-[10px] text-xs text-[#4B5468]" />
                  )}

                  {posting.skills.length > 0 && (
                    <div className="mt-[10px] flex flex-wrap gap-[6px]">
                      {posting.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[#E6F9FA] px-[10px] py-[4px] text-xs text-brand-teal-dark"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {tab === "flagged" && posting.flagReason && (
                    <div className="mt-[10px] rounded-[12px] border border-[#FBDBBE] bg-[#FFF7F0] p-[12px]">
                      <p className="mb-[4px] text-xs text-[#C2600A]">Flagged — awaiting employer fix</p>
                      <p className="text-xs text-[#9A5209]">{posting.flagReason}</p>
                    </div>
                  )}

                  {tab === "pending" && (rejectingId === posting.id ? (
                    <div className="mt-[12px] flex flex-col gap-[8px] border-t border-black/[0.06] pt-[12px]">
                      <input
                        type="text"
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why is this being rejected?"
                        className="h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark"
                      />
                      <div className="flex gap-[8px]">
                        <button
                          type="button"
                          disabled={!rejectReason.trim() || busyId === posting.id}
                          onClick={() => reject(posting.id)}
                          className="flex h-[36px] items-center justify-center rounded-full bg-red-500 px-[16px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm rejection
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason("");
                          }}
                          className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-[12px] flex gap-[8px] border-t border-black/[0.06] pt-[12px]">
                      <button
                        type="button"
                        disabled={busyId === posting.id}
                        onClick={() => approve(posting.id)}
                        className="flex h-[36px] items-center justify-center rounded-full bg-brand-teal-dark px-[16px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === posting.id}
                        onClick={() => setRejectingId(posting.id)}
                        className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ))}

                  {tab === "active" && (flaggingId === posting.id ? (
                    <div className="mt-[12px] flex flex-col gap-[8px] border-t border-black/[0.06] pt-[12px]">
                      <input
                        type="text"
                        autoFocus
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        placeholder="Why is this being flagged?"
                        className="h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark"
                      />
                      <div className="flex gap-[8px]">
                        <button
                          type="button"
                          disabled={!flagReason.trim() || busyId === posting.id}
                          onClick={() => flag(posting.id)}
                          className="flex h-[36px] items-center justify-center rounded-full bg-orange-500 px-[16px] text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Confirm flag
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFlaggingId(null);
                            setFlagReason("");
                          }}
                          className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-[12px] flex gap-[8px] border-t border-black/[0.06] pt-[12px]">
                      <button
                        type="button"
                        disabled={busyId === posting.id}
                        onClick={() => setFlaggingId(posting.id)}
                        className="flex h-[36px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Flag posting
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperadminDashboardShell>
  );
}

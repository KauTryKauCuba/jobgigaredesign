"use client";

import { useEffect, useRef, useState } from "react";
import DatePicker from "./DatePicker";
import { inputClass, textareaClass } from "./formStyles";
import { btnFor, call, dangerBtn, jsonInit, Notice, secondaryBtn } from "./SuperadminCampaignParts";
import { SearchIcon, TrashIcon } from "./icons";
import {
  CODES_PER_UPLOAD_MAX,
  formatDay,
  parseVoucherCodes,
  todayInMalaysia,
  type Campaign,
  type CampaignAudience,
} from "@/lib/campaigns-shared";

// Voucher codes for one side of a campaign: adding them (the setup's
// "Voucher codes" step, and "Add codes") and the full list ("Manage codes").

/** Paste or upload codes. Reports the updated campaign back. */
export function CodeUploader({
  campaign,
  audience,
  onCampaign,
  onAdded,
}: {
  campaign: Campaign;
  audience: CampaignAudience;
  onCampaign: (next: Campaign) => void;
  onAdded?: () => void;
}) {
  const accent = audience === "jobseeker" ? "gold" : "teal";
  const [text, setText] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [showExpiry, setShowExpiry] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error" | "warn"; message: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const parsed = text.trim() ? parseVoucherCodes(text) : null;

  async function readFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setResult({ tone: "error", message: "That file is too large (max 2 MB)." });
      return;
    }
    const content = await file.text();
    setText((t) => (t.trim() ? `${t.trimEnd()}\n${content}` : content));
    setResult(null);
  }

  async function add() {
    setAdding(true);
    setResult(null);
    try {
      const data = await call<{ campaign: Campaign; added: number; skipped: number; invalid: number }>(
        `/api/superadmin/campaigns/${campaign.id}/codes`,
        jsonInit("POST", { audience, text, expiresOn: expiresOn || null }),
      );
      onCampaign(data.campaign);
      const extras = [
        data.skipped ? `${data.skipped} skipped — already added` : "",
        data.invalid ? `${data.invalid} line${data.invalid === 1 ? "" : "s"} didn't look like a code` : "",
      ].filter(Boolean);
      setResult({
        tone: data.added ? (extras.length ? "warn" : "success") : "warn",
        message: `Added ${data.added} code${data.added === 1 ? "" : "s"}.${extras.length ? ` ${extras.join("; ")}.` : ""}`,
      });
      setText("");
      setExpiresOn("");
      onAdded?.();
    } catch (err) {
      setResult({ tone: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        placeholder={"Paste your codes here, one per line:\nTNG-8F2K-11QA\nTNG-9XL3-72PB"}
        aria-label="Voucher codes, one per line"
        className={`${textareaClass(accent)} font-mono text-xs`}
      />
      <div className="mt-[8px] flex flex-wrap items-center gap-x-[14px] gap-y-[6px] text-xs">
        <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()} className={accent === "gold" ? "text-brand-gold-dark hover:underline" : "text-brand-teal-dark hover:underline"}>
          Or upload a CSV file
        </button>
        {!showExpiry && (
          <button type="button" onClick={() => setShowExpiry(true)} className="text-[#4B5468] hover:underline">
            Add an expiry date
          </button>
        )}
        {parsed && (
          <span className="text-[#4B5468]">
            {parsed.codes.length} code{parsed.codes.length === 1 ? "" : "s"} found
            {parsed.duplicates ? ` · ${parsed.duplicates} repeated (added once)` : ""}
            {parsed.invalid ? ` · ${parsed.invalid} line${parsed.invalid === 1 ? "" : "s"} skipped` : ""}
          </span>
        )}
      </div>
      {showExpiry && (
        <div className="mt-[10px] max-w-[220px]">
          <label htmlFor={`codes-expiry-${audience}`} className="block text-xs text-[#4B5468]">
            These codes expire on
          </label>
          <div className="mt-[4px]">
            <DatePicker id={`codes-expiry-${audience}`} value={expiresOn} onChange={setExpiresOn} min={todayInMalaysia()} accent={accent} />
          </div>
          <p className="mt-[4px] text-xs text-[#9AA3B2]">People see it next to their code. Expired codes are never given out.</p>
        </div>
      )}
      {result && (
        <div className="mt-[10px]">
          <Notice tone={result.tone}>{result.message}</Notice>
        </div>
      )}
      <button type="button" onClick={add} disabled={adding || !parsed?.codes.length} className={`${btnFor(audience)} mt-[12px]`}>
        {adding ? "Adding…" : parsed?.codes.length ? `Add ${parsed.codes.length} code${parsed.codes.length === 1 ? "" : "s"}` : "Add codes"}
      </button>
      <p className="mt-[8px] text-xs text-[#9AA3B2]">
        Codes already added are skipped automatically. Up to {CODES_PER_UPLOAD_MAX.toLocaleString()} at a time.
      </p>
    </div>
  );
}

type CodeRow = {
  id: string;
  code: string;
  expiresOn: string | null;
  state: "available" | "expired" | "reserved" | "given";
  givenTo: string | null;
};

const STATE_LABEL: Record<CodeRow["state"], string> = {
  available: "Not given yet",
  reserved: "Waiting for approval",
  given: "Given",
  expired: "Expired",
};
const STATE_PILL: Record<CodeRow["state"], string> = {
  available: "bg-[#E7F6EC] text-[#2F7D4F]",
  reserved: "bg-[#FFF3D6] text-[#A67C00]",
  given: "bg-[#F1F4F8] text-[#4B5468]",
  expired: "bg-red-50 text-red-500",
};
const PAGE = 100;

/** Every code for one side, who got it, and removing ones nobody holds. */
export function CodeList({
  campaign,
  audience,
  onCampaign,
  reloadKey,
}: {
  campaign: Campaign;
  audience: CampaignAudience;
  onCampaign: (next: Campaign) => void;
  reloadKey: number;
}) {
  const accent = audience === "jobseeker" ? "gold" : "teal";
  const stats = campaign.stats[audience];
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<{ codes: CodeRow[] }>(`/api/superadmin/campaigns/${campaign.id}/codes?audience=${audience}`)
      .then((data) => !cancelled && setCodes(data.codes))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't load the codes."));
    return () => {
      cancelled = true;
    };
  }, [campaign.id, audience, reloadKey]);

  async function remove(codeId: string) {
    setBusyId(codeId);
    setError(null);
    try {
      const data = await call<{ campaign: Campaign }>(`/api/superadmin/campaigns/${campaign.id}/codes`, jsonInit("DELETE", { audience, codeId }));
      onCampaign(data.campaign);
      setConfirmClear(false);
      const fresh = await call<{ codes: CodeRow[] }>(`/api/superadmin/campaigns/${campaign.id}/codes?audience=${audience}`);
      setCodes(fresh.codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const term = search.trim().toLowerCase();
  const visible = (codes ?? []).filter((c) => !term || c.code.toLowerCase().includes(term) || c.givenTo?.toLowerCase().includes(term));
  const unused = stats.codesAvailable + stats.codesExpired;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <p className="text-sm text-[#141B2E]">All codes {codes ? `(${codes.length})` : ""}</p>
        <div className="flex flex-wrap items-center gap-[8px]">
          {codes && codes.length > 10 && (
            <div className="flex items-center gap-[6px] rounded-[12px] border border-black/[0.1] px-[10px]">
              <SearchIcon className="h-[12px] w-[12px] text-[#9AA3B2]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a code or email"
                aria-label="Find a code or email"
                className={`${inputClass(accent).replace("w-full ", "")} h-[32px] w-[160px] border-0 px-0`}
              />
            </div>
          )}
          {unused > 0 && !confirmClear && (
            <button type="button" onClick={() => setConfirmClear(true)} className={`${dangerBtn} h-[32px]`}>
              Remove unused
            </button>
          )}
        </div>
      </div>
      {confirmClear && (
        <div className="mt-[10px] flex flex-wrap items-center justify-between gap-[10px] rounded-[12px] border border-red-200 bg-red-50 p-[10px]">
          <p className="text-sm text-red-600">
            Remove the {unused} code{unused === 1 ? "" : "s"} nobody has received? Given codes stay.
          </p>
          <div className="flex gap-[6px]">
            <button type="button" onClick={() => setConfirmClear(false)} className={`${secondaryBtn} h-[32px]`}>
              Keep
            </button>
            <button type="button" disabled={busyId !== null} onClick={() => remove("unused")} className={`${dangerBtn} h-[32px]`}>
              {busyId === "unused" ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-[8px] text-sm text-red-500">{error}</p>}
      {!codes ? (
        <p className="mt-[10px] text-sm text-[#9AA3B2]">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="mt-[10px] rounded-[12px] bg-[#F8FAFB] p-[14px] text-sm text-[#9AA3B2]">No codes yet.</p>
      ) : visible.length === 0 ? (
        <p className="mt-[10px] text-sm text-[#9AA3B2]">No codes match.</p>
      ) : (
        <ul className="mt-[10px] max-h-[360px] divide-y divide-[#EAEDF2] overflow-y-auto rounded-[12px] border border-[#EAEDF2]">
          {visible.slice(0, shown).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-[10px] px-[12px] py-[8px]">
              <span className="min-w-0 flex-1 break-all font-mono text-xs text-[#141B2E]">{c.code}</span>
              {c.expiresOn && <span className="text-xs text-[#9AA3B2]">Expires {formatDay(c.expiresOn)}</span>}
              {c.givenTo && <span className="max-w-[180px] truncate text-xs text-[#4B5468]">{c.givenTo}</span>}
              <span className={`rounded-full px-[9px] py-[2px] text-xs ${STATE_PILL[c.state]}`}>{STATE_LABEL[c.state]}</span>
              {(c.state === "available" || c.state === "expired") && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={busyId === c.id}
                  aria-label={`Remove ${c.code}`}
                  className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#9AA3B2] hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <TrashIcon className="h-[13px] w-[13px]" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {visible.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${secondaryBtn} mt-[10px]`}>
          Show more ({visible.length - shown} more)
        </button>
      )}
    </div>
  );
}

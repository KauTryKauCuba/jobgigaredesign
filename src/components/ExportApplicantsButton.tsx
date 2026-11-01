"use client";

import { useState } from "react";
import { DownloadIcon } from "./icons";

/** Downloads applicants as an Excel file (see api/employer/applicants/export) — no AI involved. */
export async function downloadApplicantsExport(
  body: { applicationIds: string[]; title?: string } | { filters: Record<string, unknown>; title?: string },
): Promise<string | null> {
  try {
    const res = await fetch("/api/employer/applicants/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return data?.error ?? "Couldn't export right now. Try again.";
    }
    const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Applicants.xlsx";
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  } catch {
    return "Couldn't export right now. Check your connection and try again.";
  }
}

/** "Export to Excel" for the applicants currently shown — exactly those rows, in that order. */
export default function ExportApplicantsButton({
  applicationIds,
  title,
}: {
  applicationIds: string[];
  /** Goes into the file name, e.g. "Frontend Engineer". */
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportNow() {
    setBusy(true);
    setError(null);
    setError(await downloadApplicantsExport({ applicationIds, title }));
    setBusy(false);
  }

  return (
    <span className="flex items-center gap-[8px]">
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        type="button"
        onClick={exportNow}
        disabled={busy || applicationIds.length === 0}
        title={`Download ${applicationIds.length} applicant${applicationIds.length === 1 ? "" : "s"} as an Excel file`}
        className="flex h-[30px] items-center gap-[6px] rounded-full border border-black/[0.1] bg-white px-[12px] text-xs text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DownloadIcon className="h-[13px] w-[13px]" />
        {busy ? "Exporting…" : "Export to Excel"}
      </button>
    </span>
  );
}

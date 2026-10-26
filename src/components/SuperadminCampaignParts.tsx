"use client";

import { DEFAULT_THEME_COLORS, themeCssVars } from "@/lib/site-themes-shared";
import { formatDay, PHASE_LABEL, type Campaign, type CampaignAudience, type CampaignPhase } from "@/lib/campaigns-shared";

// Small pieces shared by the superadmin Campaigns pages.

export function periodText(c: Pick<Campaign, "startsOn" | "endsOn">): string {
  if (c.startsOn && c.endsOn) return `${formatDay(c.startsOn)} – ${formatDay(c.endsOn)}`;
  if (c.startsOn) return `From ${formatDay(c.startsOn)}, no end date`;
  if (c.endsOn) return `Until ${formatDay(c.endsOn)}`;
  return "No set dates — runs until you end it";
}

export async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong — please try again.");
  return data as T;
}

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Superadmin's own blue lives in the brand-teal tokens (see superadmin/layout.tsx).
export const primaryBtn =
  "flex h-[38px] items-center justify-center gap-[6px] rounded-full bg-brand-teal-dark px-[18px] text-sm text-white hover:opacity-90 disabled:opacity-50";
export const goldBtn =
  "flex h-[38px] items-center justify-center gap-[6px] rounded-full bg-brand-gold px-[18px] text-sm text-[#141B2E] hover:opacity-90 disabled:opacity-50";
export const secondaryBtn =
  "flex h-[38px] items-center justify-center gap-[6px] rounded-full border border-black/[0.1] bg-white px-[16px] text-sm text-[#4B5468] hover:bg-black/[0.03] disabled:opacity-50";
export const dangerBtn =
  "flex h-[38px] items-center justify-center gap-[6px] rounded-full border border-black/[0.1] bg-white px-[16px] text-sm text-red-500 hover:bg-red-50 disabled:opacity-50";
export const btnFor = (audience: CampaignAudience) => (audience === "jobseeker" ? goldBtn : primaryBtn);

const PHASE_PILL: Record<CampaignPhase, string> = {
  running: "bg-[#E7F6EC] text-[#2F7D4F]",
  scheduled: "bg-[#EEF2FF] text-[#4F46E5]",
  paused: "bg-[#FFF3D6] text-[#A67C00]",
  draft: "bg-[#F1F4F8] text-[#4B5468]",
  finished: "bg-[#F1F4F8] text-[#9AA3B2]",
};

export function PhasePill({ phase }: { phase: CampaignPhase }) {
  return (
    <span className={`inline-flex items-center gap-[6px] rounded-full px-[10px] py-[3px] text-xs ${PHASE_PILL[phase]}`}>
      {phase === "running" && <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#2F7D4F]" />}
      {PHASE_LABEL[phase]}
    </span>
  );
}

/**
 * Wraps an employer-side card so it shows in the employer teal inside the
 * blue superadmin area (the jobseeker gold is never swapped, so it needs nothing).
 */
export function sideStyle(audience: CampaignAudience): React.CSSProperties | undefined {
  return audience === "employer" ? (themeCssVars("employer", DEFAULT_THEME_COLORS.employer) as React.CSSProperties) : undefined;
}

export function Stat({ label, value, hint, onClick }: { label: string; value: React.ReactNode; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-xs text-[#9AA3B2]">{label}</span>
      <span className="mt-[2px] block text-xl font-semibold text-[#141B2E]">{value}</span>
      {hint && <span className="mt-[2px] block text-xs text-[#9AA3B2]">{hint}</span>}
    </>
  );
  const cls = "rounded-[14px] border border-[#EAEDF2] bg-white p-[12px] text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-brand-teal-dark`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const cls = {
    info: "border-[#EAEDF2] bg-[#F8FAFB] text-[#4B5468]",
    warn: "border-[#FBE7B3] bg-[#FFF8E6] text-[#7A5B00]",
    error: "border-red-200 bg-red-50 text-red-600",
    success: "border-[#CDEBD7] bg-[#E7F6EC] text-[#2F7D4F]",
  }[tone];
  return <div className={`rounded-[12px] border p-[12px] text-sm leading-[20px] ${cls}`}>{children}</div>;
}

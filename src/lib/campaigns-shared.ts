// Client-safe parts of reward campaigns (see src/lib/campaigns.ts): types,
// limits, Malaysia-time dates and the words people see.

export const CAMPAIGN_AUDIENCES = ["employer", "jobseeker"] as const;
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];
export type CampaignStatus = "draft" | "live" | "paused" | "ended";
export type CampaignRewardType = "voucher" | "draw";
export type CampaignClaimStatus = "pending" | "approved" | "rejected" | "entered" | "selected" | "won" | "not_selected";

export const CAMPAIGN_NAME_MAX = 80;
export const REWARD_TITLE_MAX = 80;
export const REWARD_DETAILS_MAX = 600;
export const CAMPAIGN_TERMS_MAX = 4000;
export const REJECT_REASON_MAX = 200;
export const VOUCHER_CODE_MAX = 120;
export const CODES_PER_UPLOAD_MAX = 5000;
export const WINNER_COUNT_MAX = 1000;
// Below this many codes left, the superadmin pages warn that stock is low.
export const LOW_STOCK_THRESHOLD = 20;
// How soon a claim waiting for approval is promised an answer.
export const REVIEW_PROMISE = "within 3 working days";

export const TRIGGER_LABELS: Record<string, string> = { phone_verified: "Phone number verified" };

export const SIDE_LABEL: Record<CampaignAudience, string> = { employer: "Employers", jobseeker: "Jobseekers" };
export const SIDE_ACCENT: Record<CampaignAudience, "teal" | "gold"> = { employer: "teal", jobseeker: "gold" };

export type CampaignReward = {
  id: string;
  audience: CampaignAudience;
  enabled: boolean;
  type: CampaignRewardType;
  title: string;
  details: string;
  valueRm: number | null;
  winnerCount: number;
  drawnAt: string | null;
  announcedAt: string | null;
};

export type RewardStats = {
  claims: number;
  pending: number;
  approved: number;
  rejected: number;
  entered: number;
  selected: number;
  won: number;
  codesTotal: number;
  codesAvailable: number;
  codesExpired: number;
};

/** Where a campaign actually stands right now (status + its dates). */
export type CampaignPhase = "draft" | "scheduled" | "running" | "paused" | "finished";

export type Campaign = {
  id: string;
  name: string;
  trigger: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  needsApproval: boolean;
  startsOn: string | null; // YYYY-MM-DD, Malaysia time
  endsOn: string | null;
  terms: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rewards: Record<CampaignAudience, CampaignReward>;
  stats: Record<CampaignAudience, RewardStats>;
};

export type CampaignClaimRow = {
  id: string;
  audience: CampaignAudience;
  rewardType: CampaignRewardType;
  status: CampaignClaimStatus;
  userId: string | null;
  userName: string | null;
  userEmail: string;
  phone: string;
  accountCreatedAt: string | null;
  // Employers: the company they verified for.
  companyName: string | null;
  // Quick signs it's a real account, for whoever approves.
  checks: { label: string; ok: boolean }[];
  code: string | null;
  codeExpiresOn: string | null;
  rejectReason: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

/** What one person sees about one of their rewards. */
export type UserRewardState = "reviewing" | "ready" | "not_eligible" | "in_draw" | "won" | "not_won";

export type UserReward = {
  id: string;
  campaignName: string;
  audience: CampaignAudience;
  type: CampaignRewardType;
  title: string;
  details: string;
  state: UserRewardState;
  code: string | null;
  codeExpiresOn: string | null;
  rejectReason: string | null;
  // Lucky draws: the last day to enter, for "winners announced after …".
  endsOn: string | null;
  terms: string;
  createdAt: string;
};

export type RewardHints = {
  // Extra line for the "Verify your phone number" bar, while a reward is on offer.
  verifyBarText: string | null;
  // Show "My Rewards" in the dashboard sidebar.
  hasRewards: boolean;
  // A newly earned reward not yet seen — the "You've earned a reward" popup.
  popup: UserReward | null;
};

// ───────────────────────── Malaysia-time dates ─────────────────────────
// Campaign days are whole days in Malaysia time (UTC+8, no daylight saving),
// whatever timezone the server or the superadmin's laptop is in.

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Midnight at the start of this Malaysian day. */
export function mytStartOfDay(isoDate: string): Date {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) - MYT_OFFSET_MS);
}

/** The first instant after this Malaysian day (so the whole day counts). */
export function mytEndOfDay(isoDate: string): Date {
  return new Date(mytStartOfDay(isoDate).getTime() + 24 * 60 * 60 * 1000);
}

/** The Malaysian calendar day an instant falls on. */
export function mytDate(instant: Date): string {
  return new Date(instant.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last Malaysian day of a window that ends (exclusively) at `endsAt`. */
export function mytLastDay(endsAt: Date): string {
  return mytDate(new Date(endsAt.getTime() - 1));
}

export function todayInMalaysia(): string {
  return mytDate(new Date());
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "31 Dec 2026" */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "31 Dec 2026, 3:05 pm" in Malaysia time. */
export function formatMytDateTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + MYT_OFFSET_MS);
  const h = shifted.getUTCHours();
  const mins = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${formatDay(shifted.toISOString().slice(0, 10))}, ${h % 12 || 12}:${mins} ${h < 12 ? "am" : "pm"}`;
}

export function campaignPhase(
  status: CampaignStatus,
  startsAt: Date | null,
  endsAt: Date | null,
  now = new Date(),
): CampaignPhase {
  if (status === "draft") return "draft";
  if (status === "ended") return "finished";
  if (endsAt && now >= endsAt) return "finished";
  if (status === "paused") return "paused";
  if (startsAt && now < startsAt) return "scheduled";
  return "running";
}

export const PHASE_LABEL: Record<CampaignPhase, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  running: "Live",
  paused: "Paused",
  finished: "Ended",
};

// ───────────────────────── Words people see ─────────────────────────

/** The line added to the "Verify your phone number" bar while a reward is on offer. */
export function verifyBarRewardText(type: CampaignRewardType, title: string): string {
  return type === "voucher"
    ? `Verify now to get your ${title} 🎁`
    : `Verify now to enter our lucky draw 🎁 Prize: ${title}`;
}

/** "Winners are picked after 31 Dec 2026" — or when the campaign ends. */
export function drawAnnouncementLine(endsOn: string | null): string {
  return endsOn ? `Winners are picked after ${formatDay(endsOn)}.` : "Winners are picked when the campaign ends.";
}

export const USER_STATE_LABEL: Record<UserRewardState, string> = {
  reviewing: "Being reviewed",
  ready: "Ready to use",
  not_eligible: "Not eligible",
  in_draw: "In the draw",
  won: "You won!",
  not_won: "Not selected",
};

export const CLAIM_STATUS_LABEL: Record<CampaignClaimStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  entered: "In the draw",
  selected: "Picked — waiting for approval",
  won: "Winner",
  not_selected: "Not selected",
};

/** A starting point for the terms; the superadmin edits it to fit. */
export function termsTemplate(): string {
  return [
    "1. This campaign is run by JobGiga and is open to JobGiga users in Malaysia who verify their mobile number during the campaign period.",
    "2. One reward per person and per phone number. Accounts that are fake, duplicated or created to claim extra rewards are not eligible.",
    "3. Rewards may be reviewed before they are given. JobGiga may refuse or withdraw a reward if these terms are not met.",
    "4. Vouchers are supplied by our partners, are subject to the partner's own terms and expiry date, and cannot be exchanged for cash.",
    "5. Lucky draw winners are picked at random after the campaign ends and will be told in the app and by email.",
    "6. We use your name, email and phone number only to run this campaign, in line with the Personal Data Protection Act 2010.",
    "7. JobGiga may change or end this campaign at any time.",
  ].join("\n");
}

/**
 * Turns pasted text or a CSV file into codes. One code per line; a second
 * column (comma, semicolon or tab) can hold that code's expiry as
 * YYYY-MM-DD or DD/MM/YYYY. A header row ("code", "voucher"…) is skipped.
 */
export function parseVoucherCodes(text: string): { codes: { code: string; expiresOn: string | null }[]; duplicates: number; invalid: number } {
  const seen = new Set<string>();
  const codes: { code: string; expiresOn: string | null }[] = [];
  let duplicates = 0;
  let invalid = 0;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [first, second] = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, "").trim());
    if (i === 0 && /^(voucher\s*)?codes?$|^voucher$/i.test(first)) return;
    if (!first || first.length > VOUCHER_CODE_MAX || /\s/.test(first)) {
      invalid++;
      return;
    }
    let expiresOn: string | null = null;
    if (second) {
      const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(second);
      const candidate = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : second;
      if (!isIsoDate(candidate)) {
        invalid++;
        return;
      }
      expiresOn = candidate;
    }
    if (seen.has(first)) {
      duplicates++;
      return;
    }
    seen.add(first);
    codes.push({ code: first, expiresOn });
  });
  return { codes, duplicates, invalid };
}

export function formatRm(value: number): string {
  return `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// Client-safe half of the anti-ghosting feature (the queries live in
// application-events.ts, which is server-only).

export type ApplicationEvent = {
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
};

export type EmployerResponsiveness = {
  // Median hours from application to the employer's first move on it.
  medianHours: number;
  // Share (0..1) of measurable applications that got any response.
  responseRate: number;
  sampleSize: number;
  // Applications still untouched at "applied" after 3+ days.
  waitingLong: number;
};

export type ResponsivenessBadge = {
  label: string;
  // "fast" = within 2 days, "ok" = within a week, "slow" = longer.
  tone: "fast" | "ok" | "slow";
};

/** "Usually replies within a day" etc., or null when there's no data yet. */
export function responsivenessBadge(r: EmployerResponsiveness | null | undefined): ResponsivenessBadge | null {
  if (!r) return null;
  if (r.medianHours <= 24) return { label: "Usually replies within a day", tone: "fast" };
  if (r.medianHours <= 48) return { label: "Usually replies within 2 days", tone: "fast" };
  if (r.medianHours <= 24 * 7) return { label: "Usually replies within a week", tone: "ok" };
  return { label: "Usually slow to reply", tone: "slow" };
}

export const RESPONSIVENESS_TONE_CLASS: Record<ResponsivenessBadge["tone"], string> = {
  fast: "bg-[#E7F6EC] text-[#2F9E56]",
  ok: "bg-[#E6F9FA] text-[#008990]",
  slow: "bg-[#F1F4F8] text-[#4B5468]",
};

// The jobseeker-facing tracker collapses the 12 pipeline statuses into four
// plain-language milestones.
export const TRACKER_STEPS = [
  { key: "applied", label: "Applied", statuses: ["applied"] },
  { key: "reviewed", label: "Reviewed", statuses: ["screened", "shortlisted", "kiv"] },
  { key: "interview", label: "Interview", statuses: ["interview", "interviewed", "evaluation", "evaluated"] },
  { key: "decision", label: "Decision", statuses: ["offer", "hired", "rejected", "withdrawn"] },
] as const;

export function trackerStepIndex(status: string): number {
  const index = TRACKER_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status));
  return index === -1 ? 0 : index;
}

/** When each milestone was first reached, from the event log (null if not yet). */
export function trackerStepDates(events: ApplicationEvent[], appliedAt: string): (string | null)[] {
  return TRACKER_STEPS.map((step, i) => {
    if (i === 0) return appliedAt;
    const hit = events.find((e) => (step.statuses as readonly string[]).includes(e.toStatus));
    return hit?.createdAt ?? null;
  });
}

export function formatWait(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

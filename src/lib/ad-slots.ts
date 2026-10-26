// Company ad booking rules, shared by the server (which enforces them) and
// the employer's booking calendar (which shows them) so the two never
// disagree. Dates are Malaysia calendar days as "YYYY-MM-DD" strings; a
// booking shows from its start date and is gone on its end date (exclusive).

/** Ads that can run on the employer landing page at the same time. */
export const AD_SLOTS = 10;
/** How long every booking runs. */
export const AD_RUN_DAYS = 30;
/** How far ahead a start date can be booked. */
export const AD_BOOK_AHEAD_MONTHS = 3;
/** Bookings one company can hold at once (one running, one booked next). */
export const AD_MAX_ACTIVE_PER_COMPANY = 2;
/** When the "ending soon" notification goes out. */
export const AD_ENDING_SOON_DAYS = 3;

/** Today in Malaysia, as "YYYY-MM-DD". */
export function todayMY(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUTC(toUTC(iso) + days * 86_400_000);
}

/** Same day N months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUTC(target.getTime());
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUTC(toIso) - toUTC(fromIso)) / 86_400_000);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUTC(toUTC(value)) === value;
}

export function runEndDate(start: string) {
  return addDays(start, AD_RUN_DAYS);
}

/** The latest start date that can be booked today. */
export function lastBookableStart(today: string) {
  return addMonths(today, AD_BOOK_AHEAD_MONTHS);
}

/** "21 Oct 2026" — the run's last showing day is endDate − 1. */
export function formatAdDate(iso: string, withYear = true) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatAdRun(start: string, end: string) {
  return `${formatAdDate(start, false)} – ${formatAdDate(addDays(end, -1))}`;
}

export type SlotBooking = { id: string; startDate: string; endDate: string };

export type StartCheck = { ok: true } | { ok: false; reason: "past" | "too_far" | "full" | "overlap" };

/**
 * Whether a 30-day run starting on `start` fits: no day of it already at
 * AD_SLOTS ads (counting every slot-holding booking — pending ones too,
 * since they hold their slot while being reviewed), and not overlapping this
 * company's own other bookings. `excludeId` leaves out a booking being
 * edited or moved, so it doesn't count against itself.
 */
export function checkCapacity(
  start: string,
  allBookings: SlotBooking[],
  ownBookings: SlotBooking[],
  excludeId?: string,
): StartCheck {
  const end = runEndDate(start);
  if (ownBookings.some((b) => b.id !== excludeId && b.startDate < end && start < b.endDate)) {
    return { ok: false, reason: "overlap" };
  }
  const others = allBookings.filter((b) => b.id !== excludeId && b.startDate < end && start < b.endDate);
  for (let day = start; day < end; day = addDays(day, 1)) {
    let used = 0;
    for (const b of others) if (b.startDate <= day && day < b.endDate) used++;
    if (used >= AD_SLOTS) return { ok: false, reason: "full" };
  }
  return { ok: true };
}

/** checkCapacity, plus the booking window (today up to AD_BOOK_AHEAD_MONTHS ahead). */
export function checkStart(
  start: string,
  today: string,
  allBookings: SlotBooking[],
  ownBookings: SlotBooking[],
  excludeId?: string,
): StartCheck {
  if (start < today) return { ok: false, reason: "past" };
  if (start > lastBookableStart(today)) return { ok: false, reason: "too_far" };
  return checkCapacity(start, allBookings, ownBookings, excludeId);
}

/**
 * The earliest start from `from` up to `until` with room for a full run.
 * Booking uses the normal window; moving an overdue unreviewed booking may
 * look further ahead.
 */
export function nextFreeStart(
  from: string,
  until: string,
  allBookings: SlotBooking[],
  ownBookings: SlotBooking[],
  excludeId?: string,
): string | null {
  for (let day = from; day <= until; day = addDays(day, 1)) {
    if (checkCapacity(day, allBookings, ownBookings, excludeId).ok) return day;
  }
  return null;
}

/** Slot-holding ads on one day (for "7 of 10 slots in use"). */
export function slotsInUse(day: string, allBookings: SlotBooking[]) {
  return allBookings.filter((b) => b.startDate <= day && day < b.endDate).length;
}

export type AdPhase = "pending" | "scheduled" | "live" | "ended" | "rejected";

/** What a booking is right now — approved ones are scheduled, live or ended depending on the date. */
export function adPhase(ad: { status: "pending" | "approved" | "rejected"; startDate: string; endDate: string }, today: string): AdPhase {
  if (ad.status === "rejected") return "rejected";
  if (ad.status === "pending") return "pending";
  if (today < ad.startDate) return "scheduled";
  if (today < ad.endDate) return "live";
  return "ended";
}

/**
 * checkStart for the browser calendar, which gets per-day slot counts
 * (dailySlotCounts) instead of everyone's bookings. Same rules; `excludeId`
 * (one of `ownBookings`) is taken back out of the counts while it's edited.
 */
export function checkStartFromCounts(
  start: string,
  today: string,
  counts: Record<string, number>,
  ownBookings: SlotBooking[],
  excludeId?: string,
): StartCheck {
  if (start < today) return { ok: false, reason: "past" };
  if (start > lastBookableStart(today)) return { ok: false, reason: "too_far" };
  const end = runEndDate(start);
  if (ownBookings.some((b) => b.id !== excludeId && b.startDate < end && start < b.endDate)) {
    return { ok: false, reason: "overlap" };
  }
  const excluded = ownBookings.find((b) => b.id === excludeId);
  for (let day = start; day < end; day = addDays(day, 1)) {
    const own = excluded && excluded.startDate <= day && day < excluded.endDate ? 1 : 0;
    if ((counts[day] ?? 0) - own >= AD_SLOTS) return { ok: false, reason: "full" };
  }
  return { ok: true };
}

export function nextFreeStartFromCounts(
  today: string,
  counts: Record<string, number>,
  ownBookings: SlotBooking[],
  excludeId?: string,
): string | null {
  for (let day = today; day <= lastBookableStart(today); day = addDays(day, 1)) {
    if (checkStartFromCounts(day, today, counts, ownBookings, excludeId).ok) return day;
  }
  return null;
}

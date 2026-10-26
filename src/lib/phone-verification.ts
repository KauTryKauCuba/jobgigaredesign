import "server-only";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "./db";
import { jobseekerProfiles, phoneVerificationAttempts, siteSettings, verifiedPhones } from "./db/schema";
import { sendPhoneBudgetAlertEmail } from "./email";
import { getEmployerAccess } from "./employer-profile";
import { toMalaysianMobileE164 } from "./phone";
import { getSuperadminEmails } from "./superadmin";

// Phone verification through Twilio Verify: Twilio makes the code, texts it,
// and checks it — we never see or store the code. Authenticated with an API
// key (SID + secret) and a Verify Service SID, all from the environment:
//   TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_VERIFY_SERVICE_SID
// TWILIO_VERIFY_BASE_URL exists only so tests can point at a stand-in server.

const VERIFY_BASE = process.env.TWILIO_VERIFY_BASE_URL ?? "https://verify.twilio.com/v2";
const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_RETRIES = 2;

// Anti-abuse limits. A text costs money and bots love to trigger them.
const SEND_COOLDOWN_SECONDS = 30;
const MAX_SENDS_PER_PHONE_PER_HOUR = 3;
const MAX_SENDS_PER_USER_PER_DAY = 6;
const MAX_CHECKS_PER_USER_PER_HOUR = 15;
// A call can be chosen instead of a text, but costs more, so its limits are tighter.
const MAX_CALLS_PER_PHONE_PER_HOUR = 2;
const MAX_CALLS_PER_USER_PER_DAY = 3;
// One number can't be bombarded across a whole day either (the hourly cap alone allows ~70 a day).
const MAX_SENDS_PER_PHONE_PER_DAY = 5;
const MAX_CALLS_PER_PHONE_PER_DAY = 2;
// One person making many accounts still comes from one place.
const MAX_CODES_PER_IP_PER_HOUR = 10;
// The platform-wide ceiling on texts + calls in 24 hours. Past it, new codes pause
// and the superadmins are emailed. Raise it with PHONE_VERIFICATION_DAILY_LIMIT.
const DEFAULT_PLATFORM_DAILY_LIMIT = 300;
const BUDGET_ALERT_SETTING_KEY = "phone_verification.budget_alert";

function platformDailyLimit() {
  const fromEnv = Number(process.env.PHONE_VERIFICATION_DAILY_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_PLATFORM_DAILY_LIMIT;
}

/**
 * Where a request came from. Behind the reverse proxy the real address is in
 * x-real-ip / x-forwarded-for; with neither, it's unknown (null) and the IP
 * limit simply doesn't apply to that request.
 */
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}

// With no Twilio keys, development accepts this code so the flow can be
// tried locally. Production never does.
export const DEV_VERIFICATION_CODE = "123456";

type TwilioConfig = { keySid: string; keySecret: string; serviceSid: string };

function config(): TwilioConfig | null {
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  return keySid && keySecret && serviceSid ? { keySid, keySecret, serviceSid } : null;
}

function devMode() {
  return !config() && process.env.NODE_ENV !== "production";
}

/** True when codes can actually be sent (real keys, or the local dev stand-in). */
export function isPhoneVerificationAvailable() {
  return config() !== null || devMode();
}

export type VerificationResult = { ok: true } | { ok: false; error: string; status: number; retryAfterSeconds?: number };

type TwilioResponse = { status?: string; code?: number; message?: string };

async function twilioPost(path: string, form: Record<string, string>): Promise<{ httpStatus: number; data: TwilioResponse } | null> {
  const cfg = config();
  if (!cfg) return null;
  const auth = Buffer.from(`${cfg.keySid}:${cfg.keySecret}`).toString("base64");
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      const res = await fetch(`${VERIFY_BASE}/Services/${cfg.serviceSid}/${path}`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(form),
      });
      const data = (await res.json().catch(() => ({}))) as TwilioResponse;
      return { httpStatus: res.status, data };
    } catch (err) {
      console.error(`Twilio Verify request failed (attempt ${attempt + 1}/${NETWORK_RETRIES + 1}):`, err);
    }
  }
  return null;
}

function friendlyTwilioError(code: number | undefined, fallback: string): { error: string; status: number } {
  switch (code) {
    case 60203:
      return { error: "Too many codes have been sent to this number. Try again in a while.", status: 429 };
    case 60202:
      return { error: "Too many wrong tries. Request a new code in a while.", status: 429 };
    case 60200:
    case 60205:
    case 21211:
    case 21614:
      return { error: "We can't send a text to that number. Check it's a Malaysian mobile number.", status: 400 };
    case 60223:
      // The Voice channel isn't switched on for the Verify service.
      return { error: "Phone calls aren't available right now. Try the text again in a moment.", status: 503 };
    case 21608:
      // A Twilio trial account can only text numbers registered as Verified
      // Caller IDs. Never an issue once the account is upgraded.
      return { error: "We can't text that number yet. Phone verification isn't fully open — try again later.", status: 403 };
    case 20404:
      return { error: "That code has expired. Request a new one.", status: 400 };
    default:
      return { error: fallback, status: 502 };
  }
}

// "sms" texts the code; "call" phones and reads it out — an alternative for
// when a text doesn't arrive (some phone networks filter texts from unknown senders).
export type VerificationChannel = "sms" | "call";

/** Sends a 6-digit code to a Malaysian mobile, by text or by a phone call. */
export async function sendVerificationCode(e164: string, channel: VerificationChannel = "sms"): Promise<VerificationResult> {
  if (devMode()) {
    console.log(`[dev] Phone verification code for ${e164} (by ${channel}) is ${DEV_VERIFICATION_CODE}`);
    return { ok: true };
  }
  if (!config()) return { ok: false, error: "Phone verification isn't available right now.", status: 503 };
  const result = await twilioPost("Verifications", { To: e164, Channel: channel });
  if (!result) return { ok: false, error: "Couldn't reach the text-message service. Try again.", status: 502 };
  if (result.httpStatus >= 400) {
    console.error("Twilio Verify send refused:", result.httpStatus, result.data.code, result.data.message);
    return { ok: false, ...friendlyTwilioError(result.data.code, "We couldn't send the code. Try again in a moment.") };
  }
  return { ok: true };
}

/** Checks the code the person typed. */
export async function checkVerificationCode(e164: string, code: string): Promise<VerificationResult> {
  if (devMode()) {
    return code === DEV_VERIFICATION_CODE ? { ok: true } : { ok: false, error: "That code isn't right.", status: 400 };
  }
  if (!config()) return { ok: false, error: "Phone verification isn't available right now.", status: 503 };
  const result = await twilioPost("VerificationCheck", { To: e164, Code: code });
  if (!result) return { ok: false, error: "Couldn't reach the text-message service. Try again.", status: 502 };
  if (result.httpStatus >= 400) {
    console.error("Twilio Verify check refused:", result.httpStatus, result.data.code, result.data.message);
    return { ok: false, ...friendlyTwilioError(result.data.code, "We couldn't check the code. Try again.") };
  }
  return result.data.status === "approved"
    ? { ok: true }
    : { ok: false, error: "That code isn't right.", status: 400 };
}

// ───────────────────────── Limits ─────────────────────────

async function countAttempts(where: ReturnType<typeof and>) {
  const [row] = await db.select({ n: count() }).from(phoneVerificationAttempts).where(where);
  return row?.n ?? 0;
}

export async function recordAttempt(userId: string, phone: string, action: "send" | "call" | "check", ip: string | null = null) {
  await db.insert(phoneVerificationAttempts).values({ userId, phone, action, ip });
}

/** Emails the superadmins, at most once a day, that the daily budget was reached. */
async function alertBudgetReached(sent: number, limit: number) {
  try {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, BUDGET_ALERT_SETTING_KEY)).limit(1);
    const lastAt = (setting?.value as { at?: string } | undefined)?.at;
    if (lastAt && Date.now() - new Date(lastAt).getTime() < 24 * 60 * 60 * 1000) return;
    // Recorded first, so two requests at once can't both send it.
    await db
      .insert(siteSettings)
      .values({ key: BUDGET_ALERT_SETTING_KEY, value: { at: new Date().toISOString(), sent, limit } })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: { at: new Date().toISOString(), sent, limit }, updatedAt: new Date() } });
    console.error(`Phone verification paused: ${sent} codes in 24h, daily limit ${limit}.`);
    await sendPhoneBudgetAlertEmail(getSuperadminEmails(), sent, limit);
  } catch (err) {
    console.error("Failed to send the phone verification budget alert:", err);
  }
}

/**
 * May this person be sent another code right now, by this channel? Texts and
 * calls each have limits per number and per person, with one short wait
 * between any two codes. A call costs more, so its limits are tighter.
 */
export async function checkSendAllowed(
  userId: string,
  phone: string,
  channel: VerificationChannel = "sms",
  ip: string | null = null,
): Promise<VerificationResult> {
  const now = Date.now();
  const action = channel === "call" ? "call" : "send";
  const sendOrCall = inArray(phoneVerificationAttempts.action, ["send", "call"]);

  // 1. The platform-wide ceiling: past it, nobody gets a new code until the
  //    last 24 hours' count drops, and the superadmins are told once a day.
  const platformLimit = platformDailyLimit();
  const platformSent = await countAttempts(and(sendOrCall, gt(phoneVerificationAttempts.createdAt, new Date(now - 24 * 60 * 60 * 1000))));
  if (platformSent >= platformLimit) {
    void alertBudgetReached(platformSent, platformLimit);
    return { ok: false, error: "Phone verification is paused for now. Please try again later.", status: 503 };
  }

  // 2. One place can't request codes in bulk, however many accounts it makes.
  if (ip) {
    const fromIp = await countAttempts(and(eq(phoneVerificationAttempts.ip, ip), sendOrCall, gt(phoneVerificationAttempts.createdAt, new Date(now - 60 * 60 * 1000))));
    if (fromIp >= MAX_CODES_PER_IP_PER_HOUR) {
      return { ok: false, error: "Too many codes requested from your connection. Try again in an hour.", status: 429 };
    }
  }

  // The wait between codes applies across texts and calls alike.
  const [last] = await db
    .select({ createdAt: phoneVerificationAttempts.createdAt })
    .from(phoneVerificationAttempts)
    .where(and(eq(phoneVerificationAttempts.userId, userId), inArray(phoneVerificationAttempts.action, ["send", "call"])))
    .orderBy(desc(phoneVerificationAttempts.createdAt))
    .limit(1);
  if (last) {
    const wait = SEND_COOLDOWN_SECONDS - Math.floor((now - last.createdAt.getTime()) / 1000);
    if (wait > 0) {
      return { ok: false, error: `Wait ${wait} seconds before asking for another code.`, status: 429, retryAfterSeconds: wait };
    }
  }
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [perPhone, perPhoneDay, perUser] = await Promise.all([
    countAttempts(and(eq(phoneVerificationAttempts.phone, phone), eq(phoneVerificationAttempts.action, action), gt(phoneVerificationAttempts.createdAt, hourAgo))),
    countAttempts(and(eq(phoneVerificationAttempts.phone, phone), eq(phoneVerificationAttempts.action, action), gt(phoneVerificationAttempts.createdAt, dayAgo))),
    countAttempts(and(eq(phoneVerificationAttempts.userId, userId), eq(phoneVerificationAttempts.action, action), gt(phoneVerificationAttempts.createdAt, dayAgo))),
  ]);
  const maxPerPhone = channel === "call" ? MAX_CALLS_PER_PHONE_PER_HOUR : MAX_SENDS_PER_PHONE_PER_HOUR;
  const maxPerPhoneDay = channel === "call" ? MAX_CALLS_PER_PHONE_PER_DAY : MAX_SENDS_PER_PHONE_PER_DAY;
  const maxPerUser = channel === "call" ? MAX_CALLS_PER_USER_PER_DAY : MAX_SENDS_PER_USER_PER_DAY;
  if (perPhone >= maxPerPhone) {
    return {
      ok: false,
      error: channel === "call" ? "We've already called this number a few times. Try again in an hour." : "Too many codes have been sent to this number. Try again in an hour.",
      status: 429,
    };
  }
  if (perPhoneDay >= maxPerPhoneDay) {
    return {
      ok: false,
      error: channel === "call" ? "We've already called this number today. Try again tomorrow." : "Too many codes have been sent to this number today. Try again tomorrow.",
      status: 429,
    };
  }
  if (perUser >= maxPerUser) {
    return { ok: false, error: "You've asked for too many codes today. Try again tomorrow.", status: 429 };
  }
  return { ok: true };
}

/** May this person try another code right now? */
export async function checkCheckAllowed(userId: string): Promise<VerificationResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const tries = await countAttempts(
    and(eq(phoneVerificationAttempts.userId, userId), eq(phoneVerificationAttempts.action, "check"), gt(phoneVerificationAttempts.createdAt, hourAgo)),
  );
  return tries >= MAX_CHECKS_PER_USER_PER_HOUR
    ? { ok: false, error: "Too many tries. Wait a while and ask for a new code.", status: 429 }
    : { ok: true };
}

/**
 * Jobseekers and a company's owner can verify their phone. A teammate who
 * joined someone else's company can't (their number isn't verified in v1);
 * a brand-new employer registering a company has no membership yet and can.
 */
export async function canVerifyPhone(session: { userId: string; role: string } | null): Promise<boolean> {
  if (!session) return false;
  if (session.role === "jobseeker") return true;
  if (session.role !== "employer") return false;
  const access = await getEmployerAccess(session.userId);
  return !access || access.role === "owner";
}

/**
 * What the phone field should show on its very first frame — worked out
 * while the page is built, so it doesn't load in after the page appears.
 */
export type InitialPhoneStatus = { canVerify: boolean; verified: boolean };

export async function getInitialPhoneStatus(
  session: { userId: string; role: string } | null,
  phoneAsTyped: string | null | undefined,
): Promise<InitialPhoneStatus> {
  const canVerify = (await canVerifyPhone(session)) && isPhoneVerificationAvailable();
  if (!canVerify || !session) return { canVerify, verified: false };
  return { canVerify, verified: await isPhoneVerifiedFor(session.userId, phoneAsTyped) };
}

// ───────────────────────── Who is verified ─────────────────────────

export async function markPhoneVerified(userId: string, e164: string) {
  await db
    .insert(verifiedPhones)
    .values({ userId, phone: e164 })
    .onConflictDoUpdate({ target: [verifiedPhones.userId, verifiedPhones.phone], set: { verifiedAt: new Date() } });
}

/** Is this exact number (as typed) one this person has verified? */
export async function isPhoneVerifiedFor(userId: string, phoneAsTyped: string | null | undefined): Promise<boolean> {
  const e164 = phoneAsTyped ? toMalaysianMobileE164(phoneAsTyped) : null;
  if (!e164) return false;
  const [row] = await db
    .select({ id: verifiedPhones.id })
    .from(verifiedPhones)
    .where(and(eq(verifiedPhones.userId, userId), eq(verifiedPhones.phone, e164)))
    .limit(1);
  return !!row;
}

/** Which of these jobseeker profiles currently have a verified phone? (For the employer's applicant views.) */
export async function getProfileIdsWithVerifiedPhone(jobseekerProfileIds: string[]): Promise<Set<string>> {
  if (jobseekerProfileIds.length === 0) return new Set();
  const profiles = await db
    .select({ id: jobseekerProfiles.id, userId: jobseekerProfiles.userId, phone: jobseekerProfiles.phone })
    .from(jobseekerProfiles)
    .where(inArray(jobseekerProfiles.id, [...new Set(jobseekerProfileIds)]));
  const verifiedUsers = await getUsersWithVerifiedPhone(profiles.map((p) => ({ userId: p.userId, phone: p.phone })));
  return new Set(profiles.filter((p) => verifiedUsers.has(p.userId)).map((p) => p.id));
}

/**
 * Of these people, who currently has their profile's phone verified? One
 * query; each person's profile phone is compared as an international number,
 * so a changed number no longer counts.
 */
export async function getUsersWithVerifiedPhone(people: { userId: string; phone: string | null }[]): Promise<Set<string>> {
  const out = new Set<string>();
  const wanted = people.filter((p) => p.phone && toMalaysianMobileE164(p.phone));
  if (wanted.length === 0) return out;
  const rows = await db
    .select({ userId: verifiedPhones.userId, phone: verifiedPhones.phone })
    .from(verifiedPhones)
    .where(inArray(verifiedPhones.userId, [...new Set(wanted.map((p) => p.userId))]));
  const verified = new Set(rows.map((r) => `${r.userId}|${r.phone}`));
  for (const p of wanted) {
    if (verified.has(`${p.userId}|${toMalaysianMobileE164(p.phone as string)}`)) out.add(p.userId);
  }
  return out;
}

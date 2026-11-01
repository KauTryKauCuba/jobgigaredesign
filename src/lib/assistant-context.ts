import "server-only";
import { eq } from "drizzle-orm";
import { getAiUsageForUser } from "./ai-usage";
import { db } from "./db";
import { employerProfiles, employerTeamMembers } from "./db/schema";
import type { EmployerProfile } from "./employer-profile";
import type { HiringScope } from "./hiring-scope";
import { getApplicationsForEmployer, getApplicationsForJobseeker, getJobseekerProfileId } from "./job-applications";
import { getJobPostingsForEmployer } from "./job-postings";
import { getJobseekerProfile } from "./jobseeker-profile";
import { malaysiaStateOf } from "./malaysia";

// Everything the assistant is told about the user's own data is computed
// here, server-side, as plain text with the numbers already worked out — the
// model only has to read and phrase them, never count or do date math, which
// is where LLMs quietly get things wrong. (The employer's lookup tools in
// assistant-tools.ts follow the same rule.)

const TIME_ZONE = "Asia/Kuala_Lumpur";

/** "2026-10-31" — the Malaysia calendar day this instant falls on. */
export function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

export function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-MY", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-MY", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function countBy<T>(items: T[], key: (item: T) => string): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${k} ${n}`).join(", ") || "none";
}

/**
 * Where applicants are from, by state with the towns inside it — "Selangor 5
 * (Petaling Jaya 3, Shah Alam 2); Kuala Lumpur 7" — so "how many from
 * Selangor" and "how many from Petaling Jaya" are both a lookup, not a sum.
 */
export function locationBreakdown(locations: (string | null)[]): string {
  const byState = new Map<string, Map<string, number>>();
  let unknown = 0;
  for (const raw of locations) {
    const location = raw?.trim();
    if (!location) {
      unknown++;
      continue;
    }
    const group = malaysiaStateOf(location) ?? location;
    const towns = byState.get(group) ?? new Map<string, number>();
    towns.set(location, (towns.get(location) ?? 0) + 1);
    byState.set(group, towns);
  }
  const parts = [...byState.entries()]
    .map(([state, towns]) => {
      const total = [...towns.values()].reduce((sum, n) => sum + n, 0);
      const detail = [...towns.entries()].filter(([town]) => town !== state);
      return { total, text: `${state} ${total}${detail.length ? ` (${detail.map(([t, n]) => `${t} ${n}`).join(", ")})` : ""}` };
    })
    .sort((a, b) => b.total - a.total)
    .map((p) => p.text);
  if (unknown) parts.push(`location not given ${unknown}`);
  return parts.join("; ") || "none";
}

export function todayLine(): string {
  const now = new Date();
  return `Today is ${now.toLocaleDateString("en-MY", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${dayKey(now)}, Malaysia time).`;
}

export function currentPostingSlug(pathname: string | null): string | null {
  const match = pathname?.match(/^\/employer\/jobs\/([^/]+)\/?$/);
  if (!match || match[1] === "postajob" || match[1] === "poster-generator") return null;
  return match[1];
}

// `scope` keeps a Hiring manager's (or Panel member's) assistant to what
// they can see themselves — their postings/interviews, not the whole company.
export async function buildEmployerContext(
  userId: string,
  profile: EmployerProfile,
  pathname: string | null,
  scope?: HiringScope,
) {
  const [postings, applications, team, usage] = await Promise.all([
    getJobPostingsForEmployer(profile.id, scope),
    getApplicationsForEmployer(profile.id, scope),
    db
      .select({ status: employerTeamMembers.status })
      .from(employerTeamMembers)
      .where(eq(employerTeamMembers.employerProfileId, profile.id)),
    getAiUsageForUser(userId),
  ]);

  const today = dayKey(new Date());
  const lines: string[] = [`Company: ${profile.companyName}.`];
  if (scope?.kind === "limited") {
    lines.push(
      scope.jobPostingIds.length > 0
        ? "This user is a Hiring manager: they see only the postings assigned to them (below) and candidates whose interview panel they're on."
        : "This user is a Panel member: they see only the candidates whose interview panel they're on, not job postings.",
      "The company may have other postings and applicants they can't see — never say one doesn't exist; say it isn't one they have access to.",
    );
  }

  const viewingSlug = currentPostingSlug(pathname);
  const viewing = viewingSlug ? postings.find((p) => p.slug === viewingSlug) : null;
  lines.push(
    viewing
      ? `The user is currently viewing the job posting "${viewing.title}" (id ${viewing.id}) — "this posting"/"this job" means this one.`
      : `The user is currently on page ${pathname ?? "unknown"} (not a specific job posting).`,
  );

  lines.push("", `JOB POSTINGS (${postings.length} total: ${countBy(postings, (p) => p.status)}):`);
  for (const p of postings.slice(0, 25)) {
    const apps = applications.filter((a) => a.jobPostingId === p.id);
    const left = p.openingsTotal - p.hiresConfirmed - p.offersOutstanding;
    const expiry = p.expiryDate ? `, expires ${fmtDate(p.expiryDate)}` : "";
    lines.push(
      `- "${p.title}" [id ${p.id}, status ${p.status}, ${apps.length} applicants (${countBy(apps, (a) => a.application.status)}), openings left ${Math.max(left, 0)} of ${p.openingsTotal}${expiry}, page /employer/jobs/${p.slug}]`,
    );
  }
  if (postings.length > 25) lines.push(`- …and ${postings.length - 25} more.`);

  const expiringSoon = postings.filter((p) => {
    if (p.status !== "active" || !p.expiryDate) return false;
    const d = daysBetween(today, dayKey(new Date(p.expiryDate)));
    return d >= 0 && d <= 7;
  });
  lines.push(
    `Active postings expiring within 7 days: ${expiringSoon.map((p) => `"${p.title}" (${fmtDate(p.expiryDate!)})`).join(", ") || "none"}.`,
  );

  lines.push("", `APPLICANTS (${applications.length} total across all postings):`);
  lines.push(`By stage: ${countBy(applications, (a) => a.application.status)}.`);
  lines.push(`Applied today: ${applications.filter((a) => dayKey(new Date(a.application.appliedAt)) === today).length}.`);

  const lastChecked = profile.applicantsLastCheckedAt;
  if (lastChecked) {
    const fresh = applications.filter((a) => new Date(a.application.appliedAt) > lastChecked).length;
    lines.push(`New applicants since the user last asked for new applicants (${fmtDateTime(lastChecked)}): ${fresh}.`);
  } else {
    lines.push("The user has never asked for new applicants before, so there's no previous check-in to count from.");
  }

  const hires = applications.filter((a) => a.application.status === "hired" && a.application.hiredAt);
  if (hires.length > 0) {
    const avgDays =
      hires.reduce(
        (sum, a) => sum + (new Date(a.application.hiredAt!).getTime() - new Date(a.application.appliedAt).getTime()) / 86_400_000,
        0,
      ) / hires.length;
    lines.push(`Average time to hire: ${Math.round(avgDays)} days (from ${hires.length} hires).`);
  }
  lines.push(
    `Interview no-shows: ${applications.filter((a) => a.application.interviewResponseStatus === "no_show").length}. Declined interviews: ${applications.filter((a) => a.application.interviewResponseStatus === "declined").length}.`,
  );

  const upcoming = applications
    .filter((a) => a.application.interviewDetails?.scheduledAt)
    .map((a) => ({ a, at: new Date(a.application.interviewDetails!.scheduledAt) }))
    .filter(({ at }) => {
      const d = daysBetween(today, dayKey(at));
      return d >= 0 && d < 7;
    })
    .sort((x, y) => x.at.getTime() - y.at.getTime());
  const todayCount = upcoming.filter(({ at }) => dayKey(at) === today).length;
  // Names, locations, fit scores and interview times come from the lookup
  // tools (assistant-tools.ts) — this overview stays small so every reply,
  // with or without a lookup, starts fast.
  lines.push(`Interviews in the next 7 days: ${upcoming.length}, of which ${todayCount} today.`);

  lines.push(
    "",
    `TEAM: ${team.filter((t) => t.status === "active").length} active members, ${team.filter((t) => t.status === "pending").length} pending invites.`,
    `AI USAGE: ${usage.totalCalls} AI calls, ${usage.totalTokens.toLocaleString()} tokens total.`,
  );

  return { text: lines.join("\n"), postings, applications };
}

export async function buildJobseekerContext(userId: string) {
  const [profile, profileId] = await Promise.all([getJobseekerProfile(userId), getJobseekerProfileId(userId)]);
  const rows = profileId ? await getApplicationsForJobseeker(profileId) : [];
  const lines: string[] = [];
  if (profile) lines.push(`Jobseeker: ${profile.fullName}, looking for ${profile.targetRole}.`);
  lines.push("", `APPLICATIONS (${rows.length} total: ${countBy(rows, (r) => r.application.status)}):`);
  for (const r of rows.slice(0, 25)) {
    const interview = r.application.interviewDetails?.scheduledAt
      ? `, interview ${fmtDateTime(r.application.interviewDetails.scheduledAt)} (${r.application.interviewDetails.mode}, response ${r.application.interviewResponseStatus ?? "pending"})`
      : "";
    lines.push(`- "${r.posting.title}" at ${r.companyName}, applied ${fmtDate(r.application.appliedAt)}, status ${r.application.status}${interview}`);
  }
  return lines.join("\n");
}

// Keeps "any new applicants since I last checked?" meaning "since the last
// time I asked" — bumped only when the model actually reported that number.
export async function markApplicantsChecked(profileId: string) {
  await db.update(employerProfiles).set({ applicantsLastCheckedAt: new Date() }).where(eq(employerProfiles.id, profileId));
}

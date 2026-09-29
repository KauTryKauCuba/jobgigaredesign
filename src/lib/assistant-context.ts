import "server-only";
import { eq } from "drizzle-orm";
import { getAiUsageForUser } from "./ai-usage";
import { db } from "./db";
import { employerProfiles, employerTeamMembers } from "./db/schema";
import type { EmployerProfile } from "./employer-profile";
import { getApplicationsForEmployer, getApplicationsForJobseeker, getJobseekerProfileId } from "./job-applications";
import { getJobPostingsForEmployer } from "./job-postings";
import { getJobseekerProfile } from "./jobseeker-profile";
import { computeMatchResults } from "./match-results";

// Everything the assistant is told about the user's own data is computed
// here, server-side, as plain text with the numbers already worked out — the
// model only has to read and phrase them, never count or do date math, which
// is where LLMs quietly get things wrong.

const TIME_ZONE = "Asia/Kuala_Lumpur";

function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-MY", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-MY", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countBy<T>(items: T[], key: (item: T) => string): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${k} ${n}`).join(", ") || "none";
}

export function todayLine(): string {
  const now = new Date();
  return `Today is ${now.toLocaleDateString("en-MY", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" })} (Malaysia time).`;
}

export function currentPostingSlug(pathname: string | null): string | null {
  const match = pathname?.match(/^\/employer\/jobs\/([^/]+)\/?$/);
  if (!match || match[1] === "postajob" || match[1] === "poster-generator") return null;
  return match[1];
}

export async function buildEmployerContext(userId: string, profile: EmployerProfile, pathname: string | null) {
  const [postings, applications, matches, team, usage] = await Promise.all([
    getJobPostingsForEmployer(profile.id),
    getApplicationsForEmployer(profile.id),
    computeMatchResults(profile),
    db
      .select({ status: employerTeamMembers.status })
      .from(employerTeamMembers)
      .where(eq(employerTeamMembers.employerProfileId, profile.id)),
    getAiUsageForUser(userId),
  ]);

  const today = dayKey(new Date());
  const lines: string[] = [`Company: ${profile.companyName}.`];

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
  lines.push("", `INTERVIEWS in the next 7 days (${upcoming.length}, of which ${todayCount} today):`);
  for (const { a, at } of upcoming.slice(0, 15)) {
    lines.push(
      `- ${a.applicantName} for "${a.jobPostingTitle}", ${fmtDateTime(at)}, round ${a.application.interviewDetails!.round} ${a.application.interviewDetails!.mode}, response ${a.application.interviewResponseStatus ?? "pending"}`,
    );
  }

  lines.push("", "MOST RECENT APPLICANTS:");
  for (const a of applications.slice(0, 10)) {
    lines.push(
      `- ${a.applicantName} (${a.applicantLocation ?? "location unknown"}) applied to "${a.jobPostingTitle}" on ${fmtDate(a.application.appliedAt)}, stage ${a.application.status}`,
    );
  }

  const locations = countBy(
    applications.filter((a) => a.applicantLocation),
    (a) => a.applicantLocation!,
  );
  lines.push(`Applicants by location: ${locations}.`);

  lines.push("", "TOP MATCHES (eligible candidates, 0-100 fit score) per posting:");
  for (const p of postings.filter((p) => matches.some((m) => m.jobPostingId === p.id))) {
    const top = matches.filter((m) => m.jobPostingId === p.id && m.eligible).slice(0, 3);
    lines.push(`- "${p.title}": ${top.map((m) => `${m.applicantName} ${m.score}%`).join(", ") || "no eligible candidates yet"}`);
  }

  lines.push(
    "",
    `TEAM: ${team.filter((t) => t.status === "active").length} active members, ${team.filter((t) => t.status === "pending").length} pending invites.`,
    `AI USAGE: ${usage.totalCalls} AI calls, ${usage.totalTokens.toLocaleString()} tokens total.`,
  );

  return { text: lines.join("\n"), postings };
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import SuperadminDashboardShell from "@/components/SuperadminDashboardShell";
import { getPlatformAiUsage } from "@/lib/ai-usage";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import {
  coverLetters,
  employerProfiles,
  jobApplications,
  jobPostings,
  jobseekerProfiles,
  notifications,
  savedJobs,
  videoPitches,
} from "@/lib/db/schema";
import { isSuperadminEmail } from "@/lib/superadmin";

async function countJobPostingsByStatus(status: "pending" | "active" | "flagged" | "rejected") {
  const [row] = await db
    .select({ value: count() })
    .from(jobPostings)
    .where(eq(jobPostings.status, status));
  return row?.value ?? 0;
}

// A server component renders once per request, so "now" here is per request.
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function countRows(query: Promise<{ value: number }[]>) {
  return (await query)[0]?.value ?? 0;
}

type Tile = { label: string; value: string | number; urgent?: boolean; href?: string };

function TileGrid({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <p className="mb-[12px] text-sm text-[#141B2E]">{title}</p>
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => {
            const body = (
              <>
                <span className="text-xl text-[#141B2E]">{tile.value}</span>
                <span className={`text-xs ${tile.urgent ? "text-[#A67C00]" : "text-[#4B5468]"}`}>{tile.label}</span>
              </>
            );
            const className = `flex flex-col gap-[4px] rounded-[14px] border p-[14px] ${
              tile.urgent ? "border-[#FBE7B3] bg-[#FFF3D6]" : "border-[#EAEDF2] bg-[#F8FAFB]"
            }`;
            return tile.href ? (
              <Link key={tile.label} href={tile.href} className={`${className} transition-opacity hover:opacity-80`}>
                {body}
              </Link>
            ) : (
              <div key={tile.label} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function SuperadminDashboardPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const weekAgo = daysAgo(7);
  const threeDaysAgo = daysAgo(3);

  const [
    pending,
    active,
    flagged,
    rejected,
    employerCount,
    jobseekerCount,
    applicationCount,
    applicationsThisWeek,
    interviewCount,
    hiredCount,
    waitingLongCount,
    pitchCount,
    savedJobCount,
    coverLetterCount,
    notificationsThisWeek,
    aiUsage,
  ] = await Promise.all([
    countJobPostingsByStatus("pending"),
    countJobPostingsByStatus("active"),
    countJobPostingsByStatus("flagged"),
    countJobPostingsByStatus("rejected"),
    countRows(db.select({ value: count() }).from(employerProfiles)),
    countRows(db.select({ value: count() }).from(jobseekerProfiles)),
    countRows(db.select({ value: count() }).from(jobApplications)),
    countRows(db.select({ value: count() }).from(jobApplications).where(gt(jobApplications.appliedAt, weekAgo))),
    countRows(db.select({ value: count() }).from(jobApplications).where(eq(jobApplications.status, "interview"))),
    countRows(db.select({ value: count() }).from(jobApplications).where(eq(jobApplications.status, "hired"))),
    countRows(
      db
        .select({ value: count() })
        .from(jobApplications)
        .where(and(eq(jobApplications.status, "applied"), lt(jobApplications.appliedAt, threeDaysAgo))),
    ),
    countRows(db.select({ value: count() }).from(videoPitches)),
    countRows(db.select({ value: count() }).from(savedJobs)),
    countRows(db.select({ value: count() }).from(coverLetters)),
    countRows(db.select({ value: sql<number>`count(*)::int` }).from(notifications).where(gt(notifications.createdAt, weekAgo))),
    getPlatformAiUsage(30),
  ]);

  const reviewTiles: Tile[] = [
    { label: "Pending review", value: pending, urgent: pending > 0, href: "/superadmin/job-postings" },
    { label: "Active postings", value: active, href: "/superadmin/job-postings" },
    { label: "Flagged postings", value: flagged, urgent: flagged > 0, href: "/superadmin/job-postings" },
    { label: "Rejected postings", value: rejected, href: "/superadmin/job-postings" },
    { label: "Employers", value: employerCount, href: "/superadmin/employers" },
    { label: "Jobseekers", value: jobseekerCount, href: "/superadmin/jobseekers" },
  ];

  const activityTiles: Tile[] = [
    { label: "Applications (all time)", value: applicationCount },
    { label: "Applications this week", value: applicationsThisWeek },
    { label: "Interviews scheduled", value: interviewCount },
    { label: "Hires", value: hiredCount },
    {
      label: "Applicants waiting 3+ days",
      value: waitingLongCount,
      urgent: waitingLongCount > 0,
      href: "/superadmin/employers",
    },
    { label: "Video pitches", value: pitchCount, href: "/superadmin/jobseekers" },
    { label: "Saved jobs", value: savedJobCount },
    { label: "Cover letters written", value: coverLetterCount },
    { label: "Notifications sent this week", value: notificationsThisWeek },
    {
      label: "AI cost · last 30 days (est.)",
      value: `$${aiUsage.totals.costUsd.toFixed(2)}`,
      href: "/superadmin/ai-usage",
    },
  ];

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="overview"
      heading="Superadmin"
      subheading="Platform-wide overview — the review queue, accounts, and how the platform is being used."
    >
      <div className="flex flex-col gap-[20px]">
        <TileGrid title="Review queue & accounts" tiles={reviewTiles} />
        <TileGrid title="Platform activity" tiles={activityTiles} />
      </div>
    </SuperadminDashboardShell>
  );
}

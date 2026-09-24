import "server-only";
import type { InterviewDetails } from "./applicationStatus";
import type { getApplicationsForEmployer } from "./job-applications";
import type { JobPosting } from "./job-postings";

// Forward-progress pipeline stages, in order — kiv/rejected/withdrawn are a
// side-hold and two terminal exits, not stages a "distribution" bar chart
// should imply are part of moving forward.
const FUNNEL_STAGES = [
  "applied",
  "screened",
  "shortlisted",
  "interview",
  "interviewed",
  "evaluation",
  "evaluated",
  "offer",
  "hired",
] as const;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Applications = Awaited<ReturnType<typeof getApplicationsForEmployer>>;

export function buildDashboardData(
  applications: Applications,
  postings: JobPosting[],
  applicantCounts: Record<string, number>,
  viewCounts: Record<string, number>,
) {
  const now = Date.now();

  // Calendar week (Mon 00:00 to next Mon 00:00), not a rolling "now to
  // +7 days" window — otherwise "this week" both undercounts (drops an
  // interview scheduled earlier today, even though it's still this week)
  // and drifts into next week depending on what day "today" happens to be.
  const startOfWeek = new Date(now);
  const dayOffset = startOfWeek.getDay() === 0 ? -6 : 1 - startOfWeek.getDay();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() + dayOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const stats = {
    activePostings: postings.filter((p) => p.status === "active").length,
    totalApplicants: applications.length,
    interviewsThisWeek: applications.filter((a) => {
      if (a.application.status !== "interview") return false;
      const details = a.application.interviewDetails as InterviewDetails | null;
      if (!details) return false;
      const scheduledAt = new Date(details.scheduledAt).getTime();
      return scheduledAt >= startOfWeek.getTime() && scheduledAt < endOfWeek.getTime();
    }).length,
    // "Needs your action" counts, alongside the three "state of the world"
    // tiles above — each one is something sitting in the employer's court,
    // not just a status to be aware of.
    needsEvaluation: applications.filter((a) => a.application.status === "evaluation").length,
    rescheduleRequests: applications.filter((a) => a.application.interviewResponseStatus === "reschedule_requested")
      .length,
    postingsNeedingAttention: postings.filter((p) => p.status === "rejected" || p.status === "flagged").length,
    // Skipped the scheduled interview — employer needs to decide whether to
    // give another chance or move on, not something that resolves itself.
    noShows: applications.filter((a) => a.application.interviewResponseStatus === "no_show").length,
    // Fresh applications nobody's looked at yet — the earliest possible
    // action point in the pipeline, before screening/shortlisting.
    newApplicants: applications.filter((a) => a.application.status === "applied").length,
    // Parked for later — a KIV pile that never gets revisited is a decision
    // being avoided, not made.
    kiv: applications.filter((a) => a.application.status === "kiv").length,
    // An offer sitting unanswered for a while is worth a follow-up nudge —
    // updatedAt is the closest proxy to "when this offer went out" since
    // there's no dedicated offerExtendedAt column.
    staleOffers: applications.filter((a) => {
      if (a.application.status !== "offer") return false;
      const daysSinceUpdate = (now - new Date(a.application.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate >= 3;
    }).length,
    // Interview's done but the employer hasn't started the evaluation yet —
    // distinct from needsEvaluation, which is for evaluations already
    // in-progress (status "evaluation").
    interviewedNotEvaluated: applications.filter((a) => a.application.status === "interviewed").length,
  };

  const funnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: applications.filter((a) => a.application.status === stage).length,
  }));

  const recentApplicants = applications.slice(0, 5).map((a) => ({
    applicationId: a.application.id,
    applicantName: a.applicantName,
    applicantAvatarUrl: a.applicantAvatarUrl,
    jobPostingTitle: a.jobPostingTitle,
    appliedAt: a.application.appliedAt,
    status: a.application.status,
  }));

  const upcomingInterviews = applications
    .filter((a) => {
      if (a.application.status !== "interview") return false;
      const details = a.application.interviewDetails as InterviewDetails | null;
      return details && new Date(details.scheduledAt).getTime() > now;
    })
    .sort((a, b) => {
      const aTime = new Date((a.application.interviewDetails as InterviewDetails).scheduledAt).getTime();
      const bTime = new Date((b.application.interviewDetails as InterviewDetails).scheduledAt).getTime();
      return aTime - bTime;
    })
    .slice(0, 5)
    .map((a) => {
      const details = a.application.interviewDetails as InterviewDetails;
      return {
        applicationId: a.application.id,
        applicantName: a.applicantName,
        applicantAvatarUrl: a.applicantAvatarUrl,
        jobPostingTitle: a.jobPostingTitle,
        scheduledAt: details.scheduledAt,
        mode: details.mode,
        round: details.round,
        durationMinutes: details.durationMinutes,
      };
    });

  const hiredApplications = applications.filter((a) => a.application.status === "hired");

  const hiringTrendMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    hiringTrendMap.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }
  // hiredAt is only populated for applications hired after this field was
  // added — fall back to updatedAt for older rows rather than dropping them.
  for (const a of hiredApplications) {
    const hiredAt = new Date(a.application.hiredAt ?? a.application.updatedAt);
    const key = `${hiredAt.getFullYear()}-${hiredAt.getMonth()}`;
    if (hiringTrendMap.has(key)) hiringTrendMap.set(key, (hiringTrendMap.get(key) ?? 0) + 1);
  }
  const hiringTrend = Array.from(hiringTrendMap.entries()).map(([key, hires]) => {
    const [, month] = key.split("-").map(Number);
    return { monthLabel: MONTH_LABELS[month], hires };
  });

  const timeToHireDaysList = hiredApplications.map(
    (a) =>
      (new Date(a.application.hiredAt ?? a.application.updatedAt).getTime() -
        new Date(a.application.appliedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const avgTimeToHireDays =
    timeToHireDaysList.length > 0
      ? Math.round(timeToHireDaysList.reduce((sum, d) => sum + d, 0) / timeToHireDaysList.length)
      : null;

  const postingPerformance = postings
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      applicantCount: applicantCounts[p.id] ?? 0,
      viewCount: viewCounts[p.id] ?? 0,
    }))
    .sort((a, b) => b.applicantCount - a.applicantCount)
    .slice(0, 6);

  return {
    stats,
    funnel,
    recentApplicants,
    upcomingInterviews,
    hiringTrend,
    avgTimeToHireDays,
    postingPerformance,
    hasPostings: postings.length > 0,
  };
}

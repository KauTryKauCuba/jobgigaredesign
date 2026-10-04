import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { employerProfiles, jobApplications, jobPostings, jobseekerProfiles, notifications } from "./db/schema";
import { scoreJobseekerForPosting } from "./jobseeker-match";
import { notify } from "./notifications";

// Only genuinely strong fits get an alert — a bell for every posting would
// train people to ignore it.
export const JOB_ALERT_MIN_SCORE = 70;

/**
 * Called when a posting goes live (superadmin approval): every jobseeker
 * with alerts on whose profile is a strong, eligible match — and who hasn't
 * already applied — gets a bell notification linking to the job.
 * Never throws: alerts failing must not fail the approval itself.
 */
export async function sendJobAlertsForPosting(jobPostingId: string) {
  try {
    const [row] = await db
      .select({ posting: jobPostings, companyName: employerProfiles.companyName })
      .from(jobPostings)
      .innerJoin(employerProfiles, eq(jobPostings.employerProfileId, employerProfiles.id))
      .where(eq(jobPostings.id, jobPostingId))
      .limit(1);
    if (!row || row.posting.status !== "active") return;
    const posting = row.posting;

    const link = `/jobseeker/jobs/${posting.slug}`;
    const [candidates, applied, alreadyAlerted] = await Promise.all([
      db
        .select({
          userId: jobseekerProfiles.userId,
          workAuthorization: jobseekerProfiles.workAuthorization,
          drivingLicense: jobseekerProfiles.drivingLicense,
          professionalSkills: jobseekerProfiles.professionalSkills,
          softSkills: jobseekerProfiles.softSkills,
          otherSkills: jobseekerProfiles.otherSkills,
          yearsExperience: jobseekerProfiles.yearsExperience,
          preferredIndustry: jobseekerProfiles.preferredIndustry,
          workArrangement: jobseekerProfiles.workArrangement,
          employmentType: jobseekerProfiles.employmentType,
          profileId: jobseekerProfiles.id,
        })
        .from(jobseekerProfiles)
        .where(eq(jobseekerProfiles.jobAlertsEnabled, true)),
      db
        .select({ profileId: jobApplications.jobseekerProfileId })
        .from(jobApplications)
        .where(eq(jobApplications.jobPostingId, jobPostingId)),
      // Editing a live posting sends it back through review — re-approval
      // must not alert the same people about the same job twice.
      db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(and(eq(notifications.type, "job_alert"), eq(notifications.link, link))),
    ]);
    const alreadyApplied = new Set(applied.map((a) => a.profileId));
    const alertedUserIds = new Set(alreadyAlerted.map((n) => n.userId));

    // Grouped by score so each recipient's notification shows their own %.
    const byScore = new Map<number, string[]>();
    for (const candidate of candidates) {
      if (alreadyApplied.has(candidate.profileId) || alertedUserIds.has(candidate.userId)) continue;
      const { score, eligible } = scoreJobseekerForPosting(posting, candidate);
      if (!eligible || score < JOB_ALERT_MIN_SCORE) continue;
      const list = byScore.get(score) ?? [];
      list.push(candidate.userId);
      byScore.set(score, list);
    }

    for (const [score, userIds] of byScore) {
      await notify(userIds, "jobseeker", {
        type: "job_alert",
        title: `New ${score}% match: ${posting.title}`,
        body: `${row.companyName}${posting.location ? ` · ${posting.location}` : ""}`,
        link,
      });
    }
  } catch (err) {
    console.error("Failed to send job alerts", err);
  }
}

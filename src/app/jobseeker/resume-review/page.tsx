import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import ResumeReviewView from "@/components/ResumeReviewView";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { jobseekerProfiles } from "@/lib/db/schema";
import { getJobseekerProfile } from "@/lib/jobseeker-profile";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { extractResumeText } from "@/lib/resume-parser";
import { getLatestResumeReview, loadResumeFile, resumeKind, reviewsUsedToday } from "@/lib/resume-review";
import { getSession } from "@/lib/session";

export default async function ResumeReviewPage() {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") redirect("/jobseeker");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const [authUser, profile] = await Promise.all([getAuthUser(), getJobseekerProfile(session.userId)]);
  if (!authUser || !profile) redirect("/jobseeker");

  const [[stored], latest, usedToday] = await Promise.all([
    db.select({ resumeUrl: jobseekerProfiles.resumeUrl }).from(jobseekerProfiles).where(eq(jobseekerProfiles.id, profile.id)).limit(1),
    getLatestResumeReview(profile.id),
    reviewsUsedToday(profile.id),
  ]);
  const resumeUrl = stored?.resumeUrl ?? null;
  const kind = resumeKind(resumeUrl, profile.resumeFileName);

  // Browsers can't show a Word file, so the viewer shows the text we read from it instead.
  let docxText: string | null = null;
  if (kind === "docx") {
    const file = await loadResumeFile(resumeUrl);
    docxText = file ? await extractResumeText(file.buffer, "resume.docx").catch(() => null) : null;
  }

  return (
    <ResumeReviewView
      authUser={authUser}
      resume={profile.resumeFileName ? { fileName: profile.resumeFileName, fileSize: profile.resumeFileSize } : null}
      resumeKind={resumeUrl ? kind : null}
      // Changes whenever a new file is uploaded, so the viewer reloads it.
      resumeVersion={resumeUrl ? resumeUrl.slice(-40) : null}
      docxText={docxText}
      initialReview={
        latest
          ? { result: latest.result, createdAt: latest.createdAt.toISOString(), forCurrentResume: latest.resumeUrl === resumeUrl }
          : null
      }
      initialUsedToday={usedToday}
    />
  );
}

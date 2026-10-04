import { redirect } from "next/navigation";
import AnimatedRibbon from "@/components/AnimatedRibbon";
import FloatingAssistant from "@/components/FloatingAssistant";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import JobPostingBadges from "@/components/JobPostingBadges";
import JobPostingHighlights from "@/components/JobPostingHighlights";
import JobseekerHowItWorks from "@/components/JobseekerHowItWorks";
import Navbar from "@/components/Navbar";
import ResumeUpload from "@/components/ResumeUpload";
import { getAuthUser, getJobseekerResumeInfo } from "@/lib/auth-user";
import { getAppliedJobPostingIds, getJobseekerProfileId } from "@/lib/job-applications";
import { getJobPostingsByStatus, stripCustomQuestionAnswers } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSavedJobPostingIds } from "@/lib/saved-jobs";
import { getVideoPitchForProfile } from "@/lib/video-pitch";
import { getSession } from "@/lib/session";

export default async function JobseekerPage() {
  const [onboardingRedirect, authUser, activePostings] = await Promise.all([
    getOnboardingRedirect(),
    getAuthUser(),
    getJobPostingsByStatus("active"),
  ]);
  if (onboardingRedirect) redirect(onboardingRedirect);

  // This is the public marketing page — like "/employer", it never
  // auto-redirects a signed-in visitor away. The "Jobseeker" toggle above is
  // a "preview this view" control, not a "take me to my area" shortcut; the
  // navbar's own "Dashboard" button (and the post-sign-in redirect) are what
  // actually take a jobseeker to "/jobseeker/dashboard".

  // Only meaningful for an actual jobseeker session — an employer viewing
  // this page via the toggle has no jobseeker resume to show.
  const session = authUser?.role === "jobseeker" ? await getSession() : null;
  const existingResume = session ? await getJobseekerResumeInfo(session.userId) : null;
  const jobseekerProfileId = session ? await getJobseekerProfileId(session.userId) : null;
  const [appliedJobPostingIds, savedJobPostingIds, videoPitch] = jobseekerProfileId
    ? await Promise.all([
        getAppliedJobPostingIds(jobseekerProfileId),
        getSavedJobPostingIds(jobseekerProfileId),
        getVideoPitchForProfile(jobseekerProfileId),
      ])
    : [[], [], null];

  return (
    <main id="top" className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#FDFAF0] pb-[92px]">
      <Navbar initialUser={authUser} pageRole="jobseeker" />
      <Hero
        heading={
          <>
            Start With What
            <br />
            You Already Have.
          </>
        }
        subheading="Then review it. Refine it. Make it yours."
        overlay={<JobPostingBadges />}
        belowNav={<ResumeUpload existingResume={existingResume} />}
      />
      <JobseekerHowItWorks />
      <AnimatedRibbon accent="gold" />
      <JobPostingHighlights
        postings={JSON.parse(
          JSON.stringify(activePostings.map((row) => ({ ...row, posting: stripCustomQuestionAnswers(row.posting) }))),
        )}
        canApply={authUser?.role === "jobseeker"}
        appliedJobPostingIds={appliedJobPostingIds}
        savedJobPostingIds={savedJobPostingIds}
        hasVideoPitch={!!videoPitch}
      />
      <Footer accent="gold" />
      {/* Clipped to its top half and pulled down past the floating-chat
          clearance (-mb cancels the <main> padding reserved for it) so the
          ribbon reads as bleeding off the bottom edge, same treatment as the
          jobseeker dashboard shell. */}
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon accent="gold" />
      </div>
      {/* FloatingAssistant is fixed to the viewport bottom, like the navbar
          pinned to the top — it renders here for source order, not layout. */}
      <FloatingAssistant />
    </main>
  );
}

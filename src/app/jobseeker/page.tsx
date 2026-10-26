import AnimatedRibbon from "@/components/AnimatedRibbon";
import FloatingAssistant from "@/components/FloatingAssistant";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import JobPostingBadges from "@/components/JobPostingBadges";
import JobPostingHighlights from "@/components/JobPostingHighlights";
import JobseekerHowItWorks from "@/components/JobseekerHowItWorks";
import Navbar from "@/components/Navbar";
import WelcomeModal from "@/components/WelcomeModal";
import ResumeUpload from "@/components/ResumeUpload";
import { getAuthUser, getJobseekerResumeInfo } from "@/lib/auth-user";
import { getLiveJobAds } from "@/lib/job-ads";
import { getAppliedJobPostingIds, getJobseekerProfileId } from "@/lib/job-applications";
import { getJobPostingsByStatus, stripCustomQuestionAnswers } from "@/lib/job-postings";
import { getPostingContacts } from "@/lib/posting-extras";
import { getSavedJobPostingIds } from "@/lib/saved-jobs";
import { getVideoPitchForProfile } from "@/lib/video-pitch";
import { getSession } from "@/lib/session";
import { getWelcomeImageUrl } from "@/lib/welcome-images";

export default async function JobseekerPage() {
  const [authUser, activePostings, liveJobAds, welcomeImage] = await Promise.all([
    getAuthUser(),
    getJobPostingsByStatus("active"),
    getLiveJobAds(),
    getWelcomeImageUrl("jobseeker"),
  ]);
  // Each posting's "Posted by" contact — public details only.
  const contacts = await getPostingContacts(activePostings.map((row) => row.posting));

  // This is the public marketing page — like "/employer", it never
  // auto-redirects a signed-in visitor away, not even one still in onboarding
  // (the navbar logo brings them here). The "Jobseeker" toggle above is
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
    <main id="top" className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-gold-page pb-[92px]">
      <Navbar initialUser={authUser} pageRole="jobseeker" />
      {!authUser && <WelcomeModal role="jobseeker" image={welcomeImage} />}
      <Hero
        heading={
          <>
            Start With What
            <br />
            You Already Have.
          </>
        }
        subheading="Then review it. Refine it. Make it yours."
        // The jobseeker gradient — the employer one mirrored: deep gold
        // (the jobseeker accent) flowing into teal, dark enough to read on cream.
        // (Defined in globals.css; a site theme can replace it.)
        headingGradient="var(--brand-gradient-jobseeker)"
        overlay={<JobPostingBadges />}
        belowNav={<ResumeUpload existingResume={existingResume} />}
      />
      <JobseekerHowItWorks />
      <AnimatedRibbon accent="gold" />
      <JobPostingHighlights
        postings={JSON.parse(
          JSON.stringify(
            activePostings.map((row) => ({
              ...row,
              posting: {
                ...stripCustomQuestionAnswers(row.posting),
                contact: contacts.get(`${row.posting.employerProfileId}:${row.posting.contactUserId}`) ?? null,
              },
            })),
          ),
        )}
        canApply={authUser?.role === "jobseeker"}
        appliedJobPostingIds={appliedJobPostingIds}
        savedJobPostingIds={savedJobPostingIds}
        hasVideoPitch={!!videoPitch}
        jobAds={liveJobAds.map((ad) => ({
          id: ad.id,
          jobPostingId: ad.jobPostingId,
          mediaType: ad.mediaType,
          mediaUrl: ad.mediaUrl,
          companyVerified: ad.companyVerified,
        }))}
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

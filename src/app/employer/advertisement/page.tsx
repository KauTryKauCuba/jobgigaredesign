import { redirect } from "next/navigation";
import EmployerAdvertisementTabs from "@/components/EmployerAdvertisementTabs";
import EmployerAdvertisementView from "@/components/EmployerAdvertisementView";
import EmployerDashboardShell from "@/components/EmployerDashboardShell";
import EmployerJobAdsView from "@/components/EmployerJobAdsView";
import { todayMY } from "@/lib/ad-slots";
import { getAuthUser } from "@/lib/auth-user";
import { dailySlotCounts, getCompanyAdBookings, getLiveCompanyAds, getSlotBookings, syncCompanyAds } from "@/lib/company-ads";
import { getEmployerProfileForUser, redirectScopedTeammate } from "@/lib/employer-profile";
import { getAdvertisableJobPostings, getCompanyJobAdBookings, getJobAdSlotBookings, syncJobAds } from "@/lib/job-ads";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerAdvertisementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);
  await redirectScopedTeammate(session.userId);

  const [authUser, profile, { tab }] = await Promise.all([
    getAuthUser(),
    getEmployerProfileForUser(session.userId),
    searchParams,
  ]);
  if (!authUser || !profile) redirect("/employer/onboarding");

  const today = todayMY();
  await Promise.all([syncCompanyAds(today), syncJobAds(today)]);
  const [slotBookings, { active, past }, liveAds, jobSlotBookings, jobBookings, advertisableJobs] = await Promise.all([
    getSlotBookings(today),
    getCompanyAdBookings(profile.id, today),
    getLiveCompanyAds(today),
    getJobAdSlotBookings(today),
    getCompanyJobAdBookings(profile.id, today),
    getAdvertisableJobPostings(profile.id),
  ]);
  const toView = (b: (typeof active)[number]) => ({
    id: b.id,
    mediaType: b.mediaType,
    mediaUrl: b.mediaUrl,
    headline: b.headline,
    phase: b.phase,
    rejectionReason: b.rejectionReason,
    startDate: b.startDate,
    endDate: b.endDate,
  });
  const toJobView = (b: (typeof jobBookings.active)[number]) => ({
    id: b.id,
    mediaType: b.mediaType,
    mediaUrl: b.mediaUrl,
    phase: b.phase,
    rejectionReason: b.rejectionReason,
    startDate: b.startDate,
    endDate: b.endDate,
    jobPostingId: b.jobPostingId,
    jobTitle: b.jobTitle,
    jobLocation: b.jobLocation,
    jobEmploymentType: b.jobEmploymentType,
    jobOpen: b.jobStatus === "active",
  });
  const ownSlots = (bookings: typeof slotBookings) =>
    bookings
      .filter((b) => b.employerProfileId === profile.id)
      .map((b) => ({ id: b.id, startDate: b.startDate, endDate: b.endDate }));

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="advertisement"
      heading="Advertisement"
      subheading="Promote your company and your job postings on JobGiga."
    >
      {/* key forces a remount on company switch — see dashboard/page.tsx's comment. */}
      <EmployerAdvertisementTabs
        key={profile.id}
        initialTab={tab === "job" ? "job" : "company"}
        company={
          <EmployerAdvertisementView
            company={{
              id: profile.id,
              name: profile.companyName,
              logoUrl: profile.logoUrl,
              industry: profile.industryCategory,
              verified: profile.ssmVerificationStatus === "verified",
            }}
            today={today}
            counts={dailySlotCounts(slotBookings, today)}
            ownBookings={ownSlots(slotBookings)}
            active={active.map(toView)}
            past={past.map(toView)}
            otherLiveAds={liveAds
              .filter((a) => a.companyId !== profile.id)
              .map((a) => ({
                id: a.id,
                mediaType: a.mediaType,
                mediaUrl: a.mediaUrl,
                headline: a.headline,
                companyName: a.companyName,
                companyLogoUrl: a.companyLogoUrl,
                companyIndustry: a.companyIndustry,
                companyVerified: a.companyVerified,
              }))}
          />
        }
        job={
          <EmployerJobAdsView
            company={{
              name: profile.companyName,
              logoUrl: profile.logoUrl,
              verified: profile.ssmVerificationStatus === "verified",
            }}
            jobs={advertisableJobs}
            today={today}
            counts={dailySlotCounts(jobSlotBookings, today)}
            ownBookings={ownSlots(jobSlotBookings)}
            active={jobBookings.active.map(toJobView)}
            past={jobBookings.past.map(toJobView)}
          />
        }
      />
    </EmployerDashboardShell>
  );
}

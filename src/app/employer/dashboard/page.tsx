import { redirect } from "next/navigation";
import EmployerDashboard from "@/components/EmployerDashboard";
import { getAuthUser } from "@/lib/auth-user";
import { buildDashboardData } from "@/lib/employer-dashboard";
import { getEmployerProfileForUser } from "@/lib/employer-profile";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { getApplicantCounts, getJobPostingsForEmployer, getViewCounts } from "@/lib/job-postings";
import { withCriteriaDefaults } from "@/lib/matching";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);

  let dashboardData = null;
  let loadError = false;
  try {
    const [applications, postings] = profile
      ? await Promise.all([getApplicationsForEmployer(profile.id), getJobPostingsForEmployer(profile.id)])
      : [[], []];

    const postingIds = postings.map((p) => p.id);
    const [applicantCounts, viewCounts] = await Promise.all([
      getApplicantCounts(postingIds),
      getViewCounts(postingIds),
    ]);

    dashboardData = JSON.parse(
      JSON.stringify(buildDashboardData(applications, postings, applicantCounts, viewCounts)),
    );
  } catch (err) {
    console.error("Failed to load employer dashboard data:", err);
    loadError = true;
  }

  return (
    <EmployerDashboard
      // Forces a full remount when the current company changes (the
      // switcher) — this component seeds local state from its initial*
      // props only once, so a same-instance re-render with fresh props
      // after router.refresh() would otherwise keep showing stale data.
      key={profile?.id ?? "none"}
      authUser={authUser}
      dashboardData={dashboardData}
      loadError={loadError}
      initialSmartMatchEnabled={profile?.smartMatchEnabled ?? true}
      initialCriteria={withCriteriaDefaults(profile?.smartMatchCriteria)}
    />
  );
}

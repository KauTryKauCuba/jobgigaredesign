import { redirect } from "next/navigation";
import EmployerDashboard from "@/components/EmployerDashboard";
import { getAuthUser } from "@/lib/auth-user";
import { buildDashboardData } from "@/lib/employer-dashboard";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getApplicationsForEmployer } from "@/lib/job-applications";
import { getApplicantCounts, getJobPostingsForEmployer, getViewCounts } from "@/lib/job-postings";
import { withCriteriaDefaults } from "@/lib/matching";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";
import { employerHomePath } from "@/lib/team-roles";

export default async function EmployerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const access = await getScopedEmployerAccess(session.userId);
  // A Panel member's dashboard is their interviews — they have no postings.
  if (access?.role === "panel") redirect(employerHomePath("panel"));
  const profile = access?.profile ?? null;

  let dashboardData = null;
  let loadError = false;
  try {
    // A Hiring manager's dashboard covers only their own postings.
    const [applications, postings] = access
      ? await Promise.all([
          getApplicationsForEmployer(access.profile.id, access.scope),
          getJobPostingsForEmployer(access.profile.id, access.scope),
        ])
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

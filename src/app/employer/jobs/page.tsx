import { redirect } from "next/navigation";
import EmployerJobsView from "@/components/EmployerJobsView";
import { getAuthUser } from "@/lib/auth-user";
import { getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getApplicantCounts, getJobPostingsForEmployer, getViewCounts } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";
import { employerHomePath, hasFullAccess } from "@/lib/team-roles";

export default async function EmployerJobsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const access = await getScopedEmployerAccess(session.userId);
  // A Panel member has no jobs of their own — just their interviews.
  if (access?.role === "panel") redirect(employerHomePath("panel"));
  const profile = access?.profile ?? null;
  // A Hiring manager sees only their assigned postings, read-only.
  const postings = access ? await getJobPostingsForEmployer(access.profile.id, access.scope) : [];
  const postingIds = postings.map((p) => p.id);
  const [applicantCounts, viewCounts] = await Promise.all([
    getApplicantCounts(postingIds),
    getViewCounts(postingIds),
  ]);
  const postingsWithCounts = postings.map((p) => ({
    ...p,
    applicantCount: applicantCounts[p.id] ?? 0,
    viewCount: viewCounts[p.id] ?? 0,
  }));
  // Matches the shape /api/employer/job-postings returns (timestamps as ISO
  // strings) so the client only has to deal with one representation.
  const serializedPostings = JSON.parse(JSON.stringify(postingsWithCounts));

  // key forces a remount on company switch — see dashboard/page.tsx's comment.
  return (
    <EmployerJobsView
      key={profile?.id ?? "none"}
      authUser={authUser}
      initialPostings={serializedPostings}
      canManage={!access || hasFullAccess(access.role)}
    />
  );
}

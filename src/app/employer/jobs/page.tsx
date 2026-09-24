import { redirect } from "next/navigation";
import EmployerJobsView from "@/components/EmployerJobsView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerProfileForUser } from "@/lib/employer-profile";
import { getApplicantCounts, getJobPostingsForEmployer, getViewCounts } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerJobsPage() {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  const postings = profile ? await getJobPostingsForEmployer(profile.id) : [];
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
  return <EmployerJobsView key={profile?.id ?? "none"} authUser={authUser} initialPostings={serializedPostings} />;
}

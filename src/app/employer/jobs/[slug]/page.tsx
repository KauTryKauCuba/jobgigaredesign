import { notFound, redirect } from "next/navigation";
import EmployerJobPostingView from "@/components/EmployerJobPostingView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerProfileForUser } from "@/lib/employer-profile";
import { getApplicationsForJobPosting } from "@/lib/job-applications";
import { getJobPostingForEmployerBySlug } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getSession } from "@/lib/session";

export default async function EmployerJobPostingPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const profile = await getEmployerProfileForUser(session.userId);
  if (!profile) redirect("/employer");

  const { slug } = await params;
  const posting = await getJobPostingForEmployerBySlug(profile.id, slug);
  // Active, filled, closed, and flagged postings all get this page — they're
  // the statuses that can have real applicants attached. Flagging happens to
  // a posting directly from "active" (see the superadmin flag action), so a
  // flagged posting can be weeks old with a full applicant/interview
  // history, same as closed/filled. Draft/pending/rejected never went live
  // (or never got approved), so they can't have real applicants — the
  // Manage Job list's lighter details modal covers those instead.
  if (!posting || !["active", "filled", "closed", "flagged"].includes(posting.status)) notFound();

  const [applications, addresses] = await Promise.all([
    getApplicationsForJobPosting(profile.id, posting.id),
    getEmployerAddresses(profile.id),
  ]);

  return (
    <EmployerJobPostingView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile.id}
      authUser={authUser}
      posting={JSON.parse(JSON.stringify(posting))}
      applications={JSON.parse(JSON.stringify(applications))}
      addresses={JSON.parse(JSON.stringify(addresses))}
    />
  );
}

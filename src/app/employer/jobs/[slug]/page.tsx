import { notFound, redirect } from "next/navigation";
import EmployerJobPostingView from "@/components/EmployerJobPostingView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployerAddresses, getEmployerTeamMembers } from "@/lib/employer-profile";
import { canViewJobPosting, getJobHiringManagers, getScopedEmployerAccess } from "@/lib/hiring-scope";
import { getApplicationsForJobPosting } from "@/lib/job-applications";
import { getJobPostingForEmployerBySlug } from "@/lib/job-postings";
import { getOnboardingRedirect } from "@/lib/onboarding";
import { getPostingContacts } from "@/lib/posting-extras";
import { getSession } from "@/lib/session";
import { employerHomePath, hasFullAccess } from "@/lib/team-roles";

export default async function EmployerJobPostingPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "employer") redirect("/employer");

  const onboardingRedirect = await getOnboardingRedirect();
  if (onboardingRedirect) redirect(onboardingRedirect);

  const authUser = await getAuthUser();
  if (!authUser) redirect("/employer");

  const access = await getScopedEmployerAccess(session.userId);
  if (!access) redirect("/employer");
  // A Panel member works from their interviews, not job pages.
  if (access.role === "panel") redirect(employerHomePath("panel"));
  const profile = access.profile;

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
  // A Hiring manager only gets the postings they're assigned to.
  if (!canViewJobPosting(access.scope, posting.id)) notFound();

  const [applications, addresses, teamMembers, contacts, managers] = await Promise.all([
    getApplicationsForJobPosting(profile.id, posting.id, access.scope),
    getEmployerAddresses(profile.id),
    getEmployerTeamMembers(profile.id, profile.userId),
    // The "Posted by" contact, shown as jobseekers see it.
    getPostingContacts([posting]),
    getJobHiringManagers([posting.id]),
  ]);
  const contact = contacts.get(`${posting.employerProfileId}:${posting.contactUserId}`) ?? null;
  const hiringManagerOptions = teamMembers
    .filter((m) => m.role === "hiring_manager")
    .map((m) => ({
      teamMemberId: m.id,
      name: m.name || m.email,
      email: m.email,
      position: m.position,
      avatarUrl: m.avatarUrl,
      pending: m.status === "pending",
    }));

  return (
    <EmployerJobPostingView
      // key forces a remount on company switch — see dashboard/page.tsx's comment.
      key={profile.id}
      authUser={authUser}
      posting={JSON.parse(JSON.stringify({ ...posting, contact }))}
      company={{ name: profile.companyName, logoUrl: profile.logoUrl }}
      applications={JSON.parse(JSON.stringify(applications))}
      addresses={JSON.parse(JSON.stringify(addresses))}
      currentUserRole={authUser.position}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      canManagePosting={hasFullAccess(access.role)}
      hiringManagerOptions={hiringManagerOptions}
      hiringManagerIds={(managers.get(posting.id) ?? []).map((m) => m.teamMemberId)}
    />
  );
}

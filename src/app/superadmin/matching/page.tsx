import { redirect } from "next/navigation";
import SuperadminDashboardShell from "@/components/SuperadminDashboardShell";
import SuperadminMatchingView from "@/components/SuperadminMatchingView";
import { getAuthUser } from "@/lib/auth-user";
import { getMatchMap } from "@/lib/match-map";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminMatchingPage() {
  const authUser = await getAuthUser();
  if (!authUser || !(await isSuperadminEmail(authUser.email))) redirect("/");

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="matching"
      heading="Matching"
      subheading="How live jobs and jobseekers connect — the same match score jobseekers see on job pages and in job alerts."
    >
      <SuperadminMatchingView map={await getMatchMap()} />
    </SuperadminDashboardShell>
  );
}

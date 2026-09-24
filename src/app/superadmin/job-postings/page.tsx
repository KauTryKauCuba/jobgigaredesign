import { redirect } from "next/navigation";
import SuperadminJobPostingsView from "@/components/SuperadminJobPostingsView";
import { getAuthUser } from "@/lib/auth-user";
import { getJobPostingReports, getJobPostingsByStatus } from "@/lib/job-postings";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminJobPostingsPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const [pendingRows, activeRows, flaggedRows, reportRows] = await Promise.all([
    getJobPostingsByStatus("pending"),
    getJobPostingsByStatus("active"),
    getJobPostingsByStatus("flagged"),
    getJobPostingReports(),
  ]);

  return (
    <SuperadminJobPostingsView
      authUser={authUser}
      initialPending={JSON.parse(JSON.stringify(pendingRows))}
      initialActive={JSON.parse(JSON.stringify(activeRows))}
      initialFlagged={JSON.parse(JSON.stringify(flaggedRows))}
      initialReports={JSON.parse(JSON.stringify(reportRows))}
    />
  );
}

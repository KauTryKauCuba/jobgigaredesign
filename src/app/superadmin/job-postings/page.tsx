import { redirect } from "next/navigation";
import SuperadminJobPostingsView from "@/components/SuperadminJobPostingsView";
import { getAuthUser } from "@/lib/auth-user";
import { getJobPostingReports, getJobPostingsByStatus } from "@/lib/job-postings";
import { getPostingContacts } from "@/lib/posting-extras";
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

  // Each posting's "Posted by" contact, for "View as jobseeker".
  const contacts = await getPostingContacts([...pendingRows, ...activeRows, ...flaggedRows].map((r) => r.posting));
  const withContact = (rows: typeof pendingRows) =>
    rows.map((row) => ({
      ...row,
      posting: {
        ...row.posting,
        contact: contacts.get(`${row.posting.employerProfileId}:${row.posting.contactUserId}`) ?? null,
      },
    }));

  return (
    <SuperadminJobPostingsView
      authUser={authUser}
      initialPending={JSON.parse(JSON.stringify(withContact(pendingRows)))}
      initialActive={JSON.parse(JSON.stringify(withContact(activeRows)))}
      initialFlagged={JSON.parse(JSON.stringify(withContact(flaggedRows)))}
      initialReports={JSON.parse(JSON.stringify(reportRows))}
    />
  );
}

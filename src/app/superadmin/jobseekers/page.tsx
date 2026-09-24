import { redirect } from "next/navigation";
import SuperadminJobseekersView from "@/components/SuperadminJobseekersView";
import { getAuthUser } from "@/lib/auth-user";
import { getJobseekersForSuperadmin } from "@/lib/superadmin-accounts";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminJobseekersPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const jobseekers = await getJobseekersForSuperadmin();

  return <SuperadminJobseekersView authUser={authUser} jobseekers={JSON.parse(JSON.stringify(jobseekers))} />;
}

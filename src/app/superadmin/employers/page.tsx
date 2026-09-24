import { redirect } from "next/navigation";
import SuperadminEmployersView from "@/components/SuperadminEmployersView";
import { getAuthUser } from "@/lib/auth-user";
import { getEmployersForSuperadmin } from "@/lib/superadmin-accounts";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminEmployersPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const employers = await getEmployersForSuperadmin();

  return <SuperadminEmployersView authUser={authUser} employers={JSON.parse(JSON.stringify(employers))} />;
}

import { redirect } from "next/navigation";
import SuperadminAdminsView from "@/components/SuperadminAdminsView";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminEmail, isSuperadminOwner } from "@/lib/superadmin";
import { listSuperadmins } from "@/lib/superadmin-admins";

export default async function SuperadminAdminsPage() {
  const authUser = await getAuthUser();
  if (!authUser || !(await isSuperadminEmail(authUser.email))) redirect("/");

  return (
    <SuperadminAdminsView
      authUser={authUser}
      initialAdmins={await listSuperadmins()}
      canManage={isSuperadminOwner(authUser.email)}
    />
  );
}

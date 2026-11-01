import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminPage() {
  const authUser = await getAuthUser();
  if (!authUser || !(await isSuperadminEmail(authUser.email))) redirect("/");
  redirect("/superadmin/dashboard");
}

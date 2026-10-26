import { redirect } from "next/navigation";
import SuperadminThemesView from "@/components/SuperadminThemesView";
import { getAuthUser } from "@/lib/auth-user";
import { listThemes } from "@/lib/site-themes";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminThemesPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  return <SuperadminThemesView authUser={authUser} initialThemes={await listThemes()} />;
}

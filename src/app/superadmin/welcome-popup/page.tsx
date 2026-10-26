import { redirect } from "next/navigation";
import SuperadminWelcomeView from "@/components/SuperadminWelcomeView";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminEmail } from "@/lib/superadmin";
import { getWelcomeImages } from "@/lib/welcome-images";

export default async function SuperadminWelcomePopupPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  return <SuperadminWelcomeView authUser={authUser} initialImages={await getWelcomeImages()} />;
}

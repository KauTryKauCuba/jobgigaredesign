import { redirect } from "next/navigation";
import SuperadminCompanyAdsView from "@/components/SuperadminCompanyAdsView";
import { todayMY } from "@/lib/ad-slots";
import { getAuthUser } from "@/lib/auth-user";
import { getCompanyAdsForSuperadmin, syncCompanyAds } from "@/lib/company-ads";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminCompanyAdsPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const today = todayMY();
  await syncCompanyAds(today);
  const ads = await getCompanyAdsForSuperadmin(today);

  return <SuperadminCompanyAdsView authUser={authUser} today={today} ads={JSON.parse(JSON.stringify(ads))} />;
}

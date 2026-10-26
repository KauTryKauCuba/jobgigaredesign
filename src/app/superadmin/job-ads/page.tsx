import { redirect } from "next/navigation";
import SuperadminJobAdsView from "@/components/SuperadminJobAdsView";
import { todayMY } from "@/lib/ad-slots";
import { getAuthUser } from "@/lib/auth-user";
import { getJobAdsForSuperadmin, syncJobAds } from "@/lib/job-ads";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminJobAdsPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const today = todayMY();
  await syncJobAds(today);
  const ads = await getJobAdsForSuperadmin(today);

  return <SuperadminJobAdsView authUser={authUser} today={today} ads={JSON.parse(JSON.stringify(ads))} />;
}

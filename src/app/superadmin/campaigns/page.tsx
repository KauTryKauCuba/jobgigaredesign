import { redirect } from "next/navigation";
import SuperadminCampaignsView from "@/components/SuperadminCampaignsView";
import { getAuthUser } from "@/lib/auth-user";
import { listCampaigns } from "@/lib/campaigns";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminCampaignsPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  return <SuperadminCampaignsView authUser={authUser} initialCampaigns={await listCampaigns()} />;
}

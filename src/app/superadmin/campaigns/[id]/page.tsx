import { notFound, redirect } from "next/navigation";
import SuperadminCampaignView from "@/components/SuperadminCampaignView";
import { getAuthUser } from "@/lib/auth-user";
import { getCampaign, listClaims } from "@/lib/campaigns";
import { isSuperadminEmail } from "@/lib/superadmin";

export default async function SuperadminCampaignPage({ params }: PageProps<"/superadmin/campaigns/[id]">) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return <SuperadminCampaignView authUser={authUser} initialCampaign={campaign} initialClaims={await listClaims(id)} />;
}

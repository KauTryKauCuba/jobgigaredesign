import { redirect } from "next/navigation";
import SuperadminCampaignView from "@/components/SuperadminCampaignView";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminEmail } from "@/lib/superadmin";

// The step-by-step setup for a brand-new campaign (it's created on the first "Next").
export default async function NewCampaignPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  return <SuperadminCampaignView authUser={authUser} initialCampaign={null} initialClaims={[]} />;
}

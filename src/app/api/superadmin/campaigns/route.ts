import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaigns";
import { handle, notAuthorized, readJson, requireSuperadmin } from "./auth";

export async function GET() {
  if (!(await requireSuperadmin())) return notAuthorized();
  return NextResponse.json({ campaigns: await listCampaigns() });
}

// New campaigns start as a draft with both sides on and the starter terms.
export async function POST(request: Request) {
  const admin = await requireSuperadmin();
  if (!admin) return notAuthorized();
  return handle(async () => {
    const body = await readJson(request);
    return NextResponse.json({ campaign: await createCampaign(body.name, admin.id) });
  });
}

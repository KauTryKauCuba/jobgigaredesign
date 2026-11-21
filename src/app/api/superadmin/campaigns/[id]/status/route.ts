import { NextResponse } from "next/server";
import { setCampaignStatus } from "@/lib/campaigns";
import { isUuid } from "@/lib/uuid";
import { handle, notAuthorized, readJson, requireSuperadmin } from "../../auth";

// { action: "live" | "pause" | "end" }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return handle(async () => {
    const { action } = await readJson(request);
    return NextResponse.json({ campaign: await setCampaignStatus(id, action) });
  });
}

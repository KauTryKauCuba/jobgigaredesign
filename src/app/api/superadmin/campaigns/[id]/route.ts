import { NextResponse } from "next/server";
import { deleteCampaign, getCampaign, updateCampaign } from "@/lib/campaigns";
import { isUuid } from "@/lib/uuid";
import { handle, notAuthorized, readJson, requireSuperadmin } from "../auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  const campaign = isUuid(id) ? await getCampaign(id) : null;
  if (!campaign) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return NextResponse.json({ campaign });
}

// Save the Setup tab: name, dates, approval, terms and both sides' rewards.
export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return handle(async () => NextResponse.json({ campaign: await updateCampaign(id, await readJson(request)) }));
}

// Only while nobody has claimed anything — after that, End keeps their rewards safe.
export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return handle(async () => {
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  });
}

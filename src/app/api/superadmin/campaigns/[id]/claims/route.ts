import { after, NextResponse } from "next/server";
import { deliverRewardMessages, listClaims, reviewClaims } from "@/lib/campaigns";
import { handle, notAuthorized, readJson, requireSuperadmin } from "../../auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  return handle(async () => NextResponse.json({ claims: await listClaims(id) }));
}

// Approve or reject: { ids: [...], decision: "approve" | "reject", reason? }.
// The people are told (bell + email) after the response goes out.
export async function POST(request: Request, { params }: Ctx) {
  const admin = await requireSuperadmin();
  if (!admin) return notAuthorized();
  const { id } = await params;
  return handle(async () => {
    const body = await readJson(request);
    const result = await reviewClaims(id, body.ids, body.decision, body.reason, admin.email);
    after(() => deliverRewardMessages(result.messages));
    return NextResponse.json({
      campaign: result.campaign,
      claims: await listClaims(id),
      updated: result.updated,
      replaced: result.replaced,
    });
  });
}

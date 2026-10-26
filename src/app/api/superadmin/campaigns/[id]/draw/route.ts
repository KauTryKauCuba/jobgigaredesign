import { after, NextResponse } from "next/server";
import { announceResults, deliverRewardMessages, listClaims, pickWinners, swapWinner } from "@/lib/campaigns";
import { handle, notAuthorized, readJson, requireSuperadmin } from "../../auth";

// { audience, action: "pick" | "announce" } or { action: "swap", claimId }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperadmin();
  if (!admin) return notAuthorized();
  const { id } = await params;
  return handle(async () => {
    const { audience, action, claimId } = await readJson(request);
    if (action === "pick") {
      const result = await pickWinners(id, audience);
      return NextResponse.json({ campaign: result.campaign, claims: await listClaims(id), picked: result.picked });
    }
    if (action === "swap") {
      const result = await swapWinner(id, claimId);
      return NextResponse.json({ campaign: result.campaign, claims: await listClaims(id), replaced: result.replaced });
    }
    if (action === "announce") {
      const result = await announceResults(id, audience, admin.email);
      after(() => deliverRewardMessages(result.messages));
      return NextResponse.json({ campaign: result.campaign, claims: await listClaims(id) });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  });
}

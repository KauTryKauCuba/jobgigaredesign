import { NextResponse } from "next/server";
import { addVoucherCodes, listVoucherCodes, removeVoucherCodes } from "@/lib/campaigns";
import { isUuid } from "@/lib/uuid";
import { handle, notAuthorized, readJson, requireSuperadmin } from "../../auth";

type Ctx = { params: Promise<{ id: string }> };

// ?audience=employer|jobseeker
export async function GET(request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  const audience = new URL(request.url).searchParams.get("audience");
  return handle(async () => NextResponse.json({ codes: await listVoucherCodes(id, audience) }));
}

// { audience, text (pasted lines or the CSV's contents), expiresOn? }
export async function POST(request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return handle(async () => {
    const body = await readJson(request);
    return NextResponse.json(await addVoucherCodes(id, body.audience, body.text, body.expiresOn));
  });
}

// { audience, codeId } — or codeId "unused" for every code nobody holds.
export async function DELETE(request: Request, { params }: Ctx) {
  if (!(await requireSuperadmin())) return notAuthorized();
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "That campaign no longer exists." }, { status: 404 });
  return handle(async () => {
    const body = await readJson(request);
    return NextResponse.json({ campaign: await removeVoucherCodes(id, body.audience, body.codeId) });
  });
}

import { NextResponse } from "next/server";
import { getChatScope, setCloseResolution } from "@/lib/assistant-history";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getChatScope();
  if (!scope) return NextResponse.json({ error: "Sign in to manage your chats." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const resolution = body?.resolution;
  if (resolution !== "closed" && resolution !== "kept") {
    return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
  }
  if (!(await setCloseResolution(scope, id, resolution))) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { deleteConversation, getChatScope, getConversationMessages } from "@/lib/assistant-history";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getChatScope();
  if (!scope) return NextResponse.json({ error: "Sign in to see your chats." }, { status: 401 });
  const { id } = await params;
  const messages = await getConversationMessages(scope, id);
  if (!messages) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  return NextResponse.json({ messages });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getChatScope();
  if (!scope) return NextResponse.json({ error: "Sign in to manage your chats." }, { status: 401 });
  const { id } = await params;
  if (!(await deleteConversation(scope, id))) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getChatScope, listConversations } from "@/lib/assistant-history";

export async function GET() {
  const scope = await getChatScope();
  if (!scope) return NextResponse.json({ error: "Sign in to see your chats." }, { status: 401 });
  return NextResponse.json({ conversations: await listConversations(scope) });
}

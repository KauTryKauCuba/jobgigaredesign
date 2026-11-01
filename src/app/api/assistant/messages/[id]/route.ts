import { NextResponse } from "next/server";
import { getChatScope, setSimpleActionResolution, setStageChangeResolution } from "@/lib/assistant-history";

const SIMPLE_ACTION_TYPES = ["schedule_interview", "cancel_interview", "record_evaluation", "close_posting", "create_job_posting"];

// Records how the user answered a reply's confirmation card — a stage
// change, or a single-applicant/posting action — so the saved chat shows it
// as resolved instead of offering the buttons again.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getChatScope();
  if (!scope) return NextResponse.json({ error: "Sign in to manage your chats." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const resolution = body?.resolution;

  let saved: boolean;
  if (
    (resolution === "done" || resolution === "cancelled" || resolution === "undone") &&
    (body?.results !== undefined || body?.actionType === undefined)
  ) {
    const results = body?.results && typeof body.results === "object" && !Array.isArray(body.results) ? body.results : {};
    saved = await setStageChangeResolution(scope, id, resolution, results);
  } else if ((resolution === "done" || resolution === "cancelled") && SIMPLE_ACTION_TYPES.includes(body?.actionType)) {
    const postingId = body.actionType === "create_job_posting" && typeof body.postingId === "string" ? { postingId: body.postingId } : undefined;
    saved = await setSimpleActionResolution(scope, id, body.actionType, resolution, postingId);
  } else {
    return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
  }
  if (!saved) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

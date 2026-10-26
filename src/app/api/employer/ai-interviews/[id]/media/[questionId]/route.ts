import { createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewQuestions } from "@/lib/db/schema";
import { loadEmployerApplication } from "@/lib/ai-interview-access";
import { aiInterviewFileSize, aiInterviewMediaPath } from "@/lib/ai-interview-media";
import { getAiInterviewContext } from "@/lib/ai-interview";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

// Plays one recorded answer — only for people at the company who can see this
// candidate. Supports Range requests so video can seek.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const { id, questionId } = await params;
  if (!isUuid(id) || !isUuid(questionId)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ctx = await getAiInterviewContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const found = await loadEmployerApplication(session.userId, ctx.applicationId);
  if (!found || found.access.profile.id !== ctx.employerProfileId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [question] = await db
    .select({ mediaFileName: aiInterviewQuestions.mediaFileName })
    .from(aiInterviewQuestions)
    .where(and(eq(aiInterviewQuestions.id, questionId), eq(aiInterviewQuestions.aiInterviewId, id)))
    .limit(1);
  if (!question?.mediaFileName || ctx.interview.recordingsDeletedAt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const filePath = aiInterviewMediaPath(id, question.mediaFileName);
  const size = await aiInterviewFileSize(id, question.mediaFileName);
  if (!filePath || size === null) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const contentType = question.mediaFileName.endsWith(".mp4") ? "video/mp4" : "audio/mp4";
  const headers = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    // Private candidate recordings: never cached by shared caches.
    "Cache-Control": "private, no-store",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}

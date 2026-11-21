import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { extractResumeText } from "@/lib/resume-parser";
import { getSession } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;
// About 10,000 words: plenty for a resume or job description, without one file swamping the chat.
const MAX_CHARS = 40_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const PLAIN_TEXT = /\.(txt|md|csv)$/i;
const SUPPORTED = /\.(pdf|docx|txt|md|csv)$/i;

// Reads a file's text for the assistant. Nothing is stored here: the text goes
// back to the browser and is sent with the user's message.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to attach a file." }, { status: 401 });
  if (rateLimited(`attachment:${session.userId}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "You're attaching files a bit fast — give it a few minutes." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file attached." }, { status: 400 });
  if (!SUPPORTED.test(file.name)) {
    return NextResponse.json({ error: "Attach a PDF, Word (.docx), or text file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 10 MB." }, { status: 413 });

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = PLAIN_TEXT.test(file.name) ? buffer.toString("utf8") : await extractResumeText(buffer, file.name);
  } catch {
    return NextResponse.json({ error: "Couldn't read that file." }, { status: 422 });
  }
  text = text.replace(/\u0000/g, "").trim();
  if (!text) {
    return NextResponse.json({ error: "No text found in that file. It may be a scanned image." }, { status: 422 });
  }
  return NextResponse.json({
    name: file.name.replace(/[<>"]/g, "").slice(0, 120),
    text: text.slice(0, MAX_CHARS),
    truncated: text.length > MAX_CHARS,
  });
}

import { NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { RESUME_MAX_BYTES, isSupportedResumeFile, parseResumeFile } from "@/lib/resume-parser";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "jobseeker") {
    return NextResponse.json({ error: "Not signed in as a jobseeker." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a resume file." }, { status: 400 });
  }
  if (file.size > RESUME_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large — max 10 MB." }, { status: 400 });
  }
  if (!isSupportedResumeFile(file)) {
    return NextResponse.json({ error: "Only PDF or DOCX resumes are supported." }, { status: 400 });
  }

  const result = await parseResumeFile(file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAiUsage({
    userId: session.userId,
    feature: "resume_parse",
    provider: result.provider,
    usage: result.usage,
    durationMs: result.durationMs,
  });

  return NextResponse.json({
    profile: result.profile,
    usage: result.usage,
    durationMs: result.durationMs,
    photoUrl: result.photoUrl,
  });
}

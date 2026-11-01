import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { JobPostingSuggestionError, suggestJobPosting } from "@/lib/job-posting-suggestion";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { jobTitle, companyIndustry, companySize, companyLocation } = (body ?? {}) as Record<string, unknown>;
  if (typeof jobTitle !== "string" || !jobTitle.trim()) {
    return NextResponse.json({ error: "Enter a job title first." }, { status: 400 });
  }

  try {
    const { result, usage, provider, durationMs } = await suggestJobPosting(session.userId, {
      jobTitle,
      companyIndustry: typeof companyIndustry === "string" ? companyIndustry : null,
      companySize: typeof companySize === "string" ? companySize : null,
      companyLocation: typeof companyLocation === "string" ? companyLocation : null,
    });
    return NextResponse.json({ result, usage, provider, durationMs });
  } catch (err) {
    const message = err instanceof JobPostingSuggestionError ? err.message : "Couldn't reach the suggestion service. Try again.";
    const status = err instanceof JobPostingSuggestionError ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

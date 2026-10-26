import { NextResponse } from "next/server";
import { getSalaryInsight } from "@/lib/salary-insights";
import { getSession } from "@/lib/session";

// What jobseekers on JobGiga targeting a similar role expect to earn — the
// Salary card's "Most matching candidates expect …" line.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim().slice(0, 120) ?? "";
  if (!title) return NextResponse.json({ insight: null });
  const insight = await getSalaryInsight({
    title,
    industry: params.get("industry")?.slice(0, 120) || null,
    state: params.get("state")?.slice(0, 60) || null,
  });
  return NextResponse.json({ insight });
}

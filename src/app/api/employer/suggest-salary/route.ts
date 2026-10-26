import { after, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/ai-usage";
import { isSalaryPeriod, SALARY_PERIODS } from "@/lib/job-posting-options";
import { getSession } from "@/lib/session";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20_000;

// The Salary card's "Suggest salary" — a typical range for this specific
// role, in the posting's own pay period, with a one-line reason. Like the
// posting writer (suggest-job-posting), it's a generated estimate the
// employer reviews, not verified market data.
const SYSTEM_PROMPT = `You estimate typical pay for job postings on a Malaysian hiring platform. Given a role and its details, respond with ONLY a json object, no prose, exactly this shape:
{"salaryMin": number, "salaryMax": number, "reason": string}
"salaryMin"/"salaryMax" are a realistic range in Malaysian Ringgit (RM) for the stated pay period (per month, per hour, per day, or per project), at a typical Malaysian employer in 2026 — whole numbers, min below max, sensible for the role's seniority, location (Klang Valley and Penang usually pay more than smaller towns), job type (part-time/freelance/temporary rates differ from full-time) and required experience. Never return a monthly figure when the period is hourly, daily or per project. "reason" is ONE short sentence (under 20 words) naming the main factors behind the range, e.g. "Mid-level design role in Kuala Lumpur, where demand keeps pay above the national average."`;

type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
type ProviderResponse = { choices?: { message?: { content?: string } }[]; usage?: ProviderUsage; error?: { message?: string } };
type Attempt = { content: string; usage: ProviderUsage | null; provider: string; model: string };

async function callProvider(endpoint: string, model: string, apiKey: string, userContent: string, provider: string): Promise<Attempt> {
  const upstream = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  const data: ProviderResponse = await upstream.json().catch(() => ({}));
  const content = data.choices?.[0]?.message?.content;
  if (!upstream.ok || !content) {
    console.error(`${provider} salary suggestion failed: ${upstream.status}`);
    throw new Error(data.error?.message ?? "Suggestion failed.");
  }
  return { content, usage: data.usage ?? null, provider, model };
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "employer") {
    return NextResponse.json({ error: "Not signed in as an employer." }, { status: 401 });
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  if (!deepseekKey && !mimoKey) {
    return NextResponse.json({ error: "Salary suggestions aren't configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const title = text(body.jobTitle, 120);
  if (!title) return NextResponse.json({ error: "Enter a job title first." }, { status: 400 });
  const period = isSalaryPeriod(body.salaryPeriod) ? body.salaryPeriod : "month";
  const unit = SALARY_PERIODS.find((p) => p.value === period)!.unit;
  const years = typeof body.minYearsExperience === "number" && body.minYearsExperience >= 0 ? body.minYearsExperience : null;

  const userContent = [
    `Job title: ${title}`,
    `Pay period: per ${unit}`,
    text(body.employmentType, 40) && `Job type: ${text(body.employmentType, 40).replace("_", "-")}`,
    text(body.workArrangement, 40) && `Workplace: ${text(body.workArrangement, 40)}`,
    text(body.location, 120) && `Location: ${text(body.location, 120)}`,
    text(body.industry, 120) && `Industry: ${text(body.industry, 120)}`,
    years !== null && `Minimum experience: ${years} year${years === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  const attempts: Promise<Attempt>[] = [];
  if (deepseekKey) attempts.push(callProvider(DEEPSEEK_ENDPOINT, "deepseek-chat", deepseekKey, userContent, "deepseek"));
  if (mimoKey) attempts.push(callProvider(MIMO_ENDPOINT, "mimo-v2.5", mimoKey, userContent, "mimo"));

  let won: Attempt;
  try {
    won = await Promise.any(attempts);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the suggestion service. Try again." }, { status: 502 });
  }

  // Both providers race for speed, so log every one that completed.
  after(async () => {
    const settled = await Promise.allSettled(attempts);
    await Promise.all(
      settled
        .filter((r): r is PromiseFulfilledResult<Attempt> => r.status === "fulfilled")
        .map((r) =>
          logAiUsage({
            userId: session.userId,
            feature: "salary_suggestion",
            provider: r.value.provider,
            model: r.value.model,
            usage: r.value.usage,
            durationMs: Date.now() - startedAt,
          }),
        ),
    );
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(won.content) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Couldn't understand the suggestion. Try again." }, { status: 502 });
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  let min = num(parsed.salaryMin);
  let max = num(parsed.salaryMax);
  if (min === null || max === null) {
    return NextResponse.json({ error: "Couldn't come up with a range for this role. Try again." }, { status: 502 });
  }
  if (min > max) [min, max] = [max, min];

  return NextResponse.json({
    suggestion: { min, max, period, reason: text(parsed.reason, 200) || null },
  });
}

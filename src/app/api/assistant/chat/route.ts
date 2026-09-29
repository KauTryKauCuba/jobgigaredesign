import { NextResponse } from "next/server";
import { DEEPSEEK_ENDPOINT, MIMO_ENDPOINT, type ProviderUsage } from "@/lib/ai-provider-race";
import { logAiUsage } from "@/lib/ai-usage";
import {
  buildEmployerContext,
  buildJobseekerContext,
  currentPostingSlug,
  markApplicantsChecked,
  todayLine,
} from "@/lib/assistant-context";
import {
  appendMessage,
  conversationExists,
  createConversation,
  getConversationMessages,
  type ChatScope,
} from "@/lib/assistant-history";
import type { AssistantAction } from "@/lib/assistant-types";
import { getEmployerAccess } from "@/lib/employer-profile";
import { getSession } from "@/lib/session";

type ChatMessage = { role: "user" | "assistant"; content: string };


const MAX_HISTORY = 16;
const MAX_MESSAGE_CHARS = 1500;
const REQUEST_TIMEOUT_MS = 25_000;

// In-memory, per-process — fine for this app's single-container deploy.
// Signed-out visitors (the landing pages) get a much tighter budget since
// nothing ties their usage to an account.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_SIGNED_IN = 40;
const RATE_LIMIT_ANONYMOUS = 12;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateBuckets.size > 5000) {
      for (const [k, b] of rateBuckets) if (b.resetAt <= now) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

const EMPLOYER_PATHS: Record<string, string> = {
  "/employer/dashboard": "dashboard",
  "/employer/jobs": "manage job postings",
  "/employer/jobs/postajob": "post a job",
  "/employer/jobs/poster-generator": "poster generator",
  "/employer/applicants": "applicants",
  "/employer/interviews": "interviews",
  "/employer/team": "team",
  "/employer/company": "company profile",
  "/employer/profile": "my profile / account settings",
};

const JOBSEEKER_PATHS: Record<string, string> = {
  "/jobseeker/dashboard": "dashboard, where they browse and search jobs",
  "/jobseeker/applications": "my applications",
  "/jobseeker/cover-letters": "cover letters",
  "/jobseeker/profile": "my profile / resume",
};

const PRODUCT_FACTS = `ABOUT JOBGIGA (facts you may share):
- A Malaysian hiring platform: employers post jobs and screen candidates with help from AI; jobseekers apply with one profile.
- Employers: start a company profile from just the company name (AI fills in the rest from public sources, the team reviews it); describe a role in plain words and AI drafts a full job posting; every posting is tracked (draft, pending review, active, filled, closed); move candidates through screening, shortlisting, interviews (list, board, or calendar views), evaluation, offers and hiring; AI match scores rank applicants by fit; a poster generator creates a job ad image; teammates can be invited.
- Jobseekers: upload a resume (PDF, DOC or DOCX) and skills, experience and education are pulled from it; the profile is the application, so no repeat forms; browse and filter jobs by location and type; track applications and interview invites; get AI-drafted cover letters.
- Getting set up takes a couple of minutes.`;

const STYLE_RULES = `RULES:
- Be warm, direct and brief: usually 1-3 sentences. When listing several things, use short lines starting with "- ". Plain text only: no markdown headings, tables, bold or links.
- Reply in the language the user writes in (English or Malay).
- Never invent numbers, names, dates, postings or features. If you don't have something, say so and point to where they can check.
- Refer to applicants by name or as "they"; never assume anyone's gender.
- Don't claim you did something unless it's one of your actions below.
- Stay on hiring, jobs, careers and JobGiga. Politely decline anything unrelated.`;

const NAVIGATE_RULE = `- {"type":"navigate","path":"<path>","label":"<2-4 word button text, e.g. Open interviews>","openNow":<true|false>} to link a relevant page. Set openNow true ONLY when their latest message explicitly asks to go to / open / take them to that page; otherwise false (it shows as a button they can tap). Allowed paths:`;

function pathList(paths: Record<string, string>): string {
  return Object.entries(paths)
    .map(([path, label]) => `  ${path} (${label})`)
    .join("\n");
}

function outputFormat(actions: string, extraFields = ""): string {
  return `ACTIONS you may attach (at most one per reply, or null):
${actions}

OUTPUT: respond with a single JSON object only, no other text:
{"reply": "<what to say to the user>", "action": <one action object or null>${extraFields}}`;
}

function employerSystemPrompt(dataText: string): string {
  return `You are the JobGiga Assistant, helping an employer inside their JobGiga dashboard.

${PRODUCT_FACTS}

${STYLE_RULES}
- Questions about their postings, applicants, interviews, team or usage: answer ONLY from the DATA section. The numbers there are already calculated and correct; use them as-is.

${outputFormat(`${NAVIGATE_RULE}
${pathList(EMPLOYER_PATHS)}
  /employer/jobs/<slug> (a specific posting's page; use the page path from DATA)
- {"type":"draft_job","title":"<job title>"} when they want to post / create a job for a role. This opens Post a Job with an AI-filled draft for them to review; say so.
- {"type":"close_posting","postingId":"<id from DATA>"} when they ask to close or stop applications for a posting and exactly one open posting clearly matches. The app asks them to confirm before closing, so phrase the reply as a question, e.g. "Want me to close "X"? It'll stop accepting new applications." If several could match, ask which one and use null.`, `,
  "reportedNewApplicants": <true if your reply tells them how many new applicants arrived since they last checked (including none) or that this is their first check, else false>`)}

${todayLine()}

DATA:
${dataText}`;
}

function jobseekerSystemPrompt(dataText: string): string {
  return `You are the JobGiga Assistant, helping a jobseeker inside their JobGiga dashboard. You can also give practical job-search, resume and interview advice.

${PRODUCT_FACTS}

${STYLE_RULES}
- Questions about their own applications or interviews: answer ONLY from the DATA section.

${outputFormat(`${NAVIGATE_RULE}
${pathList(JOBSEEKER_PATHS)}`)}

${todayLine()}

DATA:
${dataText}`;
}

function visitorSystemPrompt(): string {
  return `You are the JobGiga Assistant on JobGiga's public website, talking to a visitor who isn't signed in. Help them understand what JobGiga does and whether it fits them. You can't see any account data; if they ask about their own postings or applications, tell them to sign in first.

${PRODUCT_FACTS}

${STYLE_RULES}
- Don't state prices or plans; you don't have that information.

${outputFormat("- none available here; always use null.")}`;
}

type ProviderResult = { ok: true; content: string; usage: ProviderUsage | null } | { ok: false };

async function callChat(
  endpoint: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<ProviderResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: maxTokens,
        messages,
        // mimo-v2.5 reasons before answering by default, which roughly
        // tripled latency and could spend the whole max_tokens budget on
        // hidden reasoning. The context is pre-computed, so it isn't needed.
        ...(endpoint === MIMO_ENDPOINT ? { thinking: { type: "disabled" } } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!res.ok || !content) {
      console.error(`Assistant chat via ${model} failed: ${res.status}`);
      return { ok: false };
    }
    return { ok: true, content, usage: data.usage ?? null };
  } catch (err) {
    console.error(`Assistant chat via ${model} failed:`, err);
    return { ok: false };
  }
}

function parseModelOutput(content: string): {
  reply: string;
  action: Record<string, unknown> | null;
  reportedNewApplicants: boolean;
} {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    const reply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
    const action = parsed?.action && typeof parsed.action === "object" ? (parsed.action as Record<string, unknown>) : null;
    return { reply, action, reportedNewApplicants: parsed?.reportedNewApplicants === true };
  } catch {
    return { reply: cleaned, action: null, reportedNewApplicants: false };
  }
}

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string",
    )
  );
}

export async function POST(request: Request) {
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  if (!mimoKey && !deepseekKey) {
    return NextResponse.json({ error: "The assistant isn't configured yet." }, { status: 500 });
  }

  // Two request shapes: signed-in dashboards send just the new `message`
  // (plus `conversationId` to continue a saved chat) and the history comes
  // from the database; signed-out visitors aren't stored, so they send the
  // whole `messages` history themselves.
  let body: { messages?: unknown; message?: unknown; conversationId?: unknown; pathname?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 200) : null;
  const savedMode = typeof body.message === "string";
  const newMessage = savedMode ? (body.message as string).trim().slice(0, MAX_MESSAGE_CHARS) : "";
  const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  let history: ChatMessage[] = [];
  if (savedMode) {
    if (!newMessage) return NextResponse.json({ error: "Missing message." }, { status: 400 });
  } else {
    if (!isChatMessageArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Missing messages." }, { status: 400 });
    }
    history = body.messages
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
      .filter((m) => m.content.trim());
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return NextResponse.json({ error: "The last message must be from the user." }, { status: 400 });
    }
  }

  const session = await getSession();
  if (savedMode && !session) {
    return NextResponse.json({ error: "Your session has ended — sign in again to keep chatting." }, { status: 401 });
  }
  const rateKey = session
    ? `user:${session.userId}`
    : `ip:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown"}`;
  if (rateLimited(rateKey, session ? RATE_LIMIT_SIGNED_IN : RATE_LIMIT_ANONYMOUS)) {
    return NextResponse.json(
      { error: "You're sending messages a bit fast — give it a few minutes and try again." },
      { status: 429 },
    );
  }

  let systemPrompt: string;
  let employerProfileId: string | null = null;
  let employerPostings: { id: string; slug: string; title: string; status: string }[] = [];
  let allowedPaths: Record<string, string> = {};

  try {
    if (session?.role === "employer") {
      const access = await getEmployerAccess(session.userId);
      if (access) {
        const context = await buildEmployerContext(session.userId, access.profile, pathname);
        employerProfileId = access.profile.id;
        employerPostings = context.postings;
        systemPrompt = employerSystemPrompt(context.text);
      } else {
        systemPrompt = employerSystemPrompt("The employer hasn't finished setting up their company profile yet, so there's no data.");
      }
      allowedPaths = EMPLOYER_PATHS;
    } else if (session?.role === "jobseeker") {
      systemPrompt = jobseekerSystemPrompt(await buildJobseekerContext(session.userId));
      allowedPaths = JOBSEEKER_PATHS;
    } else {
      systemPrompt = visitorSystemPrompt();
    }
  } catch (err) {
    console.error("Assistant context build failed:", err);
    return NextResponse.json({ error: "Couldn't load your data right now. Try again in a moment." }, { status: 500 });
  }

  const scope: ChatScope | null = session
    ? { userId: session.userId, role: session.role, employerProfileId }
    : null;
  if (savedMode && scope) {
    if (requestedConversationId) {
      const saved = await getConversationMessages(scope, requestedConversationId);
      if (!saved) return NextResponse.json({ error: "That chat no longer exists." }, { status: 404 });
      history = saved.slice(-(MAX_HISTORY - 1)).map((m) => ({ role: m.role, content: m.text }));
    }
    history.push({ role: "user", content: newMessage });
  }

  const messages = [{ role: "system", content: systemPrompt }, ...history];
  const maxTokens = session ? 600 : 350;
  const startedAt = Date.now();

  let provider = "mimo";
  let model = "mimo-v2.5";
  let result: ProviderResult = { ok: false };
  if (mimoKey) result = await callChat(MIMO_ENDPOINT, model, mimoKey, messages, maxTokens);
  if (!result.ok && deepseekKey) {
    provider = "deepseek";
    model = "deepseek-chat";
    result = await callChat(DEEPSEEK_ENDPOINT, model, deepseekKey, messages, maxTokens);
  }
  if (!result.ok) {
    return NextResponse.json({ error: "The assistant is having trouble answering right now. Try again in a moment." }, { status: 502 });
  }

  if (session) {
    await logAiUsage({
      userId: session.userId,
      feature: "assistant_chat",
      provider,
      model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    });
  }

  const { reply, action: rawAction, reportedNewApplicants } = parseModelOutput(result.content);
  if (reportedNewApplicants && employerProfileId) await markApplicantsChecked(employerProfileId);
  let action: AssistantAction | null = null;

  if (rawAction?.type === "navigate" && typeof rawAction.path === "string") {
    const path = rawAction.path.trim();
    const postingSlug = session?.role === "employer" ? currentPostingSlug(path) : null;
    const posting = postingSlug ? employerPostings.find((p) => p.slug === postingSlug) : null;
    if (allowedPaths[path] || posting) {
      const label = typeof rawAction.label === "string" && rawAction.label.trim() ? rawAction.label.trim().slice(0, 40) : `Open ${posting?.title ?? allowedPaths[path]}`;
      action = { type: "navigate", path, label, openNow: rawAction.openNow === true };
    }
  } else if (rawAction?.type === "draft_job" && session?.role === "employer" && typeof rawAction.title === "string") {
    const title = rawAction.title.trim().slice(0, 80);
    if (title) action = { type: "draft_job", title };
  } else if (rawAction?.type === "close_posting" && typeof rawAction.postingId === "string") {
    const posting = employerPostings.find((p) => p.id === rawAction.postingId && p.status !== "closed");
    if (posting) action = { type: "close_posting", postingId: posting.id, title: posting.title };
  }

  const replyText = reply || "Sorry, I didn't catch that — could you rephrase?";

  // Saved only once there's a reply, so a failed attempt leaves nothing
  // half-written — the client keeps the unsent message and can retry it.
  let conversationId: string | null = null;
  let messageId: string | null = null;
  if (savedMode && scope) {
    conversationId =
      requestedConversationId && (await conversationExists(scope, requestedConversationId))
        ? requestedConversationId
        : await createConversation(scope, newMessage);
    await appendMessage(conversationId, "user", newMessage);
    messageId = await appendMessage(conversationId, "assistant", replyText, action);
  }

  return NextResponse.json({ reply: replyText, action, conversationId, messageId });
}

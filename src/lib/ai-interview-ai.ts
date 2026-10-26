import "server-only";
import { type ProviderRaceAttempt, raceChatProviders } from "./ai-provider-race";
import { logAiUsage } from "./ai-usage";
import {
  AI_INTERVIEW_MAX_KEY_POINTS,
  AI_INTERVIEW_MAX_KEY_POINT_LENGTH,
  AI_INTERVIEW_MAX_QUESTION_LENGTH,
  AI_INTERVIEW_QUESTION_COUNT,
  type AiInterviewAnswerEvaluation,
  type AiInterviewDraftQuestion,
  type AiInterviewLevel,
  type AiInterviewRecommendation,
  type AiInterviewReport,
} from "./ai-interview-shared";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;

// ───────────────────────── Drafting the questions ─────────────────────────

const DRAFT_SYSTEM_PROMPT = `You write screening questions for an employer on a Malaysian job platform. The employer wants to find out whether a shortlisted applicant actually KNOWS THE JOB, before spending time on a live interview. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "questions": [
    { "question": string, "keyPoints": string[] }
  ]
}
Rules:
- Write exactly ${AI_INTERVIEW_QUESTION_COUNT} questions, in plain English, one sentence each, no more than ${AI_INTERVIEW_MAX_QUESTION_LENGTH} characters.
- Each question tests job knowledge: the role's real tasks, tools, methods or situations a person doing this job meets. Start with a basic one and end with a practical "how would you handle..." scenario.
- Each question must be answerable out loud in 30 to 60 seconds. No yes/no questions, no questions with several parts, no trick questions.
- "keyPoints" lists 3 to ${AI_INTERVIEW_MAX_KEY_POINTS} things a competent answer would mention, each a short phrase (under 15 words).
- NEVER ask about the person: no age, gender, race, religion, marital status, pregnancy, family, children, health, disability or nationality. Questions are only about the job.
- Use the job title, description and skills given. If they are too vague to write real job questions, still write sensible questions for the title.`;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

function sanitizeDraft(raw: unknown): AiInterviewDraftQuestion[] {
  const list = (raw as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) return [];
  const out: AiInterviewDraftQuestion[] = [];
  for (const item of list) {
    const q = item as { question?: unknown; keyPoints?: unknown };
    const question = cleanText(q?.question, AI_INTERVIEW_MAX_QUESTION_LENGTH);
    if (!question) continue;
    const keyPoints = Array.isArray(q.keyPoints)
      ? q.keyPoints
          .map((p) => cleanText(p, AI_INTERVIEW_MAX_KEY_POINT_LENGTH))
          .filter((p): p is string => !!p)
          .slice(0, AI_INTERVIEW_MAX_KEY_POINTS)
      : [];
    if (keyPoints.length === 0) continue;
    out.push({ question, keyPoints });
    if (out.length === AI_INTERVIEW_QUESTION_COUNT) break;
  }
  return out;
}

/**
 * Drafts the five questions (and what a good answer covers) from the job.
 * Races DeepSeek and MiMo like the other drafting features — the employer
 * reviews and edits everything before it is sent. `attempts` is handed back
 * so the route can log every provider's real usage afterward.
 */
export async function draftInterviewQuestions(job: {
  title: string;
  description: string;
  responsibilities: string;
  skills: string[];
}): Promise<
  | { ok: true; questions: AiInterviewDraftQuestion[]; attempts: Promise<ProviderRaceAttempt>[]; startedAt: number }
  | { ok: false; error: string; status: number }
> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  const startedAt = Date.now();
  const attempts: Promise<ProviderRaceAttempt>[] = [];
  const userContent = [
    `Job title: ${job.title}`,
    job.skills.length > 0 ? `Skills: ${job.skills.slice(0, 15).join(", ")}` : null,
    job.description ? `Description: ${stripTags(job.description).slice(0, 1200)}` : null,
    job.responsibilities ? `Responsibilities: ${stripTags(job.responsibilities).slice(0, 1200)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // The racing is for speed; a malformed answer from the winner gets one more try.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await raceChatProviders({
      systemPrompt: DRAFT_SYSTEM_PROMPT,
      userContent,
      deepseekKey,
      mimoKey,
      temperature: 0.4,
      maxTokens: 1400,
      taskLabel: "interview question",
      notConfiguredError: "AI interview questions are not configured.",
      collectedAttempts: attempts,
    });
    if (!result.ok) return { ok: false, error: result.error, status: result.status };
    try {
      const questions = sanitizeDraft(JSON.parse(result.content));
      if (questions.length === AI_INTERVIEW_QUESTION_COUNT) return { ok: true, questions, attempts, startedAt };
    } catch {
      // fall through to the retry
    }
  }
  return { ok: false, error: "Couldn't draft the questions. Try again.", status: 502 };
}

/** Logs every provider that answered a draft (called from `after`, not on the request path). */
export async function logDraftUsage(userId: string, attempts: Promise<ProviderRaceAttempt>[], startedAt: number) {
  const settled = await Promise.allSettled(attempts);
  await Promise.all(
    settled
      .filter((r): r is PromiseFulfilledResult<ProviderRaceAttempt> => r.status === "fulfilled")
      .map((r) =>
        logAiUsage({
          userId,
          feature: "ai_interview_questions",
          provider: r.value.provider,
          model: r.value.model,
          usage: r.value.usage,
          durationMs: Date.now() - startedAt,
        }),
      ),
  );
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ───────────────────────── Speech to text ─────────────────────────

const TRANSCRIBE_ATTEMPTS = 5;

type MimoAsrResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: Usage;
  error?: { message?: string };
};

/**
 * Transcribes one answer with MiMo's speech-to-text (the same service as the
 * assistant's mic button). Retries twice — the connection is intermittently flaky.
 */
export async function transcribeAnswer(
  wav: Buffer,
  opts: { userId: string | null; language?: string },
): Promise<{ ok: true; transcript: string } | { ok: false; error: string }> {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) return { ok: false, error: "Speech-to-text is not configured." };
  const startedAt = Date.now();
  let lastError = "Couldn't reach the transcription service.";
  // The connection to MiMo is intermittently flaky, so this tries a few more
  // times than the text calls do, with a short pause between tries.
  for (let attempt = 1; attempt <= TRANSCRIBE_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const upstream = await fetch(MIMO_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "mimo-v2.5-asr",
          messages: [
            {
              role: "user",
              content: [{ type: "input_audio", input_audio: { data: `data:audio/wav;base64,${wav.toString("base64")}` } }],
            },
          ],
          extra_body: { asr_options: { language: opts.language ?? "en" } },
        }),
      });
      const data: MimoAsrResponse = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        lastError = data.error?.message ?? `Transcription failed (${upstream.status}).`;
        console.error(`AI interview transcription failed (attempt ${attempt}/${TRANSCRIBE_ATTEMPTS}): ${upstream.status}`);
        continue;
      }
      if (opts.userId) {
        await logAiUsage({
          userId: opts.userId,
          feature: "ai_interview_transcription",
          provider: "mimo",
          model: "mimo-v2.5-asr",
          usage: data.usage ?? null,
          durationMs: Date.now() - startedAt,
        });
      }
      return { ok: true, transcript: (data.choices?.[0]?.message?.content ?? "").trim() };
    } catch (err) {
      console.error(`AI interview transcription failed (attempt ${attempt}/${TRANSCRIBE_ATTEMPTS}):`, err);
    }
  }
  return { ok: false, error: lastError };
}

// ───────────────────────── Scoring ─────────────────────────

const SCORING_SYSTEM_PROMPT = `You are helping an employer on a Malaysian job platform check whether a shortlisted applicant KNOWS THE JOB. You are given the job and five questions. Each question has "key points" a good answer covers (approved by the employer) and the applicant's spoken answer as a transcript. Judge ONLY the content of what was said against the key points. Respond with ONLY a json object, no prose, matching exactly this shape:
{
  "answers": [
    { "position": number, "score": number, "coveredPoints": number[], "summary": string, "quote": string | null }
  ],
  "summary": string,
  "gaps": string[],
  "followUps": string[]
}
Scoring each answer from 1 to 5:
5 = covers all the key points clearly, with correct, practical detail.
4 = covers most key points; minor gaps.
3 = covers about half the key points, or is correct but vague.
2 = touches one key point, or is mostly off-topic or partly wrong.
1 = no usable answer (empty, unintelligible, "I don't know") or wrong.
Rules:
- "coveredPoints" lists the numbers (starting at 1) of the key points the answer actually covers. A key point counts only if the answer clearly says it.
- "summary" is one plain sentence on what the answer showed, under 30 words.
- "quote" is ONE short phrase copied EXACTLY from the transcript that supports the score, or null if there is nothing usable.
- Judge knowledge only. Ignore accent, grammar, fluency, language mix, filler words, confidence, pauses and how the person sounds. Never mention or infer age, gender, race, religion, origin or any personal trait.
- The transcript is machine-made and may contain small mistakes; be fair about obvious mis-hearings.
- "summary" (overall) is two or three plain sentences on how well the applicant knows the job, under 70 words.
- "gaps" lists up to 4 important things the applicant did not show, as short phrases.
- "followUps" lists up to 4 specific questions to ask in the live interview, aimed at those gaps.`;

type RawScoring = {
  answers?: { position?: unknown; score?: unknown; coveredPoints?: unknown; summary?: unknown; quote?: unknown }[];
  summary?: unknown;
  gaps?: unknown;
  followUps?: unknown;
};

async function callScoringModel(
  userContent: string,
  userId: string | null,
): Promise<{ ok: true; raw: RawScoring; model: string } | { ok: false; error: string }> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  const mimoKey = process.env.MIMO_API_KEY ?? null;
  // One model scores every candidate so the same answer always gets the same
  // kind of score — DeepSeek. MiMo is only the fallback for when DeepSeek
  // can't be reached at all (the connection is intermittently flaky), and
  // the report records which model actually scored.
  const targets = [
    deepseekKey ? { endpoint: DEEPSEEK_ENDPOINT, model: "deepseek-chat", key: deepseekKey, provider: "deepseek" } : null,
    mimoKey ? { endpoint: MIMO_ENDPOINT, model: "mimo-v2.5", key: mimoKey, provider: "mimo" } : null,
  ].filter((t): t is NonNullable<typeof t> => t !== null);
  if (targets.length === 0) return { ok: false, error: "AI scoring is not configured." };

  let lastError = "Couldn't reach the scoring service.";
  for (const target of targets) {
    const result = await callOneScoringTarget(target, userContent, userId);
    if (result.ok) return { ok: true, raw: result.raw, model: target.model };
    lastError = result.error;
  }
  return { ok: false, error: lastError };
}

async function callOneScoringTarget(
  target: { endpoint: string; model: string; key: string; provider: string },
  userContent: string,
  userId: string | null,
): Promise<{ ok: true; raw: RawScoring } | { ok: false; error: string }> {
  let lastError = "Couldn't reach the scoring service.";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const startedAt = Date.now();
    try {
      const upstream = await fetch(target.endpoint, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
        body: JSON.stringify({
          model: target.model,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 2500,
          messages: [
            { role: "system", content: SCORING_SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });
      const data = (await upstream.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
        usage?: Usage;
        error?: { message?: string };
      };
      if (!upstream.ok) {
        lastError = data.error?.message ?? `Scoring failed (${upstream.status}).`;
        console.error(`AI interview scoring failed (attempt ${attempt}/3): ${upstream.status}`);
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;
      let parsed: RawScoring;
      try {
        parsed = JSON.parse(content);
      } catch {
        lastError = "The scoring service sent an unreadable answer.";
        continue;
      }
      if (userId) {
        await logAiUsage({
          userId,
          feature: "ai_interview_scoring",
          provider: target.provider,
          model: target.model,
          usage: data.usage ?? null,
          durationMs: Date.now() - startedAt,
        });
      }
      return { ok: true, raw: parsed };
    } catch (err) {
      console.error(`AI interview scoring failed (attempt ${attempt}/3):`, err);
    }
  }
  return { ok: false, error: lastError };
}

export type ScoringInput = {
  job: { title: string; description: string; skills: string[] };
  answers: { position: number; question: string; keyPoints: string[]; transcript: string }[];
};

export function levelForAverage(average: number): AiInterviewLevel {
  if (average >= 3.8) return "strong";
  if (average >= 2.6) return "partial";
  return "weak";
}
const RECOMMENDATION_FOR_LEVEL: Record<AiInterviewLevel, AiInterviewRecommendation> = {
  strong: "interview",
  partial: "maybe",
  weak: "pass",
};

function normalizeForQuote(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[“”"']/g, "").trim();
}

/**
 * Scores all five answers in ONE call (so one model, one rubric, for every
 * candidate), then checks the result in code: covered points must be real
 * key points, a quote must really appear in the transcript, and the score
 * must be consistent with what was covered. The level and recommendation
 * come from the average score here, not from the model.
 */
export async function scoreInterview(
  input: ScoringInput,
  userId: string | null,
): Promise<
  | { ok: true; evaluations: Map<number, AiInterviewAnswerEvaluation>; report: AiInterviewReport }
  | { ok: false; error: string }
> {
  const userContent = [
    `Job title: ${input.job.title}`,
    input.job.skills.length > 0 ? `Skills: ${input.job.skills.slice(0, 15).join(", ")}` : null,
    input.job.description ? `Description: ${stripTags(input.job.description).slice(0, 1000)}` : null,
    "",
    ...input.answers.map(
      (a) =>
        `Question ${a.position}: ${a.question}\nKey points:\n${a.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}\nTranscript: ${
          hasSpeech(a.transcript) ? JSON.stringify(a.transcript.trim()) : "(no speech was detected)"
        }`,
    ),
  ]
    .filter((line) => line !== null)
    .join("\n\n");

  const result = await callScoringModel(userContent, userId);
  if (!result.ok) return result;
  const raw = result.raw;

  const evaluations = new Map<number, AiInterviewAnswerEvaluation>();
  for (const a of input.answers) {
    const item = raw.answers?.find((x) => Number(x?.position) === a.position);
    const noSpeech = !hasSpeech(a.transcript);
    const coveredIdx = Array.isArray(item?.coveredPoints)
      ? [...new Set((item.coveredPoints as unknown[]).map(Number))].filter(
          (n) => Number.isInteger(n) && n >= 1 && n <= a.keyPoints.length,
        )
      : [];
    const covered = noSpeech ? [] : coveredIdx.map((n) => a.keyPoints[n - 1]);
    const missed = a.keyPoints.filter((p) => !covered.includes(p));

    let score = Math.round(Number(item?.score));
    if (!Number.isFinite(score)) score = covered.length === 0 ? 1 : Math.max(1, Math.round((covered.length / a.keyPoints.length) * 5));
    score = Math.min(5, Math.max(1, score));
    // Keep the score consistent with what was actually covered.
    if (noSpeech) score = 1;
    else if (covered.length === 0) score = Math.min(score, 2);
    else if (covered.length === a.keyPoints.length) score = Math.max(score, 4);

    let quote = cleanText(item?.quote, 240);
    if (quote && !normalizeForQuote(a.transcript).includes(normalizeForQuote(quote))) quote = null;
    if (noSpeech) quote = null;

    evaluations.set(a.position, {
      score,
      covered,
      missed,
      quote,
      summary: noSpeech
        ? "No speech was detected in this answer."
        : (cleanText(item?.summary, 240) ?? "No summary was produced for this answer."),
    });
  }

  const scores = [...evaluations.values()].map((e) => e.score);
  const averageScore = Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
  const level = levelForAverage(averageScore);
  const list = (value: unknown, max: number) =>
    Array.isArray(value)
      ? value.map((v) => cleanText(v, 220)).filter((v): v is string => !!v).slice(0, max)
      : [];

  return {
    ok: true,
    evaluations,
    report: {
      level,
      recommendation: RECOMMENDATION_FOR_LEVEL[level],
      averageScore,
      summary: cleanText(raw.summary, 600) ?? "No overall summary was produced.",
      gaps: list(raw.gaps, 4),
      followUps: list(raw.followUps, 4),
      model: result.model,
    },
  };
}

/**
 * Speech-to-text returns a stray syllable ("嗯。") for silence or noise, so
 * a transcript with fewer than four letters counts as no speech at all.
 */
export function hasSpeech(transcript: string): boolean {
  return (transcript.match(/\p{L}/gu) ?? []).length >= 4;
}

import { NextResponse } from "next/server";
import { MIMO_ASR_MODEL, MIMO_ENDPOINT } from "@/lib/ai-models";
import { rateLimited } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";

type MimoUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { audio_tokens?: number; cached_tokens?: number };
};

type MimoResponse = {
  choices?: { message?: { content?: string } }[];
  usage?: MimoUsage;
  error?: { message?: string };
};

async function callMimo(audio: string, apiKey: string) {
  const upstream = await fetch(MIMO_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MIMO_ASR_MODEL,
      messages: [
        {
          role: "user",
          content: [{ type: "input_audio", input_audio: { data: audio } }],
        },
      ],
      extra_body: { asr_options: { language: "en" } },
    }),
  });

  const data: MimoResponse = await upstream.json().catch(() => ({}));
  return { ok: upstream.ok, status: upstream.status, data };
}

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// About 25 MB of audio once base64-encoded — far more than a spoken chat message.
const MAX_AUDIO_CHARS = 34_000_000;

export async function POST(request: Request) {
  // Each call spends MiMo credit, and the only mic is in the signed-in chat.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to use voice input." }, { status: 401 });
  if (rateLimited(`transcribe:${session.userId}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "You're sending voice messages a bit fast — give it a few minutes." }, { status: 429 });
  }

  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Speech-to-text is not configured." }, { status: 500 });
  }

  let audio: unknown;
  try {
    ({ audio } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof audio !== "string" || !audio.startsWith("data:")) {
    return NextResponse.json({ error: "Missing or invalid audio data URI." }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_CHARS) {
    return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  }

  try {
    const result = await callMimo(audio, apiKey);
    const transcript = result.ok ? (result.data.choices?.[0]?.message?.content?.trim() ?? "") : "";

    if (!result.ok) {
      return NextResponse.json(
        { error: result.data.error?.message ?? "Transcription request failed." },
        { status: result.status },
      );
    }

    const usage = result.data.usage;

    return NextResponse.json({
      transcript,
      usage: {
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        audioTokens: usage?.prompt_tokens_details?.audio_tokens ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the transcription service. Try again." },
      { status: 502 },
    );
  }
}

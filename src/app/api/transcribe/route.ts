import { NextResponse } from "next/server";

const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

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
      model: "mimo-v2.5-asr",
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

export async function POST(request: Request) {
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

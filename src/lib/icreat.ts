import "server-only";

const ICREAT_BASE = "https://api.icreat.ai/v1";
// "Nano Banana 2" is Google's marketing name for this model — its actual
// model id on icreat is "google/gemini-3-1-flash-image" (confirmed against
// the live API; guesses like "google/nano-banana-2" 404 as
// model_not_supported). Switched from Seedream 5.0 Lite after side-by-side
// testing: Seedream reliably garbled bullet lists/labels in a poster
// prompt, this model rendered every word correctly. Started on the "Pro"
// tier (google/gemini-3-pro-image, ~$0.14/generation) but dropped to this
// Flash tier after confirming — same test prompt, same flawless text
// rendering — at half the cost (~$0.07/generation). Bump back to Pro if
// Flash's quality ever regresses on real posters.
const IMAGE_MODEL_PATH = "google/gemini-3-1-flash-image";
// Confirmed against the live API by probing with a deliberately invalid
// value: `size` and `aspectRatio` (camelCase) are both silently ignored for
// this model, but `aspect_ratio` (snake_case) IS validated and honored —
// accepted values: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1,
// 9:16, 16:9, 21:9.
const POSTER_ASPECT_RATIO = "9:16";
// Generation normally finishes in 1-2 minutes — 10 minutes is a generous
// cutoff past which a task is treated as stuck rather than genuinely still
// running, so /poster/start and /poster/status can self-heal a posting
// whose task_id was dropped by icreat (or never transitioned out of
// PENDING/PROCESSING) instead of leaving it permanently "generating".
export const POSTER_GENERATION_STALE_MS = 10 * 60 * 1000;

export type IcreatTaskResult =
  | { status: "PENDING" }
  | { status: "PROCESSING" }
  | { status: "SUCCEEDED"; imageUrl: string; costUsd: number | null }
  | { status: "FAILED"; error: string };

function icreatKey(): string | null {
  return process.env.ICREAT_API_KEY ?? null;
}

export function isPosterGenerationConfigured(): boolean {
  return !!icreatKey();
}

export async function submitPosterImageTask(
  prompt: string,
  // Reference images — must be real hosted URLs ending in .png/.jpg/.jpeg/
  // .webp for the current model (google/gemini-3-1-flash-image); it rejects
  // data: URLs outright, unlike Seedream 5.0 which this replaced (see the
  // logoInstruction() comment in poster/start/route.ts). The employer logo
  // passed here comes from that route's own logo.png endpoint, which
  // re-encodes the stored data: URL into a real hosted PNG first.
  images?: string[],
): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const apiKey = icreatKey();
  if (!apiKey) return { ok: false, error: "Poster generation is not configured." };

  try {
    const res = await fetch(`${ICREAT_BASE}/task/submit/${IMAGE_MODEL_PATH}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        outputFormat: "png",
        watermark: false,
        aspect_ratio: POSTER_ASPECT_RATIO,
        ...(images && images.length > 0 ? { image: images.slice(0, 5) } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.task_id !== "string") {
      console.error("icreat poster image submit failed:", res.status, data);
      return { ok: false, error: "Couldn't start generating the poster." };
    }
    return { ok: true, taskId: data.task_id };
  } catch (err) {
    console.error("icreat poster image submit failed:", err);
    return { ok: false, error: "Couldn't reach the poster generation service." };
  }
}

export async function getPosterImageTaskResult(taskId: string): Promise<IcreatTaskResult> {
  const apiKey = icreatKey();
  if (!apiKey) return { status: "FAILED", error: "Poster generation is not configured." };

  try {
    const res = await fetch(`${ICREAT_BASE}/task/result`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("icreat poster image result poll failed:", res.status, data);
      return { status: "FAILED", error: "Couldn't check the poster generation status." };
    }
    if (data.status === "SUCCEEDED") {
      const imageUrl = data.result?.[0]?.url;
      if (typeof imageUrl !== "string" || !imageUrl) {
        return { status: "FAILED", error: "Poster generation finished with no image." };
      }
      const costUsd =
        typeof data.costUSD === "number"
          ? data.costUSD
          : typeof data.costUSD === "string"
            ? Number.parseFloat(data.costUSD)
            : null;
      return { status: "SUCCEEDED", imageUrl, costUsd: Number.isFinite(costUsd) ? costUsd : null };
    }
    if (data.status === "FAILED") {
      console.error("icreat poster image task failed:", data.error_code, data.error_message);
      if (data.error_code === "INSUFFICIENT_BALANCE") {
        return { status: "FAILED", error: "Poster generation is out of credit — top up the icreat.ai account." };
      }
      return { status: "FAILED", error: "Poster generation failed. Try again." };
    }
    // Any other status (e.g. "SUBMITTED", or a future value) is treated as
    // still in progress — the caller only distinguishes SUCCEEDED/FAILED
    // from "not done yet".
    return { status: "PROCESSING" };
  } catch (err) {
    console.error("icreat poster image result poll failed:", err);
    return { status: "FAILED", error: "Couldn't reach the poster generation service." };
  }
}

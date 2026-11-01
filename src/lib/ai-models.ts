import "server-only";

// Every AI provider endpoint and model name the app calls, in one place — so
// when a provider retires a model (MiMo dropped "mimo-v2.5" in Oct 2026),
// switching is a one-line change here. The AI Usage dashboard logs whatever
// model string was sent, so its history still shows the old names.

export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const MIMO_ENDPOINT = "https://api.xiaomimimo.com/v1/chat/completions";

/** DeepSeek's general chat model — JSON-mode tasks and the assistant. */
export const DEEPSEEK_CHAT_MODEL = "deepseek-chat";
/** MiMo's fast, low-cost chat model — raced against DeepSeek on every text task. */
export const MIMO_CHAT_MODEL = "mimo-v2.6-flash";
/** MiMo's speech-to-text model — voice input and AI interview answers. */
export const MIMO_ASR_MODEL = "mimo-v2.5-asr";

/**
 * Extra request fields for a chat completion on this endpoint. MiMo's chat
 * models reason before answering by default — on a short JSON task that took
 * ~50s and spent the whole max_tokens budget, vs ~2.5s with it off — and none
 * of our prompts need it.
 */
export function chatRequestExtras(endpoint: string) {
  return endpoint === MIMO_ENDPOINT ? { thinking: { type: "disabled" } } : {};
}

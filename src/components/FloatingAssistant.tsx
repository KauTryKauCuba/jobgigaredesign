"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantAction, AssistantConversationSummary, AssistantMessage } from "@/lib/assistant-types";
import { ArrowUp, ClockIcon, MicIcon, PlusIcon, TrashIcon, XIcon } from "./icons";
import SiriOrb from "./SiriOrb";

type Message = AssistantMessage | { id: string; role: "error"; text: string };

type Audience = "employer" | "jobseeker" | "visitor";

const SUGGESTIONS: Record<Audience, string[]> = {
  employer: [
    "How are my job postings doing?",
    "Any interviews this week?",
    "Who's my top applicant?",
    "Post a job for a sales executive",
  ],
  jobseeker: ["What's the status of my applications?", "Do I have any interviews?", "Tips for my next interview"],
  visitor: ["What does JobGiga do?", "How long does it take to set up?", "How does AI screening work?"],
};

function audienceFor(pathname: string | null): Audience {
  if (pathname?.startsWith("/employer/")) return "employer";
  if (pathname?.startsWith("/jobseeker/")) return "jobseeker";
  return "visitor";
}

// Each dashboard page renders its own shell (and so its own copy of this
// widget), so the open chat is mirrored here to survive navigation —
// including navigation the assistant itself triggers. For signed-in users
// this is only a cache of the current chat; the saved history lives in the
// database.
const STORAGE_PREFIX = "jobgiga-assistant:";

type StoredState = { messages: Message[]; open: boolean; conversationId: string | null };

function loadState(audience: Audience): StoredState {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + audience);
    if (raw) return { conversationId: null, ...JSON.parse(raw) };
  } catch {}
  return { messages: [], open: false, conversationId: null };
}

function saveState(audience: Audience, state: StoredState) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + audience, JSON.stringify({ ...state, messages: state.messages.slice(-40) }));
  } catch {}
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * MediaRecorder only ever encodes Opus (in a webm or mp4 box, depending on
 * browser) — MiMo's parser doesn't accept Opus in either container, only
 * true WAV/MP3/FLAC/AAC. Decoding via Web Audio and re-muxing to a plain
 * WAV file sidesteps the codec mismatch entirely.
 */
async function toWavBlob(blob: Blob): Promise<Blob> {
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  try {
    return encodeWav(await audioCtx.decodeAudioData(await blob.arrayBuffer()));
  } finally {
    await audioCtx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const blockAlign = numChannels * 2;
  const dataSize = buffer.length * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numChannels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

// Replies are plain text by instruction, but may contain "- " bullet lines
// and paragraph breaks — render those as real structure instead of a wall
// of text with literal dashes.
function FormattedReply({ text }: { text: string }) {
  const blocks: ({ type: "p"; text: string } | { type: "ul"; items: string[] })[] = [];
  for (const raw of text.replace(/\*\*/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•*]\s+(.*)/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  return (
    <div className="flex flex-col gap-[6px]">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="flex flex-col gap-[3px] pl-[14px]">
            {b.items.map((item, j) => (
              <li key={j} className="list-disc marker:text-[#9AA3B2]">
                {item}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export default function FloatingAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const audience = audienceFor(pathname);
  // Dashboards are always signed in, so their chats are saved to the
  // account; the public landing pages only keep a chat for the tab.
  const saved = audience !== "visitor";
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversations, setConversations] = useState<AssistantConversationSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  // Voice input resolves asynchronously (record, then transcribe) — these
  // let it send against the chat as it is by then, not as it was when
  // recording started.
  const inputValueRef = useRef(input);
  const messagesRef = useRef(messages);
  const conversationIdRef = useRef(conversationId);
  const thinkingRef = useRef(thinking);

  useEffect(() => {
    const stored = loadState(audience);
    // Restoring from sessionStorage has to happen after mount — reading it
    // during render would mismatch the server-rendered (empty) markup.
    setMessages(stored.messages);
    setConversationId(saved ? stored.conversationId : null);
    setOpen(stored.open && stored.messages.length > 0);
    setHydrated(true);
  }, [audience, saved]);

  useEffect(() => {
    if (hydrated) saveState(audience, { messages, open, conversationId });
  }, [audience, messages, open, conversationId, hydrated]);

  useEffect(() => {
    inputValueRef.current = input;
    messagesRef.current = messages;
    conversationIdRef.current = conversationId;
    thinkingRef.current = thinking;
  }, [input, messages, conversationId, thinking]);

  useEffect(() => {
    if (view === "chat") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open, view]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      // Releases the mic if the widget unmounts mid-recording — otherwise the
      // browser's mic-in-use indicator stays lit.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorder.stop();
      }
    },
    [],
  );

  async function requestReply(text: string, previous: Message[]) {
    setThinking(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const body = saved
        ? { message: text, conversationId: conversationIdRef.current, pathname }
        : {
            pathname,
            messages: [...previous, { role: "user", text }]
              .filter((m) => m.role !== "error")
              .map((m) => ({ role: m.role, content: m.text })),
          };
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");

      const action = (data.action ?? null) as AssistantAction | null;
      if (data.conversationId) {
        if (data.conversationId !== conversationIdRef.current) setConversations(null);
        setConversationId(data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        { id: data.messageId ?? newId(), role: "assistant", text: data.reply as string, action },
      ]);

      if (action?.type === "navigate" && action.openNow) {
        setTimeout(() => router.push(action.path), 600);
      } else if (action?.type === "draft_job") {
        setTimeout(() => router.push(`/employer/jobs/postajob?title=${encodeURIComponent(action.title)}&autofill=1`), 900);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "error", text: err instanceof Error ? err.message : "Something went wrong. Try again." },
      ]);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setThinking(false);
    }
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinkingRef.current) return;
    const previous = messagesRef.current.filter((m) => m.role !== "error");
    setMessages([...previous, { id: newId(), role: "user", text: trimmed }]);
    setInput("");
    setOpen(true);
    setView("chat");
    requestReply(trimmed, previous);
  }

  // A failed message was never saved (the server only stores a question
  // once it has an answer), so retrying just re-asks the last question.
  function retry() {
    const withoutErrors = messagesRef.current.filter((m) => m.role !== "error");
    const last = withoutErrors[withoutErrors.length - 1];
    if (!last || last.role !== "user") return;
    setMessages(withoutErrors);
    requestReply(last.text, withoutErrors.slice(0, -1));
  }

  async function resolveClose(messageId: string, postingId: string, confirm: boolean) {
    const setResolution = (resolution: "closed" | "kept") => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.role === "assistant" && m.action?.type === "close_posting"
            ? { ...m, action: { ...m.action, resolution } }
            : m,
        ),
      );
      if (saved) {
        fetch(`/api/assistant/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolution }),
        }).catch(() => {});
      }
    };

    if (!confirm) {
      setResolution("kept");
      return;
    }
    setClosingId(messageId);
    try {
      const res = await fetch(`/api/employer/job-postings/${postingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't close that posting.");
      setResolution("closed");
      router.refresh();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "error", text: err instanceof Error ? err.message : "Couldn't close that posting." },
      ]);
    } finally {
      setClosingId(null);
    }
  }

  async function openHistory() {
    setView("history");
    setHistoryError(null);
    try {
      const res = await fetch("/api/assistant/conversations");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't load your chats.");
      setConversations(data.conversations);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Couldn't load your chats.");
    }
  }

  async function openConversation(id: string) {
    if (id === conversationId) {
      setView("chat");
      return;
    }
    requestRef.current?.abort();
    setThinking(false);
    setLoadingChat(true);
    setView("chat");
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't open that chat.");
      setConversationId(id);
      setMessages(data.messages);
    } catch (err) {
      setMessages([{ id: newId(), role: "error", text: err instanceof Error ? err.message : "Couldn't open that chat." }]);
      setConversationId(null);
    } finally {
      setLoadingChat(false);
    }
  }

  async function removeConversation(id: string) {
    setConversations((prev) => prev?.filter((c) => c.id !== id) ?? null);
    if (id === conversationId) {
      setConversationId(null);
      setMessages([]);
    }
    await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: await blobToDataUri(blob) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      const transcript = (data.transcript as string) ?? "";
      const combined = (inputValueRef.current ? `${inputValueRef.current} ${transcript}` : transcript).trim();
      if (combined) sendMessage(combined);
      else setVoiceError("Didn't catch anything — try again.");
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleMicClick() {
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (transcribing || thinking) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        stream.getTracks().forEach((track) => track.stop());
        throw err;
      }
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setTranscribing(true);
        toWavBlob(new Blob(audioChunksRef.current, { type: recorder.mimeType }))
          .then(transcribe)
          .catch(() => {
            setTranscribing(false);
            setVoiceError("Couldn't process that recording.");
          });
      };
      mediaRecorderRef.current = recorder;
      setVoiceError(null);
      setListening(true);
      recorder.start();
    } catch {
      setVoiceError("Couldn't access the microphone.");
    }
  }

  function handleNewChat() {
    requestRef.current?.abort();
    setThinking(false);
    setMessages([]);
    setConversationId(null);
    setView("chat");
    inputRef.current?.focus();
  }

  function handleCollapse() {
    setOpen(false);
    setFocused(false);
    setView("chat");
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setFocused(false);
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const showSuggestions = focused && messages.length === 0 && !thinking;
  const headerButton =
    "flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#9AA3B2] transition-colors hover:bg-black/[0.05] hover:text-[#141B2E] disabled:opacity-40 disabled:hover:bg-transparent";
  const chipButton =
    "w-fit rounded-full border border-brand-teal/40 bg-[#F0FCFD] px-[12px] py-[5px] text-[11px] text-[#008990] transition-colors hover:bg-[#E6F9FA]";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-30 flex flex-col items-center gap-[10px] px-4">
      <div
        ref={containerRef}
        onFocus={() => {
          setFocused(true);
          if (messages.length > 0) setOpen(true);
        }}
        onBlur={handleContainerBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleCollapse();
        }}
        className="pointer-events-auto relative w-full max-w-[480px] min-w-0"
      >
        <div className="absolute inset-0 overflow-hidden rounded-[26px]">
          <div
            aria-hidden
            className="gold-sweep absolute -inset-[75%]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 60deg, #FFE9A6 85deg, #ffffff 90deg, #FFE9A6 95deg, transparent 120deg, transparent 360deg)",
            }}
          />
        </div>

        <div className="relative m-px flex flex-col gap-[10px] overflow-hidden rounded-[25px] bg-white p-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.12)]">
          {open && (
            <div className="flex flex-col">
              <div className="flex h-[40px] shrink-0 items-center justify-between px-[4px]">
                <div className="flex min-w-0 items-center gap-[8px]">
                  <SiriOrb className="h-[20px] w-[20px] shrink-0" active={thinking} />
                  <div className="flex min-w-0 flex-col leading-none">
                    <span className="text-xs text-[#141B2E]">{view === "history" ? "Your chats" : "JobGiga Assistant"}</span>
                    <span className="mt-[3px] truncate text-[10px] text-[#9AA3B2]">
                      {view === "history"
                        ? "Saved to your account for 90 days"
                        : "AI can make mistakes — double-check key details"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-[2px]">
                  {saved && (
                    <button
                      type="button"
                      onClick={() => (view === "history" ? setView("chat") : openHistory())}
                      aria-label={view === "history" ? "Back to chat" : "Show past chats"}
                      aria-pressed={view === "history"}
                      title={view === "history" ? "Back to chat" : "Past chats"}
                      className={`${headerButton} ${view === "history" ? "bg-black/[0.05] text-[#141B2E]" : ""}`}
                    >
                      <ClockIcon className="h-[14px] w-[14px]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNewChat}
                    disabled={messages.length === 0 && view === "chat"}
                    aria-label="Start a new chat"
                    title="New chat"
                    className={headerButton}
                  >
                    <PlusIcon className="h-[13px] w-[13px]" />
                  </button>
                  <button type="button" onClick={handleCollapse} aria-label="Minimize chat" title="Minimize" className={headerButton}>
                    <XIcon className="h-[12px] w-[12px]" />
                  </button>
                </div>
              </div>

              {view === "history" ? (
                <div className="flex max-h-[min(420px,55vh)] min-h-[140px] flex-col gap-[2px] overflow-y-auto border-t border-black/[0.06] px-[2px] py-[8px]">
                  {historyError ? (
                    <p className="px-[8px] py-[10px] text-xs text-red-500">{historyError}</p>
                  ) : conversations === null ? (
                    <p className="px-[8px] py-[10px] text-xs text-[#9AA3B2]">Loading your chats…</p>
                  ) : conversations.length === 0 ? (
                    <p className="px-[8px] py-[10px] text-xs text-[#9AA3B2]">No saved chats yet — start one and it&rsquo;ll show up here.</p>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        className={`group flex items-center gap-[6px] rounded-[10px] pr-[4px] transition-colors hover:bg-[#F1F4F8] ${
                          c.id === conversationId ? "bg-[#F1F4F8]" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(c.id)}
                          className="flex min-w-0 flex-1 flex-col items-start gap-[2px] px-[10px] py-[8px] text-left"
                        >
                          <span className="w-full truncate text-xs text-[#141B2E]">{c.title}</span>
                          <span className="text-[10px] text-[#9AA3B2]">{relativeTime(c.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeConversation(c.id)}
                          aria-label={`Delete chat "${c.title}"`}
                          title="Delete chat"
                          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] opacity-0 transition hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                        >
                          <TrashIcon className="h-[12px] w-[12px]" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  aria-live="polite"
                  className="flex max-h-[min(420px,55vh)] min-h-[140px] flex-col gap-[10px] overflow-y-auto border-t border-black/[0.06] px-[4px] py-[14px]"
                >
                  {loadingChat && <p className="self-center text-xs text-[#9AA3B2]">Opening chat…</p>}

                  {!loadingChat && messages.length === 0 && !thinking && (
                    <div className="flex flex-col gap-[8px] self-start">
                      <p className="text-xs text-[#4B5468]">Hi! Ask me anything, or try one of these:</p>
                      <div className="flex flex-wrap gap-[6px]">
                        {SUGGESTIONS[audience].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => sendMessage(s)}
                            className="rounded-full border border-black/[0.08] px-[12px] py-[6px] text-xs text-[#141B2E] transition-colors hover:bg-black/[0.03]"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!loadingChat &&
                    messages.map((m) => {
                      if (m.role === "user") {
                        return (
                          <div
                            key={m.id}
                            className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-[14px] rounded-br-[4px] bg-brand-ink px-[12px] py-[8px] text-xs leading-[19px] text-white"
                          >
                            {m.text}
                          </div>
                        );
                      }
                      if (m.role === "error") {
                        return (
                          <div
                            key={m.id}
                            className="flex max-w-[85%] items-center gap-[10px] self-start rounded-[14px] rounded-bl-[4px] border border-red-100 bg-red-50 px-[12px] py-[8px] text-xs leading-[19px] text-red-600"
                          >
                            <span>{m.text}</span>
                            {messages[messages.length - 2]?.role === "user" && (
                              <button
                                type="button"
                                onClick={retry}
                                disabled={thinking}
                                className="shrink-0 rounded-full bg-white px-[10px] py-[3px] text-[11px] text-red-600 shadow-sm hover:bg-red-100 disabled:opacity-50"
                              >
                                Try again
                              </button>
                            )}
                          </div>
                        );
                      }

                      const action = m.action;
                      return (
                        <div key={m.id} className="flex max-w-[85%] flex-col gap-[6px] self-start">
                          <div className="break-words rounded-[14px] rounded-bl-[4px] bg-[#F1F4F8] px-[12px] py-[8px] text-xs leading-[19px] text-[#141B2E]">
                            <FormattedReply text={m.text} />
                          </div>

                          {action?.type === "navigate" && (
                            <button type="button" onClick={() => router.push(action.path)} className={chipButton}>
                              {action.label} →
                            </button>
                          )}

                          {action?.type === "draft_job" && (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/employer/jobs/postajob?title=${encodeURIComponent(action.title)}&autofill=1`)
                              }
                              className={chipButton}
                            >
                              Open the &ldquo;{action.title}&rdquo; draft →
                            </button>
                          )}

                          {action?.type === "close_posting" &&
                            (action.resolution ? (
                              <span className="text-[11px] text-[#9AA3B2]">
                                {action.resolution === "closed"
                                  ? `✓ Closed "${action.title}" — it won't accept new applications.`
                                  : `Kept "${action.title}" open.`}
                              </span>
                            ) : m.id === lastAssistantId ? (
                              <div className="flex items-center gap-[6px]">
                                <button
                                  type="button"
                                  disabled={closingId === m.id}
                                  onClick={() => resolveClose(m.id, action.postingId, true)}
                                  className="rounded-full bg-[#141B2E] px-[12px] py-[5px] text-[11px] text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                                >
                                  {closingId === m.id ? "Closing…" : "Yes, close it"}
                                </button>
                                <button
                                  type="button"
                                  disabled={closingId === m.id}
                                  onClick={() => resolveClose(m.id, action.postingId, false)}
                                  className="rounded-full border border-black/[0.1] px-[12px] py-[5px] text-[11px] text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                                >
                                  Keep it open
                                </button>
                              </div>
                            ) : null)}
                        </div>
                      );
                    })}

                  {thinking && (
                    <div
                      data-testid="thinking-indicator"
                      className="flex w-fit items-center gap-[4px] self-start rounded-[14px] rounded-bl-[4px] bg-[#F1F4F8] px-[14px] py-[10px]"
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-[6px] w-[6px] animate-bounce rounded-full bg-[#9AA3B2]"
                          style={{ animationDelay: `${i * 0.12}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showSuggestions && !open && (
            <div className="flex flex-wrap gap-[8px] px-[4px]">
              {SUGGESTIONS[audience].slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-black/[0.08] px-[14px] py-[8px] text-sm leading-[16px] text-[#141B2E] transition-colors hover:bg-black/[0.03]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className={`flex h-[38px] min-w-0 items-center gap-[10px] px-[4px] ${open ? "border-t border-black/[0.06] pt-[10px]" : ""}`}
          >
            <SiriOrb className="h-[30px] w-[30px]" active={input.trim().length > 0 || thinking} />
            {listening ? (
              <div className="flex min-w-0 flex-1 items-center gap-[3px]" role="status" aria-label="Listening">
                {[0.5, 0.85, 0.6, 1, 0.7, 0.4].map((delay, i) => (
                  <span
                    key={i}
                    className="voice-wave-bar h-[16px] w-[3px] rounded-full bg-red-500"
                    style={{ animationDelay: `${delay * 0.2}s` }}
                  />
                ))}
                <span className="ml-[8px] text-xs text-[#9AA3B2]">Listening… tap the mic to stop</span>
              </div>
            ) : transcribing ? (
              <div className="flex min-w-0 flex-1 items-center gap-[4px]" role="status" aria-label="Transcribing">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[6px] w-[6px] animate-bounce rounded-full bg-[#9AA3B2]"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
                <span className="ml-[4px] text-xs text-[#9AA3B2]">Transcribing…</span>
              </div>
            ) : (
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={messages.length > 0 ? "Reply…" : "Ask me anything..."}
                aria-label="Ask the AI assistant"
                maxLength={1500}
                className="min-w-0 flex-1 bg-transparent text-sm text-[#141B2E] placeholder:text-[#9AA3B2] outline-none"
              />
            )}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={transcribing || thinking}
              aria-label={listening ? "Stop voice input" : "Use voice input"}
              aria-pressed={listening}
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                listening ? "bg-red-500 text-white" : "bg-[#F1F4F8] text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
              }`}
            >
              <MicIcon className="h-[14px] w-[14px]" />
            </button>
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || thinking}
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-ink text-white hover:opacity-85 disabled:opacity-40"
            >
              <ArrowUp className="h-[13px] w-[13px]" />
            </button>
          </form>

          {voiceError && <p className="px-[8px] text-xs text-red-500">{voiceError}</p>}
        </div>
      </div>
    </div>
  );
}

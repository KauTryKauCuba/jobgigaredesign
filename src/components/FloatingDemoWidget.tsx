"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, MicIcon } from "./icons";
import SiriOrb from "./SiriOrb";

// Recognizes a handful of common "post a job for X" phrasings (typed or
// voice-transcribed) well enough to lift the job title out — this only
// needs to catch the common cases, not parse arbitrary language, since a
// miss just falls through to the normal demo reply instead of doing nothing.
const JOB_POSTING_INTENT_PATTERNS = [
  /\bpost(?:ing)? (?:a |an |)?job (?:for|as) (?:a |an |)(.+)/i,
  /\bcreate(?:ing)? (?:a |an |)job (?:posting |listing |)(?:for|as) (?:a |an |)(.+)/i,
  // Unlike the two patterns above (which already contain the explicit word
  // "job"), these generic verbs need the article required, not optional —
  // otherwise "I'm looking for the poster generator" (a navigation request)
  // also matches this pattern and gets misparsed into "create a job posting
  // titled 'The Poster Generator'".
  /\b(?:hire|hiring for|looking for) (?:a |an )(.+)/i,
];

function extractJobPostingIntent(text: string): string | null {
  const cleaned = text.trim().replace(/[.!?]+$/, "");
  for (const pattern of JOB_POSTING_INTENT_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1]
        .trim()
        .split(/\s+/)
        .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
    }
  }
  return null;
}

// "How many job postings do I have?" style questions — a status-count
// lookup against the employer's own postings, not content generation, so
// this is answered with a real fetch + count rather than an LLM call.
const JOB_STATS_TRIGGER = /\bhow many\b.*\b(?:job postings?|jobs|postings?)\b/i;
const JOB_STATUS_KEYWORDS: Record<string, string> = {
  active: "active",
  live: "active",
  open: "active",
  draft: "draft",
  drafts: "draft",
  pending: "pending",
  "in review": "pending",
  filled: "filled",
  closed: "closed",
  rejected: "rejected",
  flagged: "flagged",
};
const JOB_STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  pending: "pending review",
  active: "active",
  filled: "filled",
  closed: "closed",
  rejected: "rejected",
  flagged: "flagged",
};

function extractJobStatsIntent(text: string): { status: string | null } | null {
  const cleaned = text.trim().toLowerCase();
  if (!JOB_STATS_TRIGGER.test(cleaned)) return null;
  for (const [keyword, status] of Object.entries(JOB_STATUS_KEYWORDS)) {
    if (cleaned.includes(keyword)) return { status };
  }
  return { status: null };
}

// Applicant-side stat questions — "how many interviews do I have today",
// "how many applicants for this job posting", etc. Same philosophy as the
// job-stats intent above: keyword matching, not real NLU, so it only needs
// to catch the phrasing an employer would actually type/say for each of
// these, not arbitrary language. Checked in priority order (most specific
// first) since several share the word "applicant".
type ApplicantStatsIntent =
  | { type: "to_screen" }
  | { type: "to_shortlist" }
  | { type: "hired_count" }
  | { type: "offers_pending" }
  | { type: "top_applicant" }
  | { type: "new_since_checked" }
  | { type: "interviews_period"; period: "today" | "week" }
  | { type: "posting_performance" }
  | { type: "applicants_by_location"; location: string }
  | { type: "applicants_this_posting" }
  | { type: "applicants_today" }
  | { type: "applicants_total" }
  | { type: "rejected_count" }
  | { type: "busiest_posting" }
  | { type: "avg_time_to_hire" }
  | { type: "kiv_count" }
  | { type: "evaluation_pending_count" }
  | { type: "interview_no_show_count" }
  | { type: "interview_declined_count" };

function extractApplicantStatsIntent(text: string): ApplicantStatsIntent | null {
  const c = text.trim().toLowerCase();
  const mentionsThisPosting = c.includes("this job posting") || c.includes("this posting") || c.includes("this job");

  if (c.includes("applicant") && c.includes("screen")) return { type: "to_screen" };
  if (c.includes("applicant") && c.includes("shortlist")) return { type: "to_shortlist" };
  if (c.includes("hired") && (c.includes("how many") || c.includes("how much"))) return { type: "hired_count" };
  if (c.includes("offer") && (c.includes("pending") || c.includes("how many"))) return { type: "offers_pending" };
  // Requires "applicant"/"candidate" (unlike a bare "reject" check) so this
  // doesn't also swallow "how many rejected job postings do I have" — a
  // different, posting-status question answered by extractJobStatsIntent.
  if (
    c.includes("reject") &&
    (c.includes("applicant") || c.includes("candidate")) &&
    (c.includes("how many") || c.includes("how much"))
  ) {
    return { type: "rejected_count" };
  }
  if (
    (c.includes("most applicants") || c.includes("busiest") || c.includes("popular posting") || c.includes("popular job")) &&
    (c.includes("which") || c.includes("what"))
  ) {
    return { type: "busiest_posting" };
  }
  if (c.includes("time to hire") || (c.includes("how long") && c.includes("hire"))) {
    return { type: "avg_time_to_hire" };
  }
  if (c.includes("kiv") || (c.includes("keep in view") && (c.includes("how many") || c.includes("applicant")))) {
    return { type: "kiv_count" };
  }
  if (c.includes("evaluat") && (c.includes("pending") || c.includes("how many") || c.includes("waiting"))) {
    return { type: "evaluation_pending_count" };
  }
  if (c.includes("no-show") || c.includes("no show") || (c.includes("didn't show") && c.includes("interview"))) {
    return { type: "interview_no_show_count" };
  }
  if (c.includes("declined") && c.includes("interview")) {
    return { type: "interview_declined_count" };
  }
  if (
    c.includes("top applicant") ||
    c.includes("best applicant") ||
    c.includes("best match") ||
    c.includes("top candidate") ||
    c.includes("top match")
  ) {
    return { type: "top_applicant" };
  }
  if (c.includes("new applicant") || (c.includes("applicant") && c.includes("since") && c.includes("check"))) {
    return { type: "new_since_checked" };
  }
  if (c.includes("interview") && c.includes("today")) return { type: "interviews_period", period: "today" };
  if (c.includes("interview") && c.includes("week")) return { type: "interviews_period", period: "week" };
  if (
    mentionsThisPosting &&
    (c.includes("doing") || c.includes("performing") || c.includes("going")) &&
    (c.startsWith("how") || c.includes("how is") || c.includes("how does") || c.includes("how's"))
  ) {
    return { type: "posting_performance" };
  }
  const fromMatch = c.match(/\bapplicants?\b.*\bfrom\s+([a-z][a-z\s]*[a-z])\b/);
  if (fromMatch?.[1]) {
    return { type: "applicants_by_location", location: fromMatch[1].trim() };
  }
  if (c.includes("applicant") && mentionsThisPosting) return { type: "applicants_this_posting" };
  if (c.includes("applicant") && c.includes("today")) return { type: "applicants_today" };
  if (c.includes("applicant") && (c.includes("overall") || c.includes("total") || c.includes("how many"))) {
    return { type: "applicants_total" };
  }
  return null;
}

// Employer questions that aren't about a specific applicant/posting count —
// team management, AI usage, and posting housekeeping (expiring soon,
// openings remaining on the currently-open posting).
type EmployerMetaIntent =
  | { type: "team_count" }
  | { type: "team_pending_invites" }
  | { type: "ai_usage" }
  | { type: "expiring_soon" }
  | { type: "openings_remaining" };

function extractEmployerMetaIntent(text: string): EmployerMetaIntent | null {
  const c = text.trim().toLowerCase();
  const mentionsThisPosting = c.includes("this job posting") || c.includes("this posting") || c.includes("this job");

  if (c.includes("team") && (c.includes("pending") || c.includes("invite"))) return { type: "team_pending_invites" };
  if (c.includes("team") && (c.includes("how many") || c.includes("members"))) return { type: "team_count" };
  if (c.includes("ai") && (c.includes("usage") || c.includes("cost") || c.includes("spend") || c.includes("used"))) {
    return { type: "ai_usage" };
  }
  if (c.includes("expir") && (c.includes("posting") || c.includes("job") || c.includes("soon"))) {
    return { type: "expiring_soon" };
  }
  if (
    mentionsThisPosting &&
    (c.includes("opening") || c.includes("position") || c.includes("spot")) &&
    (c.includes("left") || c.includes("remaining") || c.includes("how many"))
  ) {
    return { type: "openings_remaining" };
  }
  if (mentionsThisPosting && c.includes("full") && (c.startsWith("is") || c.includes("is it"))) {
    return { type: "openings_remaining" };
  }
  return null;
}

// Broad enough to catch a question that's clearly about postings/applicants
// but didn't match a specific intent above — used only to pick an honest
// "didn't understand" fallback over the generic demo reply, not to answer
// anything itself.
const EMPLOYER_QUESTION_HINT =
  /\b(applicant|interview|job posting|hire|hiring|screen|shortlist|offer|team|expir|opening|kiv|evaluat|no-show|no show|declined|ai usage)\b/i;

// Same idea as the employer side, but for a jobseeker's own status
// questions ("how many jobs have I applied to", "do I have any interviews").
type JobseekerStatsIntent =
  | { type: "applications_total" }
  | { type: "interviews_upcoming" }
  | { type: "offers_count" }
  | { type: "hired_status" }
  | { type: "rejected_count" };

function extractJobseekerStatsIntent(text: string): JobseekerStatsIntent | null {
  const c = text.trim().toLowerCase();
  if (c.includes("interview") && (c.includes("how many") || c.includes("do i have") || c.includes("upcoming"))) {
    return { type: "interviews_upcoming" };
  }
  if (c.includes("offer") && (c.includes("how many") || c.includes("do i have"))) {
    return { type: "offers_count" };
  }
  // Qualified like every sibling check here — a bare "hired" would also
  // match unrelated phrasing like "tips to get hired faster".
  if (
    c.includes("got the job") ||
    (c.includes("hired") && (c.includes("am i") || c.includes("was i") || c.includes("have i") || c.includes("did i")))
  ) {
    return { type: "hired_status" };
  }
  if (c.includes("reject") && (c.includes("how many") || c.includes("do i have"))) {
    return { type: "rejected_count" };
  }
  if (
    (c.includes("application") || c.includes("applied")) &&
    (c.includes("how many") || c.includes("do i have") || c.includes("status"))
  ) {
    return { type: "applications_total" };
  }
  return null;
}

const JOBSEEKER_QUESTION_HINT = /\b(application|applied|interview|offer|hired|rejected|profile|cover letter)\b/i;

const SCREENABLE_STATUS = "applied"; // awaiting a screening decision
const SHORTLISTABLE_STATUS = "screened"; // screened, awaiting shortlist decision

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Whole calendar days between `date` and `today` (midnight to midnight),
// ignoring time-of-day — used to bucket "today" (0) vs "this week" (0-6).
function daysFromToday(date: Date, today: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

// Matches the route pattern for the single-job-posting page — used to tell
// whether the employer is currently looking at one specific posting (so
// "this job posting" has something to resolve to) versus anywhere else.
function currentJobPostingSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/employer\/jobs\/([^/]+)\/?$/);
  if (!match || match[1] === "postajob") return null;
  return match[1];
}

// "Take me to my applicants", "open the poster generator", etc. — checked
// against a per-context destination list (order matters: more specific
// phrases like "poster generator" must be checked before a generic "jobs"
// match would otherwise win). Deliberately excludes "show me" as a trigger
// verb since that phrasing is already used by existing stat questions
// ("show me applicants from Kuala Lumpur") and would collide with them.
// Anchored to the start of the message (allowing a short polite prefix) —
// unanchored, "open" alone would also match mid-sentence in an unrelated
// question like "how many open job postings do I have?", hijacking it into
// a navigation action instead of answering the count.
const NAVIGATION_TRIGGER = /^(?:please |can you |could you )?(?:take me to|go to|navigate to|open)\b/i;

type NavigationDestination = { keywords: string[]; path: string; label: string };

const EMPLOYER_NAV_DESTINATIONS: NavigationDestination[] = [
  { keywords: ["poster generator", "poster"], path: "/employer/jobs/poster-generator", label: "the poster generator" },
  { keywords: ["post a job", "post job"], path: "/employer/jobs/postajob", label: "post a job" },
  { keywords: ["job posting", "job postings", "manage job", "my jobs"], path: "/employer/jobs", label: "your job postings" },
  { keywords: ["applicant", "candidate"], path: "/employer/applicants", label: "your applicants" },
  { keywords: ["interview"], path: "/employer/interviews", label: "your interviews" },
  { keywords: ["team"], path: "/employer/team", label: "your team" },
  { keywords: ["company profile", "company page", "company"], path: "/employer/company", label: "your company profile" },
  { keywords: ["dashboard", "home", "overview"], path: "/employer/dashboard", label: "your dashboard" },
];

const JOBSEEKER_NAV_DESTINATIONS: NavigationDestination[] = [
  { keywords: ["cover letter"], path: "/jobseeker/cover-letters", label: "your cover letters" },
  { keywords: ["my application", "applications"], path: "/jobseeker/applications", label: "your applications" },
  { keywords: ["my profile", "profile"], path: "/jobseeker/profile", label: "your profile" },
  { keywords: ["browse jobs", "job postings", "search jobs", "jobs page", "jobs"], path: "/jobseeker/jobs", label: "job postings" },
  { keywords: ["dashboard", "home"], path: "/jobseeker/dashboard", label: "your dashboard" },
];

function extractNavigationIntent(text: string, destinations: NavigationDestination[]): NavigationDestination | null {
  const cleaned = text.trim().toLowerCase();
  if (!NAVIGATION_TRIGGER.test(cleaned)) return null;
  for (const destination of destinations) {
    if (destination.keywords.some((k) => cleaned.includes(k))) return destination;
  }
  return null;
}

// "Close the graphic designer posting", "pause applications for X" — an
// actual mutating action (unlike the read-only stats questions above), so
// the caller confirms which posting it resolved to in the reply rather than
// acting silently.
const CLOSE_POSTING_PATTERNS = [
  /\bclose (?:the |)(?:job |)(?:posting |listing |)(?:for |called |named |titled |)(.+)/i,
  /\bpause applications? for (?:the |)(.+)/i,
  /\bstop accepting applications? for (?:the |)(.+)/i,
];

function extractClosePostingIntent(text: string): string | null {
  const cleaned = text.trim().replace(/[.!?]+$/, "");
  for (const pattern of CLOSE_POSTING_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match?.[1]?.trim()) {
      // Strip a trailing "posting"/"job"/"listing" the user tacked onto the
      // title itself (e.g. "close the frontend engineer job posting").
      return match[1].trim().replace(/\s+(?:job posting|posting|job listing|listing|job)$/i, "");
    }
  }
  return null;
}

type Message = { id: number; role: "user" | "assistant"; text: string };

type TranscribeUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  audioTokens: number | null;
};

type VoiceResult = { durationSec: number; usage: TranscribeUsage };

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
 * WAV file sidesteps the codec mismatch entirely, regardless of what
 * container the browser recorded into.
 */
async function toWavBlob(blob: Blob): Promise<Blob> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    return encodeWav(audioBuffer);
  } finally {
    await audioCtx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const blockAlign = numChannels * 2;
  const dataSize = buffer.length * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

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

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Canned replies only — there is no backend wired up yet. Honest about that
 * in the copy itself ("demo reply") rather than pretending to be a working
 * assistant, since this widget can end up live on the real site before the
 * real AI integration exists.
 */
const DEMO_REPLIES = [
  "I can help you post a job or build your profile in a couple of minutes — just tell me what you're looking for. (Demo reply — the real assistant is coming soon.)",
  "Good question! Once the AI assistant is live, I'll structure this straight into a posting or profile for you. (Demo reply for now.)",
];

const SUGGESTIONS = ["What does JobGiga do?", "How long does JobGiga take to set up?"];

let nextId = 1;

export default function FloatingDemoWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    // Releases the mic if the widget unmounts (or navigates away) mid-recording
    // — otherwise the stream's tracks are only ever stopped in onstop, which
    // never fires, and the browser's mic-in-use indicator stays lit.
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorder.stop();
    }
  }, []);

  async function transcribe(blob: Blob, durationSec: number) {
    setTranscribing(true);
    setVoiceError(null);

    try {
      const audio = await blobToDataUri(blob);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");

      const transcript = (data.transcript as string) ?? "";
      const combined = (inputRef.current ? `${inputRef.current} ${transcript}` : transcript).trim();
      setVoiceResult({ durationSec, usage: data.usage as TranscribeUsage });
      if (combined) sendMessage(combined);
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
        const durationSec = (Date.now() - recordStartRef.current) / 1000;
        setListening(false);

        const recorded = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setTranscribing(true);
        toWavBlob(recorded)
          .then((wav) => transcribe(wav, durationSec))
          .catch(() => {
            setTranscribing(false);
            setVoiceError("Couldn't process that recording.");
          });
      };

      mediaRecorderRef.current = recorder;
      // handleMicClick only ever runs from the mic button's onClick (never
      // during render), so Date.now() here is safe despite the lint rule's
      // conservative render-purity check.
      // eslint-disable-next-line react-hooks/purity
      recordStartRef.current = Date.now();
      setVoiceResult(null);
      setVoiceError(null);
      setOpen(true);
      setListening(true);
      recorder.start();
    } catch {
      setVoiceError("Couldn't access the microphone.");
    }
  }

  function sendMessage(text: string) {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { id: nextId++, role: "user", text: text.trim() }]);
    setInput("");
    setOpen(true);
    setThinking(true);

    // Only act on employer/jobseeker-only intents from their own dashboard —
    // the same phrasing said from the other side has nothing to route to or
    // query, so it falls through to the normal demo reply below.
    // "/employer" and "/jobseeker" (exactly, no further path) are the public
    // marketing landing pages — this same widget renders there for a signed-
    // out visitor, who has no data for any of these intents to query. Every
    // real dashboard route is a sub-path (/employer/dashboard, /employer/
    // jobs, etc.), so excluding the bare root keeps those intents from
    // firing there and surfacing a raw "Not signed in" API error instead of
    // the normal marketing-page demo reply.
    const isEmployerContext = (pathname?.startsWith("/employer") ?? false) && pathname !== "/employer";
    const isJobseekerContext = (pathname?.startsWith("/jobseeker") ?? false) && pathname !== "/jobseeker";
    const navigationIntent = isEmployerContext
      ? extractNavigationIntent(text, EMPLOYER_NAV_DESTINATIONS)
      : isJobseekerContext
        ? extractNavigationIntent(text, JOBSEEKER_NAV_DESTINATIONS)
        : null;
    const jobTitle = isEmployerContext && !navigationIntent ? extractJobPostingIntent(text) : null;
    const closePostingTitle =
      isEmployerContext && !navigationIntent && !jobTitle ? extractClosePostingIntent(text) : null;
    const applicantIntent =
      isEmployerContext && !navigationIntent && !jobTitle && !closePostingTitle
        ? extractApplicantStatsIntent(text)
        : null;
    const statsIntent =
      isEmployerContext && !navigationIntent && !jobTitle && !closePostingTitle && !applicantIntent
        ? extractJobStatsIntent(text)
        : null;
    const metaIntent =
      isEmployerContext && !navigationIntent && !jobTitle && !closePostingTitle && !applicantIntent && !statsIntent
        ? extractEmployerMetaIntent(text)
        : null;
    const jobseekerStatsIntent =
      isJobseekerContext && !navigationIntent ? extractJobseekerStatsIntent(text) : null;
    const postingSlug = currentJobPostingSlug(pathname);

    replyTimer.current = setTimeout(async () => {
      if (navigationIntent) {
        setMessages((prev) => [
          ...prev,
          { id: nextId++, role: "assistant", text: `Taking you to ${navigationIntent.label}.` },
        ]);
        setThinking(false);
        router.push(navigationIntent.path);
        return;
      }

      if (jobTitle) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            text: `Opening a draft job posting for "${jobTitle}" — I've filled it in with AI, so please review it before publishing.`,
          },
        ]);
        setThinking(false);
        router.push(`/employer/jobs/postajob?title=${encodeURIComponent(jobTitle)}&autofill=1`);
        return;
      }

      if (closePostingTitle) {
        let replyText: string;
        try {
          const res = await fetch("/api/employer/job-postings");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your job postings.");
          const postings = (data.postings as { id: string; title: string; status: string }[]) ?? [];
          const needle = closePostingTitle.toLowerCase();
          const matches = postings.filter((p) => p.status !== "closed" && p.title.toLowerCase().includes(needle));
          if (matches.length === 0) {
            replyText = `I couldn't find an open posting matching "${closePostingTitle}".`;
          } else if (matches.length > 1) {
            // Silently closing whichever one array order finds first would
            // risk closing the wrong posting when the title is ambiguous
            // (e.g. "close the engineer posting" with both "Frontend
            // Engineer" and "Backend Engineer" open) — ask instead.
            replyText = `That matches more than one posting: ${matches.map((p) => `"${p.title}"`).join(", ")}. Which one did you mean? Try naming it more specifically.`;
          } else {
            const match = matches[0];
            const patchRes = await fetch(`/api/employer/job-postings/${match.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "closed" }),
            });
            const patchData = await patchRes.json();
            if (!patchRes.ok) throw new Error(patchData.error ?? "Couldn't close that posting.");
            replyText = `Closed "${match.title}" — it'll stop accepting new applications.`;
          }
        } catch (err) {
          replyText = err instanceof Error ? err.message : "Couldn't close that posting right now.";
        }
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: replyText }]);
        setThinking(false);
        return;
      }

      if (applicantIntent) {
        let replyText: string;
        try {
          const [postingsRes, applicationsRes] = await Promise.all([
            fetch("/api/employer/job-postings"),
            fetch("/api/employer/applications"),
          ]);
          const postingsData = await postingsRes.json();
          const applicationsData = await applicationsRes.json();
          if (!postingsRes.ok) throw new Error(postingsData.error ?? "Couldn't fetch your job postings.");
          if (!applicationsRes.ok) throw new Error(applicationsData.error ?? "Couldn't fetch your applicants.");

          const postings = (postingsData.postings as { id: string; slug: string; title: string }[]) ?? [];
          const applications =
            (applicationsData.applications as {
              jobPostingId: string;
              jobPostingTitle: string;
              applicantName: string;
              applicantLocation: string;
              status: string;
              appliedAt: string;
              hiredAt: string | null;
              interviewDetails: { scheduledAt: string } | null;
              interviewResponseStatus: string | null;
            }[]) ?? [];

          const currentPosting = postingSlug ? postings.find((p) => p.slug === postingSlug) : null;
          const scoped = currentPosting
            ? applications.filter((a) => a.jobPostingId === currentPosting.id)
            : applications;

          switch (applicantIntent.type) {
            case "to_screen": {
              const count = scoped.filter((a) => a.status === SCREENABLE_STATUS).length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No applicants waiting to be screened${scope} right now.`
                  : `You have ${count} applicant${count === 1 ? "" : "s"} waiting to be screened${scope}.`;
              break;
            }
            case "to_shortlist": {
              const count = scoped.filter((a) => a.status === SHORTLISTABLE_STATUS).length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No applicants waiting to be shortlisted${scope} right now.`
                  : `You have ${count} applicant${count === 1 ? "" : "s"} waiting to be shortlisted${scope}.`;
              break;
            }
            case "hired_count": {
              const count = scoped.filter((a) => a.status === "hired").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `You haven't hired anyone${scope} yet.`
                  : `You've hired ${count} applicant${count === 1 ? "" : "s"}${scope}.`;
              break;
            }
            case "offers_pending": {
              const count = scoped.filter((a) => a.status === "offer").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No pending offers${scope} right now.`
                  : `You have ${count} pending offer${count === 1 ? "" : "s"}${scope}.`;
              break;
            }
            case "top_applicant": {
              if (!currentPosting) {
                replyText = "Open a specific job posting first, then ask for its top applicant.";
                break;
              }
              const matchRes = await fetch("/api/employer/applicants/matches");
              const matchData = await matchRes.json();
              if (!matchRes.ok) throw new Error(matchData.error ?? "Couldn't fetch match scores.");
              const results = (matchData.results as { jobPostingId: string; applicantName: string; score: number; eligible: boolean }[]) ?? [];
              const top = results
                .filter((r) => r.jobPostingId === currentPosting.id && r.eligible)
                .sort((a, b) => b.score - a.score)[0];
              replyText = top
                ? `Your top applicant for "${currentPosting.title}" is ${top.applicantName} at ${top.score}% match.`
                : `No scored applicants for "${currentPosting.title}" yet.`;
              break;
            }
            case "new_since_checked": {
              const checkInRes = await fetch("/api/employer/applicants/check-in", { method: "POST" });
              const checkInData = await checkInRes.json();
              if (!checkInRes.ok) throw new Error(checkInData.error ?? "Couldn't check for new applicants.");
              const { newCount, previousCheckedAt } = checkInData as { newCount: number | null; previousCheckedAt: string | null };
              replyText =
                previousCheckedAt === null
                  ? "This is the first time you've asked — I'll count from now on, so ask again later and I'll tell you what's new since this moment."
                  : newCount === 0
                    ? "No new applicants since you last checked."
                    : `${newCount} new applicant${newCount === 1 ? "" : "s"} since you last checked.`;
              break;
            }
            case "interviews_period": {
              const today = new Date();
              const windowDays = applicantIntent.period === "today" ? 1 : 7;
              const count = applications.filter((a) => {
                if (!a.interviewDetails?.scheduledAt) return false;
                const offset = daysFromToday(new Date(a.interviewDetails.scheduledAt), today);
                return offset >= 0 && offset < windowDays;
              }).length;
              const periodLabel = applicantIntent.period === "today" ? "today" : "this week";
              replyText =
                count === 0
                  ? `You don't have any interviews scheduled ${periodLabel}.`
                  : `You have ${count} interview${count === 1 ? "" : "s"} scheduled ${periodLabel}.`;
              break;
            }
            case "applicants_this_posting": {
              if (!currentPosting) {
                replyText = "Open a specific job posting first, then ask about \"this job posting\".";
                break;
              }
              const count = scoped.length;
              replyText =
                count === 0
                  ? `No applicants yet for "${currentPosting.title}".`
                  : `"${currentPosting.title}" has ${count} applicant${count === 1 ? "" : "s"}.`;
              break;
            }
            case "applicants_today": {
              const today = new Date();
              const count = applications.filter((a) => isSameCalendarDay(new Date(a.appliedAt), today)).length;
              replyText =
                count === 0
                  ? "No applicants have applied today yet."
                  : `You've had ${count} applicant${count === 1 ? "" : "s"} apply today.`;
              break;
            }
            case "posting_performance": {
              if (!currentPosting) {
                replyText = "Open a specific job posting first, then ask how it's doing.";
                break;
              }
              const total = scoped.length;
              const interviewing = scoped.filter((a) => ["interview", "interviewed", "evaluation", "evaluated"].includes(a.status)).length;
              const hired = scoped.filter((a) => a.status === "hired").length;
              replyText =
                total === 0
                  ? `"${currentPosting.title}" hasn't had any applicants yet.`
                  : `"${currentPosting.title}" has ${total} applicant${total === 1 ? "" : "s"}, ${interviewing} at interview stage, and ${hired} hired so far.`;
              break;
            }
            case "applicants_by_location": {
              const matches = scoped.filter((a) => a.applicantLocation?.toLowerCase().includes(applicantIntent.location));
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                matches.length === 0
                  ? `No applicants from "${applicantIntent.location}"${scope}.`
                  : `${matches.length} applicant${matches.length === 1 ? "" : "s"} from "${applicantIntent.location}"${scope}.`;
              break;
            }
            case "applicants_total": {
              const count = scoped.length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No applicants yet${scope}.`
                  : `You have ${count} applicant${count === 1 ? "" : "s"}${scope} overall.`;
              break;
            }
            case "rejected_count": {
              const count = scoped.filter((a) => a.status === "rejected").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No rejected applicants${scope}.`
                  : `You've rejected ${count} applicant${count === 1 ? "" : "s"}${scope}.`;
              break;
            }
            case "busiest_posting": {
              // Always across every posting — "which posting" only makes
              // sense globally, so this ignores `scoped`/currentPosting even
              // when the employer is looking at one specific posting.
              const counts = new Map<string, number>();
              for (const a of applications) counts.set(a.jobPostingId, (counts.get(a.jobPostingId) ?? 0) + 1);
              const [topId, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
              const topPosting = postings.find((p) => p.id === topId);
              replyText = topPosting
                ? `"${topPosting.title}" has the most applicants, with ${topCount}.`
                : "You don't have any applicants yet.";
              break;
            }
            case "avg_time_to_hire": {
              const hires = scoped.filter((a) => a.status === "hired" && a.hiredAt);
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              if (hires.length === 0) {
                replyText = `No hires${scope} yet to calculate time-to-hire from.`;
                break;
              }
              const avgDays =
                hires.reduce((sum, a) => {
                  const days = (new Date(a.hiredAt!).getTime() - new Date(a.appliedAt).getTime()) / (1000 * 60 * 60 * 24);
                  return sum + days;
                }, 0) / hires.length;
              replyText = `Average time to hire${scope} is ${Math.round(avgDays)} day${Math.round(avgDays) === 1 ? "" : "s"}, based on ${hires.length} hire${hires.length === 1 ? "" : "s"}.`;
              break;
            }
            case "kiv_count": {
              const count = scoped.filter((a) => a.status === "kiv").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No applicants in KIV (keep-in-view)${scope} right now.`
                  : `You have ${count} applicant${count === 1 ? "" : "s"} in KIV${scope}.`;
              break;
            }
            case "evaluation_pending_count": {
              const count = scoped.filter((a) => a.status === "evaluation").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No applicants awaiting evaluation${scope}.`
                  : `You have ${count} applicant${count === 1 ? "" : "s"} awaiting evaluation${scope}.`;
              break;
            }
            case "interview_no_show_count": {
              const count = scoped.filter((a) => a.interviewResponseStatus === "no_show").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No interview no-shows${scope}.`
                  : `${count} applicant${count === 1 ? "" : "s"} didn't show up for their interview${scope}.`;
              break;
            }
            case "interview_declined_count": {
              const count = scoped.filter((a) => a.interviewResponseStatus === "declined").length;
              const scope = currentPosting ? ` for "${currentPosting.title}"` : "";
              replyText =
                count === 0
                  ? `No declined interviews${scope}.`
                  : `${count} applicant${count === 1 ? "" : "s"} declined an interview${scope}.`;
              break;
            }
          }
        } catch (err) {
          replyText = err instanceof Error ? err.message : "Couldn't fetch that right now.";
        }
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: replyText }]);
        setThinking(false);
        return;
      }

      if (statsIntent) {
        let replyText: string;
        try {
          const res = await fetch("/api/employer/job-postings");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your job postings.");
          const postings = (data.postings as { status: string }[]) ?? [];
          if (statsIntent.status) {
            const count = postings.filter((p) => p.status === statsIntent.status).length;
            const label = JOB_STATUS_LABEL[statsIntent.status] ?? statsIntent.status;
            replyText =
              count === 0
                ? `You don't have any ${label} job postings right now.`
                : `You have ${count} ${label} job posting${count === 1 ? "" : "s"}.`;
          } else {
            const counts = postings.reduce<Record<string, number>>((acc, p) => {
              acc[p.status] = (acc[p.status] ?? 0) + 1;
              return acc;
            }, {});
            const breakdown = Object.entries(counts)
              .map(([status, count]) => `${count} ${JOB_STATUS_LABEL[status] ?? status}`)
              .join(", ");
            replyText =
              postings.length === 0
                ? "You don't have any job postings yet."
                : `You have ${postings.length} job posting${postings.length === 1 ? "" : "s"} total${breakdown ? ` (${breakdown})` : ""}.`;
          }
        } catch (err) {
          replyText = err instanceof Error ? err.message : "Couldn't fetch your job postings right now.";
        }
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: replyText }]);
        setThinking(false);
        return;
      }

      if (metaIntent) {
        let replyText: string;
        try {
          if (metaIntent.type === "team_count" || metaIntent.type === "team_pending_invites") {
            const res = await fetch("/api/employer/team");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your team.");
            const members = (data.members as { status: string }[]) ?? [];
            if (metaIntent.type === "team_pending_invites") {
              const count = members.filter((m) => m.status === "pending").length;
              replyText =
                count === 0 ? "No pending team invites." : `You have ${count} pending team invite${count === 1 ? "" : "s"}.`;
            } else {
              const count = members.filter((m) => m.status === "active").length;
              replyText = `You have ${count} team member${count === 1 ? "" : "s"}.`;
            }
          } else if (metaIntent.type === "ai_usage") {
            const res = await fetch("/api/ai-usage");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your AI usage.");
            const { totalCalls, totalTokens } = data as { totalCalls: number; totalTokens: number };
            replyText =
              totalCalls === 0
                ? "You haven't used any AI features yet."
                : `You've made ${totalCalls} AI call${totalCalls === 1 ? "" : "s"}, using ${totalTokens.toLocaleString()} tokens total.`;
          } else if (metaIntent.type === "expiring_soon") {
            const res = await fetch("/api/employer/job-postings");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your job postings.");
            const postings = (data.postings as { title: string; status: string; expiryDate: string | null }[]) ?? [];
            const now = Date.now();
            const soon = postings.filter(
              (p) =>
                p.status === "active" &&
                p.expiryDate &&
                new Date(p.expiryDate).getTime() >= now &&
                new Date(p.expiryDate).getTime() - now <= 7 * 24 * 60 * 60 * 1000,
            );
            replyText =
              soon.length === 0
                ? "No postings are expiring in the next 7 days."
                : `${soon.length} posting${soon.length === 1 ? " is" : "s are"} expiring within 7 days: ${soon.map((p) => `"${p.title}"`).join(", ")}.`;
          } else {
            // openings_remaining — needs the posting currently open, which
            // only exists when the employer is on a specific posting's page.
            if (!postingSlug) {
              replyText = "Open a specific job posting first, then ask about its openings.";
            } else {
              const res = await fetch("/api/employer/job-postings");
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your job postings.");
              const postings =
                (data.postings as {
                  slug: string;
                  title: string;
                  openingsTotal: number;
                  hiresConfirmed: number;
                  offersOutstanding: number;
                }[]) ?? [];
              const posting = postings.find((p) => p.slug === postingSlug);
              if (!posting) {
                replyText = "Couldn't find that job posting.";
              } else {
                const remaining = posting.openingsTotal - posting.hiresConfirmed - posting.offersOutstanding;
                replyText =
                  remaining <= 0
                    ? `"${posting.title}" is full — all ${posting.openingsTotal} opening${posting.openingsTotal === 1 ? "" : "s"} are filled or have an offer out.`
                    : `"${posting.title}" has ${remaining} opening${remaining === 1 ? "" : "s"} left out of ${posting.openingsTotal}.`;
              }
            }
          }
        } catch (err) {
          replyText = err instanceof Error ? err.message : "Couldn't fetch that right now.";
        }
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: replyText }]);
        setThinking(false);
        return;
      }

      if (jobseekerStatsIntent) {
        let replyText: string;
        try {
          const res = await fetch("/api/jobseeker/applications");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't fetch your applications.");
          const applications =
            (data.applications as { status: string; interviewDetails: { scheduledAt: string } | null }[]) ?? [];

          switch (jobseekerStatsIntent.type) {
            case "applications_total": {
              const count = applications.length;
              replyText =
                count === 0
                  ? "You haven't applied to any jobs yet."
                  : `You've applied to ${count} job${count === 1 ? "" : "s"}.`;
              break;
            }
            case "interviews_upcoming": {
              const now = Date.now();
              const count = applications.filter(
                (a) => a.interviewDetails?.scheduledAt && new Date(a.interviewDetails.scheduledAt).getTime() >= now,
              ).length;
              replyText =
                count === 0
                  ? "You don't have any upcoming interviews."
                  : `You have ${count} upcoming interview${count === 1 ? "" : "s"}.`;
              break;
            }
            case "offers_count": {
              const count = applications.filter((a) => a.status === "offer").length;
              replyText =
                count === 0 ? "You don't have any pending offers." : `You have ${count} pending offer${count === 1 ? "" : "s"}.`;
              break;
            }
            case "hired_status": {
              const hired = applications.filter((a) => a.status === "hired");
              replyText =
                hired.length === 0
                  ? "You haven't been hired anywhere yet — keep going!"
                  : `Congrats — you've been hired! (${hired.length} offer${hired.length === 1 ? "" : "s"} accepted.)`;
              break;
            }
            case "rejected_count": {
              const count = applications.filter((a) => a.status === "rejected").length;
              replyText = count === 0 ? "None of your applications have been rejected." : `${count} of your applications ${count === 1 ? "was" : "were"} not successful this time.`;
              break;
            }
          }
        } catch (err) {
          replyText = err instanceof Error ? err.message : "Couldn't fetch your applications right now.";
        }
        setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: replyText }]);
        setThinking(false);
        return;
      }

      // A message that's clearly asking about postings/applicants but didn't
      // match a known intent — an honest "I couldn't quite parse that" beats
      // a generic canned demo reply that implies it understood.
      if (isEmployerContext && EMPLOYER_QUESTION_HINT.test(text)) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            text: "I couldn't quite understand that one. Try something like \"how many active job postings do I have?\", \"how many applicants do I have to screen?\", or \"how many interviews do I have today?\".",
          },
        ]);
        setThinking(false);
        return;
      }

      if (isJobseekerContext && JOBSEEKER_QUESTION_HINT.test(text)) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            text: "I couldn't quite understand that one. Try something like \"how many jobs have I applied to?\", \"do I have any interviews?\", or \"take me to my profile\".",
          },
        ]);
        setThinking(false);
        return;
      }

      const reply = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
      setMessages((prev) => [...prev, { id: nextId++, role: "assistant", text: reply }]);
      setThinking(false);
    }, 700);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleClose() {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setThinking(false);
    setOpen(false);
    setMessages([]);
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) return;
    setFocused(false);
  }

  const showSuggestions = focused && !open && messages.length === 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[24px] z-30 flex flex-col items-center gap-[10px] px-4">
      <div
        ref={containerRef}
        onFocus={() => setFocused(true)}
        onBlur={handleContainerBlur}
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
            <div className="flex h-[36px] shrink-0 items-center justify-between px-[4px]">
              <div className="flex items-center gap-[8px]">
                <SiriOrb className="h-[18px] w-[18px]" />
                <span className="text-xs text-[#141B2E]">JobGiga Assistant</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close chat"
                className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-[#9AA3B2] transition-colors hover:bg-black/[0.05] hover:text-[#141B2E]"
              >
                ×
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex max-h-[320px] min-h-[120px] flex-col gap-[10px] overflow-y-auto border-t border-black/[0.06] px-[4px] py-[14px]"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  data-msg-role={m.role}
                  className={`max-w-[85%] rounded-[14px] px-[12px] py-[8px] text-xs leading-[19px] ${
                    m.role === "user"
                      ? "self-end rounded-br-[4px] bg-brand-ink text-white"
                      : "self-start rounded-bl-[4px] bg-[#F1F4F8] text-[#141B2E]"
                  }`}
                >
                  {m.text}
                </div>
              ))}

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
          </div>
        )}

        {showSuggestions && (
          <div className="flex flex-wrap gap-[8px] px-[4px]">
            {SUGGESTIONS.map((s) => (
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
          onSubmit={handleSubmit}
          className={`flex h-[38px] min-w-0 items-center gap-[10px] px-[4px] ${open ? "border-t border-black/[0.06] pt-[10px]" : ""}`}
        >
          <SiriOrb className="h-[30px] w-[30px]" active={input.trim().length > 0} />
          {listening ? (
            <div
              className="flex min-w-0 flex-1 items-center gap-[3px]"
              role="status"
              aria-label="Listening"
            >
              {[0.5, 0.85, 0.6, 1, 0.7, 0.4].map((delay, i) => (
                <span
                  key={i}
                  className="voice-wave-bar h-[16px] w-[3px] rounded-full bg-red-500"
                  style={{ animationDelay: `${delay * 0.2}s` }}
                />
              ))}
              <span className="ml-[8px] text-xs text-[#9AA3B2]">Listening…</span>
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              aria-label="Ask the AI assistant"
              disabled={thinking}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#141B2E] placeholder:text-[#9AA3B2] outline-none disabled:opacity-40"
            />
          )}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={transcribing || thinking}
            aria-label={listening ? "Stop voice input" : "Use voice input"}
            aria-pressed={listening}
            className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              listening
                ? "bg-red-500 text-white"
                : "bg-[#F1F4F8] text-[#9AA3B2] hover:bg-black/[0.08] hover:text-[#141B2E]"
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

        {voiceError && (
          <p className="px-[8px] text-xs text-red-500">{voiceError}</p>
        )}
        {!voiceError && voiceResult && (
          <p className="px-[8px] text-xs text-[#9AA3B2]">
            Recorded {voiceResult.durationSec.toFixed(1)}s
            {voiceResult.usage.totalTokens != null &&
              ` · ${voiceResult.usage.totalTokens} tokens used`}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

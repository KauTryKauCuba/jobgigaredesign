"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicIcon } from "./icons";

type Phase = "idle" | "starting" | "recording" | "review";

function pickMimeType(video: boolean): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = video
    ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatSeconds(totalMs: number) {
  const s = Math.max(0, Math.ceil(totalMs / 1000));
  return `0:${String(s).padStart(2, "0")}`;
}

/**
 * One answer's recorder for the AI interview: video or audio only, a
 * countdown that stops the recording on its own, a preview, and a limited
 * number of saved answers. It only hands the recording back — saving is the
 * caller's job (so the practice question can use it without uploading).
 */
export default function AiAnswerRecorder({
  seconds,
  takesLeft,
  onUse,
  useLabel,
  busy,
  error,
}: {
  seconds: number;
  // How many more answers this question can save (0 = none). Recording and
  // listening back is free; a try is used when an answer is saved.
  takesLeft: number | "unlimited";
  onUse: (blob: Blob, isVideo: boolean) => void;
  useLabel: string;
  busy: boolean;
  error: string | null;
}) {
  const [wantsVideo, setWantsVideo] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; isVideo: boolean } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  // Whether the take in progress has a camera (can differ from the toggle
  // if the camera couldn't be used and we fell back to audio).
  const [recordingIsVideo, setRecordingIsVideo] = useState(true);

  const stopStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Leaving mid-recording (another question, Review, or a new page) ends it
  // quietly: the recorder is detached and stopped, the camera/mic released,
  // and a camera request still waiting is dropped when it comes back.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopStream();
    };
  }, [stopStream]);
  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);

  const finish = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  async function start() {
    setLocalError(null);
    setPhase("starting");
    let stream: MediaStream;
    let isVideo = wantsVideo;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo ? { facingMode: "user" } : false });
    } catch {
      if (wantsVideo) {
        // No camera (or camera blocked): offer audio instead of dead-ending.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          isVideo = false;
          setWantsVideo(false);
          setLocalError("We couldn't use your camera, so this answer is audio only.");
        } catch {
          setPhase("idle");
          setLocalError("We couldn't use your microphone. Allow microphone access in your browser, then try again.");
          return;
        }
      } else {
        setPhase("idle");
        setLocalError("We couldn't use your microphone. Allow microphone access in your browser, then try again.");
        return;
      }
    }
    if (unmountedRef.current) {
      // They left while the browser was still asking — don't start anything.
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    setRecordingIsVideo(isVideo);
    const mimeType = pickMimeType(isVideo);
    let recorder: MediaRecorder;
    try {
      // Capped bitrates keep a 60-second video to a few MB, so it uploads
      // quickly even on mobile data; it is re-encoded on the server anyway.
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_000_000,
        audioBitsPerSecond: 64_000,
      });
    } catch {
      stopStream();
      setPhase("idle");
      setLocalError("Your browser can't record here. Try Chrome, Edge, Firefox or Safari.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopStream();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (isVideo ? "video/webm" : "audio/webm") });
      if (blob.size === 0) {
        setPhase("idle");
        setLocalError("Nothing was recorded. Try again.");
        return;
      }
      setPreview({ url: URL.createObjectURL(blob), blob, isVideo });
      setPhase("review");
    };
    recorderRef.current = recorder;
    setRemainingMs(seconds * 1000);
    setPhase("recording");
    recorder.start();
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const left = seconds * 1000 - (Date.now() - startedAt);
      if (left <= 0) {
        setRemainingMs(0);
        finish();
      } else {
        setRemainingMs(left);
      }
    }, 100);
  }

  // Show the live camera while recording.
  useEffect(() => {
    if (phase === "recording" && liveVideoRef.current && streamRef.current && recordingIsVideo) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }, [phase, recordingIsVideo]);

  function recordAgain() {
    setPreview(null);
    setPhase("idle");
    setRemainingMs(seconds * 1000);
  }

  const noTakes = takesLeft !== "unlimited" && takesLeft <= 0;
  const shownError = localError ?? error;

  return (
    // Kept to a comfortable width on desktop; full width on phones.
    <div className="flex max-w-[520px] flex-col gap-[12px]">
      {phase === "idle" && (
        <>
          <div role="group" aria-label="How to answer" className="flex w-fit items-center rounded-full bg-[#F1F4F8] p-[3px] text-sm">
            {([true, false] as const).map((video) => (
              <button
                key={String(video)}
                type="button"
                aria-pressed={wantsVideo === video}
                onClick={() => setWantsVideo(video)}
                className={`rounded-full px-[16px] py-[6px] transition-colors ${
                  wantsVideo === video ? "bg-white text-brand-gold-dark shadow-sm" : "text-[#4B5468] hover:text-[#141B2E]"
                }`}
              >
                {video ? "Video" : "Audio only"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={start}
            disabled={noTakes || busy}
            className="flex h-[46px] items-center justify-center gap-[8px] rounded-full bg-brand-gold px-[22px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="h-[10px] w-[10px] rounded-full bg-red-500" />
            Start recording ({seconds}s)
          </button>
          {takesLeft !== "unlimited" && (
            <p className="text-xs text-[#9AA3B2]">
              {takesLeft > 0
                ? `${takesLeft} ${takesLeft === 1 ? "try" : "tries"} left for this question — record as often as you like, a try is used when you save.`
                : "You've used all your tries for this question."}
            </p>
          )}
        </>
      )}

      {phase === "starting" && <p className="text-sm text-[#4B5468]">Getting your camera and microphone ready…</p>}

      {phase === "recording" && (
        <div className="flex flex-col gap-[10px]">
          {recordingIsVideo ? (
            <video ref={liveVideoRef} muted playsInline autoPlay className="aspect-video w-full max-w-[520px] rounded-[14px] bg-black object-cover [transform:scaleX(-1)]" />
          ) : (
            <div className="flex h-[120px] items-center justify-center gap-[8px] rounded-[14px] bg-brand-gold-soft text-brand-gold-dark">
              <MicIcon className="h-[18px] w-[18px]" />
              <span className="text-sm">Listening…</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-[10px]">
            <span className="flex items-center gap-[8px] text-sm text-[#141B2E]">
              <span className="h-[10px] w-[10px] animate-pulse rounded-full bg-red-500" />
              Recording
            </span>
            <span className={`text-lg tabular-nums ${remainingMs <= 5000 ? "text-red-500" : "text-[#141B2E]"}`} aria-live="off">
              {formatSeconds(remainingMs)}
            </span>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-[#F1F4F8]">
            <div
              className="h-full rounded-full bg-brand-gold-dark transition-[width] duration-100"
              style={{ width: `${100 - (remainingMs / (seconds * 1000)) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={finish}
            className="flex h-[42px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
          >
            Stop
          </button>
        </div>
      )}

      {phase === "review" && preview && (
        <div className="flex flex-col gap-[10px]">
          {preview.isVideo ? (
            <video src={preview.url} controls playsInline className="aspect-video w-full max-w-[520px] rounded-[14px] bg-black" />
          ) : (
            <audio src={preview.url} controls className="w-full max-w-[520px]" />
          )}
          <p className="text-xs text-[#4B5468]">Listen back. Happy with it?</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onUse(preview.blob, preview.isVideo)}
            className="flex h-[42px] items-center justify-center rounded-full bg-brand-gold text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : useLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={recordAgain}
            className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Record again
          </button>
        </div>
      )}

      {shownError && <p className="text-xs text-red-500">{shownError}</p>}
    </div>
  );
}

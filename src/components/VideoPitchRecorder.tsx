"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "./icons";
import {
  PITCH_EXAMPLE,
  PITCH_QUESTIONS,
  PITCH_TIPS,
  questionIndexAt,
  type GuideLanguage,
} from "@/lib/video-pitch-guide";

const MAX_SECONDS = 60;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const SKIP_GUIDE_KEY = "jobgiga.videoPitch.skipGuide";

// Best format the browser can record, MP4 first (plays everywhere without
// conversion); the server converts whatever arrives to 480p MP4 anyway.
const MIME_PREFERENCE = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function readSkipGuide() {
  try {
    return window.localStorage.getItem(SKIP_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function formatSeconds(s: number) {
  const whole = Math.max(0, Math.round(s));
  return `0:${String(whole).padStart(2, "0")}`;
}

type Step = "guide" | "camera" | "recording" | "preview" | "uploading";

/**
 * Full-screen recorder for the 60-second video pitch: an intro guide (the
 * five questions, an example, filming tips — EN/BM), then the front camera
 * with the current question shown on screen and a countdown ring. Uploading
 * a clip from the gallery is always offered too — in-app browsers
 * (WhatsApp/Instagram/Facebook) often block the camera.
 */
export default function VideoPitchRecorder({
  onClose,
  onSaved,
  startWithGuide = true,
}: {
  onClose: () => void;
  onSaved: (pitch: unknown) => void;
  // "View guide" opens straight to the guide even for people who skipped it.
  startWithGuide?: boolean;
}) {
  const [step, setStep] = useState<Step>(() => (startWithGuide || !readSkipGuide() ? "guide" : "camera"));
  const [language, setLanguage] = useState<GuideLanguage>("en");
  const [skipGuideNextTime, setSkipGuideNextTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [manualQuestion, setManualQuestion] = useState(0);
  const [recorded, setRecorded] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Release the camera and timer if the recorder is closed mid-way.
  const closedRef = useRef(false);
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Attaches the live camera to whichever <video> preview is on screen.
  function attachLivePreview(el: HTMLVideoElement | null) {
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
    }
  }

  function rememberGuideChoice() {
    if (!skipGuideNextTime) return;
    try {
      window.localStorage.setItem(SKIP_GUIDE_KEY, "1");
    } catch {
      // Storage unavailable (private mode) — just show the guide next time.
    }
  }

  async function openCamera() {
    rememberGuideChoice();
    setError(null);
    setStep("camera");
    if (!navigator.mediaDevices?.getUserMedia || pickMimeType() === null) {
      setError(
        "This browser can't record video. If you opened JobGiga from WhatsApp, Instagram or Facebook, open it in Chrome or Safari instead — or upload a video from your gallery.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 854 }, height: { ideal: 480 } },
        audio: true,
      });
      // Closed while the permission prompt was up — don't leave the camera on.
      if (closedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCameraReady(true);
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(
        denied
          ? "Camera access was blocked. Allow camera and microphone for this site in your browser settings, or upload a video instead."
          : "We couldn't start your camera. Check no other app is using it, or upload a video instead.",
      );
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType() ?? "";
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_000_000,
        audioBitsPerSecond: 96_000,
      });
    } catch {
      setError("Recording isn't supported here — please upload a video instead.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      stopCamera();
      setRecorded({ blob, url: URL.createObjectURL(blob), name: `pitch.${ext}` });
      setStep("preview");
    };
    recorderRef.current = recorder;
    recorder.start(1000);

    const startedAt = Date.now();
    setElapsed(0);
    setManualQuestion(0);
    setStep("recording");
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_SECONDS) stopRecording();
    }, 200);
  }

  function stopRecording() {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function discardRecording() {
    if (recorded) URL.revokeObjectURL(recorded.url);
    setRecorded(null);
  }

  function reRecord() {
    discardRecording();
    openCamera();
  }

  function chooseUpload() {
    rememberGuideChoice();
    fileInputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That video is too large (max 100 MB). Try a shorter clip.");
      return;
    }
    const url = URL.createObjectURL(file);
    // Check the length up front so nobody waits for an upload that'll be rejected.
    const duration = await new Promise<number | null>((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : null);
      probe.onerror = () => resolve(null);
      probe.src = url;
    });
    if (duration !== null && duration > MAX_SECONDS + 2) {
      URL.revokeObjectURL(url);
      setError(`That video is ${Math.round(duration)} seconds — please keep it to one minute.`);
      return;
    }
    stopCamera();
    discardRecording();
    setRecorded({ blob: file, url, name: file.name || "pitch.mp4" });
    setStep("preview");
  }

  function submit() {
    if (!recorded) return;
    setStep("uploading");
    setUploadProgress(0);
    setError(null);
    const form = new FormData();
    form.append("video", recorded.blob, recorded.name);
    // XHR (not fetch) for upload progress on slower mobile connections.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobseeker/video-pitch");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { pitch?: unknown; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic error
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.pitch) {
        discardRecording();
        onSaved(data.pitch);
      } else {
        setError(data.error ?? "Upload failed — please try again.");
        setStep("preview");
      }
    };
    xhr.onerror = () => {
      setError("Upload failed — check your connection and try again.");
      setStep("preview");
    };
    xhr.send(form);
  }

  function close() {
    stopRecording();
    stopCamera();
    discardRecording();
    onClose();
  }

  const questionIndex = Math.max(questionIndexAt(elapsed), manualQuestion);
  const question = PITCH_QUESTIONS[questionIndex];
  const remaining = MAX_SECONDS - elapsed;
  const ringCircumference = 2 * Math.PI * 22;

  // Portaled to <body>: the card that opens this has a fade-in animation,
  // and an animated/transformed ancestor would otherwise trap this "fixed"
  // overlay inside the card instead of covering the whole screen.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-[16px]">
      <div className="relative flex w-full max-w-[560px] flex-col overflow-y-auto bg-white sm:max-h-[92svh] sm:rounded-[20px]">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-[16px] py-[12px]">
          <p className="text-sm text-[#141B2E]">Video pitch</p>
          <div className="flex items-center gap-[8px]">
            <div className="flex rounded-full border border-black/[0.1] p-[2px] text-xs">
              {(["en", "ms"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`rounded-full px-[10px] py-[3px] ${language === lang ? "bg-[#FFE9A6] text-[#141B2E]" : "text-[#4B5468]"}`}
                >
                  {lang === "en" ? "EN" : "BM"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-[#4B5468] hover:bg-black/[0.04]"
            >
              <XIcon className="h-[12px] w-[12px]" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="flex flex-1 flex-col gap-[14px] p-[16px]">
          {step === "guide" && (
            <>
              <div>
                <p className="text-lg font-semibold text-[#141B2E]">
                  {language === "en" ? "Introduce yourself in 60 seconds" : "Perkenalkan diri anda dalam 60 saat"}
                </p>
                <p className="mt-[4px] text-sm text-[#4B5468]">
                  {language === "en"
                    ? "Answer these questions — they'll appear on screen while you record."
                    : "Jawab soalan ini — ia akan dipaparkan di skrin semasa anda merakam."}
                </p>
              </div>
              <ol className="flex flex-col gap-[8px]">
                {PITCH_QUESTIONS.map((q, i) => (
                  <li key={i} className="flex gap-[10px] rounded-[12px] bg-[#F8FAFB] p-[10px]">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#FFE9A6] text-xs text-[#141B2E]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-[#141B2E]">{q[language]}</p>
                      <p className="text-xs text-[#9AA3B2]">
                        {formatSeconds(q.startsAt)} · {q.hint[language]}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rounded-[12px] border border-[#EAEDF2] p-[12px]">
                <p className="text-xs text-[#9AA3B2]">{language === "en" ? "Example" : "Contoh"}</p>
                <p className="mt-[4px] text-sm leading-[20px] text-[#4B5468]">{PITCH_EXAMPLE[language]}</p>
              </div>
              <ul className="flex flex-col gap-[4px]">
                {PITCH_TIPS[language].map((tip) => (
                  <li key={tip} className="text-xs text-[#4B5468]">
                    {tip}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-[8px] text-xs text-[#4B5468]">
                <input
                  type="checkbox"
                  checked={skipGuideNextTime}
                  onChange={(e) => setSkipGuideNextTime(e.target.checked)}
                  className="accent-[#A67C00]"
                />
                {language === "en" ? "Don't show this guide next time" : "Jangan tunjuk panduan ini lagi"}
              </label>
              <div className="mt-auto flex flex-col gap-[8px]">
                <button
                  type="button"
                  onClick={openCamera}
                  className="flex h-[42px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] hover:opacity-90"
                >
                  {language === "en" ? "Start recording" : "Mula merakam"}
                </button>
                <button
                  type="button"
                  onClick={chooseUpload}
                  className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                >
                  {language === "en" ? "Upload a video instead" : "Muat naik video"}
                </button>
              </div>
            </>
          )}

          {(step === "camera" || step === "recording") && (
            <>
              <div className="relative overflow-hidden rounded-[16px] bg-black">
                <video
                  ref={attachLivePreview}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-[3/4] w-full -scale-x-100 object-cover sm:aspect-video"
                />
                {step === "recording" && (
                  <>
                    <div className="absolute inset-x-[10px] top-[10px] rounded-[12px] bg-black/55 p-[10px] text-white">
                      <p className="text-xs opacity-75">
                        {questionIndex + 1}/{PITCH_QUESTIONS.length}
                      </p>
                      <p className="text-base">{question[language]}</p>
                      <p className="text-xs opacity-75">{question.hint[language]}</p>
                    </div>
                    <div className="absolute right-[12px] bottom-[12px] flex h-[52px] w-[52px] items-center justify-center">
                      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
                        <circle cx="26" cy="26" r="22" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
                        <circle
                          cx="26"
                          cy="26"
                          r="22"
                          fill="none"
                          stroke="#FFE9A6"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringCircumference * (1 - Math.min(1, elapsed / MAX_SECONDS))}
                        />
                      </svg>
                      <span className="relative text-xs text-white">{Math.ceil(Math.max(0, remaining))}</span>
                    </div>
                  </>
                )}
                {!cameraReady && !error && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera…</p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {step === "camera" ? (
                <div className="flex flex-col gap-[8px]">
                  <button
                    type="button"
                    disabled={!cameraReady}
                    onClick={startRecording}
                    className="flex h-[42px] items-center justify-center gap-[8px] rounded-full bg-red-500 text-sm text-white hover:opacity-90 disabled:opacity-40"
                  >
                    <span className="h-[10px] w-[10px] rounded-full bg-white" />
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={chooseUpload}
                    className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                  >
                    Upload a video instead
                  </button>
                </div>
              ) : (
                <div className="flex gap-[8px]">
                  <button
                    type="button"
                    disabled={questionIndex >= PITCH_QUESTIONS.length - 1}
                    onClick={() => setManualQuestion(questionIndex + 1)}
                    className="flex h-[42px] flex-1 items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:opacity-40"
                  >
                    Next question →
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex h-[42px] flex-1 items-center justify-center gap-[8px] rounded-full bg-[#141B2E] text-sm text-white hover:opacity-90"
                  >
                    <span className="h-[10px] w-[10px] rounded-[2px] bg-white" />
                    Stop · {formatSeconds(elapsed)}
                  </button>
                </div>
              )}
            </>
          )}

          {(step === "preview" || step === "uploading") && recorded && (
            <>
              <video src={recorded.url} controls playsInline className="aspect-[3/4] w-full rounded-[16px] bg-black object-contain sm:aspect-video" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              {step === "uploading" ? (
                <div className="flex flex-col gap-[6px]">
                  <div className="h-[6px] overflow-hidden rounded-full bg-[#F1F4F8]">
                    <div className="h-full bg-brand-gold-dark transition-[width]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-[#4B5468]">
                    {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : "Processing your video…"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  <button
                    type="button"
                    onClick={submit}
                    className="flex h-[42px] items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] hover:opacity-90"
                  >
                    Use this video
                  </button>
                  <button
                    type="button"
                    onClick={reRecord}
                    className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                  >
                    Record again
                  </button>
                  <button
                    type="button"
                    onClick={chooseUpload}
                    className="flex h-[34px] items-center justify-center text-sm text-[#4B5468] hover:text-[#141B2E]"
                  >
                    Upload a different video
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { gradientFrameClass } from "./formStyles";
import { FileIcon, UploadIcon, XIcon } from "./icons";
import SiriOrb from "./SiriOrb";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SidebarResumeCard({
  initialResume,
}: {
  initialResume: { fileName: string; fileSize: number | null } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState(initialResume);
  const [parsing, setParsing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!parsing) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(interval);
  }, [parsing]);

  async function uploadAndParse(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large — max 10 MB.");
      return;
    }
    setError(null);
    setStatus(null);
    setParsing(true);
    setElapsedMs(0);
    try {
      const body = new FormData();
      body.append("resume", file);
      const res = await fetch("/api/jobseeker/resume", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that resume.");
      setResume({ fileName: data.fileName, fileSize: data.fileSize });
      setStatus(
        data.filledCount > 0
          ? "Profile updated from your resume."
          : "Resume saved — didn't find new details to fill in.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that resume.");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    uploadAndParse(picked);
  }

  async function handleReset() {
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/jobseeker/resume", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove that resume.");
      setResume(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that resume.");
    }
  }

  return (
    <div className={`w-full ${gradientFrameClass("gold")}`}>
      <div className="rounded-[19px] bg-white p-[16px] text-left">
        <h2 className="text-xs font-semibold text-[#141B2E]">Upload your resume</h2>
        <p className="mt-[3px] text-xs leading-[16px] text-[#4B5468]">
          Optional — we&rsquo;ll autofill your profile from it.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {resume ? (
          <div className="mt-[12px] flex items-center gap-[8px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[8px]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <FileIcon className="h-[14px] w-[14px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[#141B2E]">{resume.fileName}</p>
              <p className="text-xs text-[#9AA3B2]">
                {parsing
                  ? `Reading your resume… ${(elapsedMs / 1000).toFixed(1)}s`
                  : resume.fileSize != null
                    ? formatSize(resume.fileSize)
                    : null}
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
            disabled={parsing}
            className={`mt-[12px] flex w-full flex-col items-center justify-center gap-[4px] rounded-[12px] border border-dashed px-[12px] py-[16px] text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              dragActive
                ? "border-brand-gold-dark bg-[#FFF3D6]"
                : "border-[#D7DCE4] hover:border-brand-gold-dark hover:bg-[#F8FAFB]"
            }`}
          >
            {parsing ? (
              <>
                <SiriOrb className="h-[16px] w-[16px]" active />
                <span className="text-xs text-[#141B2E]">
                  Reading your resume… {(elapsedMs / 1000).toFixed(1)}s
                </span>
              </>
            ) : (
              <>
                <UploadIcon className="h-[16px] w-[16px] text-brand-gold-dark" />
                <span className="text-xs text-[#141B2E]">Click to upload or drag and drop</span>
                <span className="text-xs text-[#9AA3B2]">PDF or DOCX · up to 10 MB</span>
              </>
            )}
          </button>
        )}

        {resume && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
            className={`mt-[8px] flex min-h-[34px] w-full items-center justify-center gap-[6px] rounded-[10px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[10px] py-[7px] text-center text-sm leading-[14px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              parsing ? "ai-fill-pulse" : ""
            }`}
          >
            <SiriOrb className="h-[12px] w-[12px] shrink-0" active={parsing} />
            Re-upload to parse this resume
          </button>
        )}

        {resume && (
          <button
            type="button"
            onClick={handleReset}
            disabled={parsing}
            aria-label="Remove resume"
            className="mt-[8px] flex h-[34px] w-full items-center justify-center gap-[4px] whitespace-nowrap rounded-[10px] bg-[#F1F4F8] px-[10px] text-sm text-[#4B5468] hover:bg-black/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <XIcon className="h-[10px] w-[10px]" />
            Reset
          </button>
        )}

        {error && <p className="mt-[8px] text-xs text-red-500">{error}</p>}
        {status && !error && <p className="mt-[8px] text-xs text-brand-gold-dark">{status}</p>}
      </div>
    </div>
  );
}

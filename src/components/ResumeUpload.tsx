"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "./AuthModal";
import { gradientFrameClass, inputClass, textareaClass } from "./formStyles";
import { FileIcon, PencilIcon, UploadIcon, XIcon } from "./icons";
import SiriOrb from "./SiriOrb";

const ACCEPT = ".pdf,.doc,.docx";
const MAX_BYTES = 10 * 1024 * 1024;

// sessionStorage stores the base64 data URL, which inflates size ~33% — cap
// well under typical browser storage quotas so the write doesn't throw.
const HANDOFF_MAX_BYTES = 4 * 1024 * 1024;
export const PENDING_RESUME_KEY = "jobgiga:pendingResume";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResumeUpload({
  existingResume = null,
}: {
  // Set for a signed-in jobseeker who already has one on file from
  // onboarding — shows the same "attached" chip instead of the upload
  // dropzone/Continue flow, which is for the pre-signup path only.
  existingResume?: { fileName: string; fileSize: number | null } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const [showCoverLetterForm, setShowCoverLetterForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobPostingText, setJobPostingText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!companyName.trim() || !jobTitle.trim() || !jobPostingText.trim()) {
      setGenerateError("Fill in the company name, job title, and job posting description.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/jobseeker/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, jobTitle, jobPostingText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "Couldn't generate a cover letter.");
        return;
      }
      router.push("/jobseeker/cover-letters");
    } catch {
      setGenerateError("Couldn't reach the generation service.");
    } finally {
      setGenerating(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    if (picked.size > MAX_BYTES) {
      setError("File is too large — max 10 MB.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(picked);
  }

  function clear() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (!file) return;
    if (file.size > HANDOFF_MAX_BYTES) {
      setShowSignup(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        sessionStorage.setItem(
          PENDING_RESUME_KEY,
          JSON.stringify({ name: file.name, type: file.type, dataUrl: reader.result }),
        );
      } catch {
        // Storage full/unavailable — the onboarding page just starts blank.
      }
      setShowSignup(true);
    };
    reader.onerror = () => setShowSignup(true);
    reader.readAsDataURL(file);
  }

  return (
    <div className={`mx-auto mt-[24px] w-full max-w-[440px] ${gradientFrameClass("gold")}`}>
      <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px] text-left">
        <div>
          <h2 className="text-sm text-[#141B2E]">
            Upload your resume, we&rsquo;ll build your profile
          </h2>
          <p className="mt-[3px] text-xs leading-[19px] text-[#4B5468]">
            Our AI reads it and builds your profile for you — no forms to fill in.
          </p>
        </div>

        {existingResume ? (
          <>
            <div className="mt-[16px] flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
              <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                <FileIcon className="h-[17px] w-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#141B2E]">
                  {existingResume.fileName}
                </p>
                {existingResume.fileSize != null && (
                  <p className="text-xs text-[#9AA3B2]">{formatSize(existingResume.fileSize)}</p>
                )}
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                showCoverLetterForm ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-[16px] flex flex-col gap-[12px] border-t border-[#EAEDF2] pt-[16px]">
                  <div>
                    <label className="mb-[6px] block text-xs text-[#4B5468]">Company name</label>
                    <input
                      className={inputClass("gold")}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Maju Jaya Sdn Bhd"
                    />
                  </div>
                  <div>
                    <label className="mb-[6px] block text-xs text-[#4B5468]">Job title</label>
                    <input
                      className={inputClass("gold")}
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Marketing Executive"
                    />
                  </div>
                  <div>
                    <label className="mb-[6px] block text-xs text-[#4B5468]">Job posting description</label>
                    <textarea
                      className={`${textareaClass("gold")} min-h-[120px]`}
                      value={jobPostingText}
                      onChange={(e) => setJobPostingText(e.target.value)}
                      placeholder="Paste the job description here"
                    />
                  </div>
                  {generateError && <p className="text-xs text-red-500">{generateError}</p>}
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex h-[38px] items-center justify-center rounded-full bg-brand-gold-dark text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {generating ? "Generating…" : "Generate cover letter"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-[10px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => setShowCoverLetterForm((v) => !v)}
                className="flex h-[42px] items-center justify-center gap-[7px] rounded-[12px] bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90"
              >
                <PencilIcon className="h-[14px] w-[14px]" />
                Write my cover letter
              </button>
              <button
                type="button"
                className="flex h-[42px] items-center justify-center gap-[7px] rounded-[12px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] text-sm text-white transition-opacity hover:opacity-90"
              >
                <SiriOrb className="h-[14px] w-[14px]" active />
                Give my resume a glow-up
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {file ? (
              <div className="mt-[16px] flex items-center gap-[10px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
                <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  <FileIcon className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#141B2E]">{file.name}</p>
                  <p className="text-xs text-[#9AA3B2]">{formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Remove resume"
                  className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[#9AA3B2] hover:bg-black/[0.05] hover:text-[#141B2E]"
                >
                  <XIcon className="h-[12px] w-[12px]" />
                </button>
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
                className={`mt-[16px] flex w-full flex-col items-center justify-center gap-[6px] rounded-[14px] border border-dashed px-[16px] py-[22px] text-center transition-colors ${
                  dragActive
                    ? "border-brand-gold-dark bg-[#FFF3D6]"
                    : "border-[#D7DCE4] hover:border-brand-gold-dark hover:bg-[#F8FAFB]"
                }`}
              >
                <UploadIcon className="h-[18px] w-[18px] text-brand-gold-dark" />
                <span className="text-xs text-[#141B2E]">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-[#9AA3B2]">PDF, DOC or DOCX · up to 10 MB</span>
              </button>
            )}

            {error && <p className="mt-[8px] text-xs text-red-500">{error}</p>}

            <button
              type="button"
              disabled={!file}
              onClick={handleContinue}
              className="mt-[16px] flex h-[38px] w-full items-center justify-center rounded-full bg-[#FFE9A6] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </>
        )}

        {showSignup && (
          <AuthModal
            mode="get-started"
            initialRole="jobseeker"
            lockRole
            onClose={() => setShowSignup(false)}
            onAuthenticated={() => setShowSignup(false)}
          />
        )}
      </div>
    </div>
  );
}

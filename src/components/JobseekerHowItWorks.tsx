import { CheckCircleIcon, UploadIcon } from "./icons";
import SiriOrb from "./SiriOrb";

const STEPS = [
  {
    id: "upload",
    title: "Upload your resume",
    detail: "Drop in the one you already have — PDF, DOC, or DOCX.",
  },
  {
    id: "fill",
    title: "AI fills your profile",
    detail: "Skills, experience, and education, pulled straight from it.",
  },
  {
    id: "apply",
    title: "Apply in one click",
    detail: "Your profile is the application — no repeat forms.",
  },
] as const;

function UploadVisual() {
  return (
    <div className="flex h-[96px] w-full flex-col items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-[#D7DCE4] bg-[#FFFDF5]">
      <span className="float-bob flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <UploadIcon className="h-[14px] w-[14px]" />
      </span>
      <span className="text-xs text-[#9AA3B2]">Resume.pdf</span>
    </div>
  );
}

function FillVisual() {
  return (
    <div className="flex h-[96px] w-full flex-col justify-center gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-white p-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-[6px]">
        <SiriOrb className="h-[14px] w-[14px]" active />
        <span className="text-xs text-[#4B5468]">Filling your profile…</span>
      </div>
      <div className="flex flex-col gap-[5px]">
        <div className="ai-fill-shimmer h-[8px] rounded-full" style={{ width: "90%" }} />
        <div className="ai-fill-shimmer h-[8px] rounded-full" style={{ width: "70%", animationDelay: "0.15s" }} />
        <div className="ai-fill-shimmer h-[8px] rounded-full" style={{ width: "50%", animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

function ApplyVisual() {
  return (
    <div className="flex h-[96px] w-full flex-col items-center justify-center gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="ai-fill-pulse flex h-[34px] items-center justify-center gap-[6px] rounded-full bg-[#FFE9A6] px-[16px] text-xs text-[#141B2E]">
        <CheckCircleIcon className="h-[13px] w-[13px]" />
        Applied
      </span>
      <span className="text-xs text-[#9AA3B2]">Sent in seconds</span>
    </div>
  );
}

const VISUALS = { upload: UploadVisual, fill: FillVisual, apply: ApplyVisual };

function ArrowConnector() {
  return (
    <span className="hidden shrink-0 items-center justify-center pt-[38px] text-[#D7DCE4] sm:flex" aria-hidden>
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
        <path d="M0 6h17M12 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function JobseekerHowItWorks() {
  return (
    <div className="shell relative z-[1] pt-[clamp(32px,5vh,56px)] pb-[64px]">
      <div className="mx-auto max-w-[560px] text-center">
        <span className="inline-flex items-center rounded-full bg-[#FFF3D6] px-[14px] py-[7px] text-xs text-brand-gold-dark">
          How it works
        </span>
        <h2
          className="mt-[16px] font-sans font-semibold text-[#141B2E]"
          style={{ fontSize: "clamp(24px,2.6vw,32px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
        >
          Applying is this easy
        </h2>
        <p className="mx-auto mt-[10px] max-w-[420px] text-sm leading-[22px] text-[#4B5468]">
          One upload, and you&rsquo;re ready to apply — no forms to fill in by hand.
        </p>
      </div>

      <div className="mx-auto mt-[40px] flex max-w-[1040px] flex-col items-stretch gap-[20px] sm:flex-row sm:items-start">
        {STEPS.map((step, i) => {
          const Visual = VISUALS[step.id];
          return (
            <div key={step.id} className="flex flex-1 items-start gap-[20px]">
              <div className="flex flex-1 flex-col items-center text-center">
                <Visual />
                <span className="mt-[16px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#FFE9A6] text-xs text-[#141B2E]">
                  {i + 1}
                </span>
                <h3 className="mt-[8px] text-sm font-semibold text-[#141B2E]">{step.title}</h3>
                <p className="mt-[4px] text-xs leading-[18px] text-[#4B5468]">{step.detail}</p>
              </div>
              {i < STEPS.length - 1 && <ArrowConnector />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

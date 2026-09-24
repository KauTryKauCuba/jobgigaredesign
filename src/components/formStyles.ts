export function inputClass(accent: "teal" | "gold" = "teal") {
  return `h-[38px] w-full rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-${accent === "gold" ? "gold-dark" : "teal-dark"}`;
}

export function textareaClass(accent: "teal" | "gold" = "teal", opts?: { autoResize?: boolean }) {
  return `w-full rounded-[12px] border border-black/[0.1] px-[14px] py-[10px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-${accent === "gold" ? "gold-dark" : "teal-dark"}${opts?.autoResize ? " resize-none overflow-hidden" : ""}`;
}

export const MOCKUP_CARD_CLASS =
  "rounded-[14px] border border-black/[0.06] bg-white p-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]";

const GRADIENT_FRAME_SHADOW =
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]";

export function gradientFrameClass(accent: "teal" | "gold" = "gold") {
  return accent === "gold"
    ? `rounded-[20px] bg-gradient-to-br from-[#FFE9A6] via-white to-[#FFE9A6] p-px ${GRADIENT_FRAME_SHADOW}`
    : `rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px ${GRADIENT_FRAME_SHADOW}`;
}

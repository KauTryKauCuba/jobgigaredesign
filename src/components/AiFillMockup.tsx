"use client";

import { useEffect, useRef, useState } from "react";
import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { BuildingIcon, CheckIcon, UserIcon } from "./icons";
import SiriOrb from "./SiriOrb";
import { Reveal } from "./mockupAnimation";

const COMPANY = "Maju Jaya Sdn Bhd";

const ABOUT_FIELDS = ["Nur Aisyah Rahman", "HR Manager", "012-345 6789", "aisyah@majujaya.my"];

const PROFILE_FIELDS: { label: string; value: string }[] = [
  { label: "Industry", value: "Retail & Consumer" },
  { label: "Company size", value: "51–200 employees" },
  { label: "Location", value: "Shah Alam, Selangor" },
  { label: "Website", value: "majujaya.com.my" },
];

const DESCRIPTION = "Family-run retailer with 12 outlets across Klang Valley, known for everyday essentials since 2009.";

// One loop of the demo, in ms.
const TYPE_MS = 70;
const LOOKUP_MS = 1500;
const REVEAL_MS = 380;
const HOLD_MS = 2600;
// Steps revealed one by one after the lookup: the header (logo + name),
// each profile field, the description, then each About-you field alongside.
const REVEAL_STEPS = 1 + PROFILE_FIELDS.length + 1;

type Phase = "typing" | "lookup" | "filling" | "done";

/**
 * A small animated recreation of employer onboarding — the company name
 * types itself in, "Looking up…" runs, then the About you and Company
 * profile cards fill in field by field the way the real AI lookup does,
 * ending on "Profile ready" before looping. Plays only while on screen, and
 * shows the finished state without motion for prefers-reduced-motion.
 */
export default function AiFillMockup() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const clear = () => timers.splice(0).forEach(clearTimeout);

    function showFinished() {
      setTyped(COMPANY.length);
      setRevealed(REVEAL_STEPS);
      setPhase("done");
    }

    function runLoop() {
      clear();
      setTyped(0);
      setRevealed(0);
      setPhase("typing");
      let t = 400;
      for (let i = 1; i <= COMPANY.length; i++) at((t += TYPE_MS), () => setTyped(i));
      at((t += 350), () => setPhase("lookup"));
      at((t += LOOKUP_MS), () => setPhase("filling"));
      for (let i = 1; i <= REVEAL_STEPS; i++) at((t += REVEAL_MS), () => setRevealed(i));
      at((t += 300), () => setPhase("done"));
      at((t += HOLD_MS), runLoop);
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Only animate while visible — no timers ticking for an offscreen card.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion) {
          at(0, showFinished);
        } else if (entry.isIntersecting) {
          runLoop();
        } else {
          clear();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      clear();
    };
  }, []);

  const filling = phase === "filling" || phase === "done";
  const shown = (step: number) => filling && revealed >= step;
  // About-you fields fill alongside the profile, one per profile step.
  const aboutShown = (i: number) => shown(i + 1);

  return (
    <div ref={rootRef} className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — three columns of dense text don't fit a phone-width
            card; the other two cards carry the idea on their own there. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">About you</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Who&rsquo;s registering this company.</p>
          </div>

          <div className="flex items-center gap-[8px]">
            <span className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F4F8]">
              <UserIcon className="h-[13px] w-[13px] text-[#9AA3B2]" />
              <span
                className={`absolute inset-0 flex items-center justify-center bg-[#FFE9A6] text-[10px] font-semibold text-[#8A6A1F] transition-opacity duration-500 ${
                  aboutShown(0) ? "opacity-100" : "opacity-0"
                }`}
              >
                NA
              </span>
            </span>
            <span className="rounded-full bg-[#F1F4F8] px-[8px] py-[3px] text-xs text-[#4B5468]">Upload photo</span>
          </div>

          <div className="flex flex-col gap-[6px]">
            {ABOUT_FIELDS.map((value, i) => (
              <div
                key={value}
                className={`flex h-[26px] items-center overflow-hidden rounded-[8px] border px-[8px] text-xs transition-colors duration-500 ${
                  aboutShown(i) ? "border-brand-teal-dark/30 bg-white" : "border-black/[0.08] bg-[#F8FAFB]"
                }`}
                style={{ width: i === ABOUT_FIELDS.length - 1 ? "85%" : "100%" }}
              >
                <span
                  className={`truncate text-[#141B2E] transition-all duration-500 ${
                    aboutShown(i) ? "translate-y-0 opacity-100" : "translate-y-[4px] opacity-0"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={cardClass}>
            <h3 className="text-xs font-semibold text-[#141B2E]">Company name</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">
              We&rsquo;ll search public sources to fill out the rest.
            </p>

            <div className="mt-[8px] flex gap-[6px]">
              <div
                className={`flex h-[26px] min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap rounded-[8px] border px-[8px] text-xs text-[#141B2E] transition-colors ${
                  phase === "typing" ? "border-brand-teal-dark" : "border-black/[0.1]"
                }`}
              >
                {COMPANY.slice(0, typed)}
                {phase === "typing" && <span className="ai-fill-caret ml-[1px] inline-block h-[12px] w-px bg-[#141B2E]" />}
              </div>
              <div
                className={`flex h-[26px] shrink-0 items-center gap-[4px] whitespace-nowrap rounded-[8px] px-[8px] text-xs text-white transition-all duration-500 ${
                  phase === "done"
                    ? "bg-[#2F9E56]"
                    : "bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)]"
                } ${phase === "lookup" || phase === "filling" ? "ai-fill-pulse" : ""} ${
                  phase === "typing" ? "opacity-70" : "opacity-100"
                }`}
              >
                {phase === "done" ? (
                  <>
                    <CheckIcon className="h-[9px] w-[9px]" />
                    Found
                  </>
                ) : (
                  <>
                    <SiriOrb className="h-[10px] w-[10px]" active={phase !== "typing"} />
                    {phase === "typing" ? "Look up" : "Looking up…"}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={`${cardClass} relative flex flex-col gap-[10px]`}>
            <div className="flex items-start justify-between gap-[8px]">
              <div>
                <h3 className="text-xs font-semibold text-[#141B2E]">Company profile</h3>
                <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Filled in as AI finds it.</p>
              </div>
              <span
                className={`flex items-center gap-[4px] rounded-full bg-[#E7F6EC] px-[8px] py-[2px] text-[11px] text-[#2F9E56] transition-all duration-500 ${
                  phase === "done" ? "scale-100 opacity-100" : "scale-90 opacity-0"
                }`}
              >
                <CheckIcon className="h-[8px] w-[8px]" />
                Profile ready
              </span>
            </div>

            {/* Header: logo + name. */}
            <Reveal shown={shown(1)} skeleton={<div className="ai-fill-shimmer h-[28px] w-[45%] rounded-[8px]" />}>
              <div className="flex items-center gap-[8px]">
                <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#0F5C63] text-white">
                  <BuildingIcon className="h-[13px] w-[13px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#141B2E]">{COMPANY}</p>
                  <p className="truncate text-[11px] text-[#9AA3B2]">SSM 201901012345 · Est. 2009</p>
                </div>
              </div>
            </Reveal>

            <div className="grid grid-cols-2 gap-x-[12px] gap-y-[8px]">
              {PROFILE_FIELDS.map((field, i) => (
                <Reveal
                  key={field.label}
                  shown={shown(i + 2)}
                  skeleton={<div className="ai-fill-shimmer h-[26px] rounded-[8px]" style={{ animationDelay: `${i * 0.12}s` }} />}
                >
                  <div className="min-w-0 rounded-[8px] bg-[#F8FAFB] px-[8px] py-[4px]">
                    <p className="text-[10px] text-[#9AA3B2]">{field.label}</p>
                    <p className="truncate text-xs text-[#141B2E]">{field.value}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal
              shown={shown(REVEAL_STEPS)}
              skeleton={
                <div className="flex flex-col gap-[6px]">
                  <div className="ai-fill-shimmer h-[9px] w-full rounded-full" />
                  <div className="ai-fill-shimmer h-[9px] w-[70%] rounded-full" style={{ animationDelay: "0.15s" }} />
                </div>
              }
            >
              <p className="text-xs leading-[16px] text-[#4B5468]">{DESCRIPTION}</p>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

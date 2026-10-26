"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";
import {
  drawAnnouncementLine,
  formatDay,
  REVIEW_PROMISE,
  USER_STATE_LABEL,
  type UserReward,
  type UserRewardState,
} from "@/lib/campaigns-shared";

const STATE_PILL: Record<UserRewardState, string> = {
  reviewing: "bg-[#FFF3D6] text-[#A67C00]",
  ready: "bg-[#E7F6EC] text-[#2F7D4F]",
  not_eligible: "bg-[#F1F4F8] text-[#4B5468]",
  in_draw: "bg-[#EEF2FF] text-[#4F46E5]",
  won: "bg-[#E7F6EC] text-[#2F7D4F]",
  not_won: "bg-[#F1F4F8] text-[#4B5468]",
};

export function rewardHeadline(reward: UserReward): string {
  switch (reward.state) {
    case "reviewing":
      return `You qualify for your ${reward.title}!`;
    case "ready":
      return `Here's your ${reward.title}`;
    case "in_draw":
      return "You're in the lucky draw!";
    case "won":
      return `You won the ${reward.title}!`;
    case "not_won":
      return "Lucky draw results";
    case "not_eligible":
      return reward.title;
  }
}

export function rewardMessage(reward: UserReward): string {
  switch (reward.state) {
    case "reviewing":
      return `Thanks for verifying your phone number. We're checking your claim — you'll hear from us ${REVIEW_PROMISE}, here and by email.`;
    case "ready":
      return "Thanks for verifying your phone number. Use the code below.";
    case "in_draw":
      return `Thanks for verifying your phone number. Prize: ${reward.title}. ${drawAnnouncementLine(reward.endsOn)} We'll tell you here and by email if you win.`;
    case "won":
      return "Congratulations! We'll be in touch about your prize.";
    case "not_won":
      return "You weren't picked this time — thanks for taking part!";
    case "not_eligible":
      return reward.type === "draw" ? "Your lucky draw entry wasn't eligible." : "Sorry — this reward wasn't approved.";
  }
}

function CopyCode({ code, gold }: { code: string; gold: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission: the code is still selectable on screen.
    }
  }
  return (
    <div className="flex items-center gap-[8px] rounded-[14px] border border-dashed border-black/[0.15] bg-[#F8FAFB] p-[8px] pl-[14px]">
      <span className="min-w-0 flex-1 select-all break-all font-mono text-base tracking-[0.06em] text-[#141B2E]">{code}</span>
      <button
        type="button"
        onClick={copy}
        className={`flex h-[34px] shrink-0 items-center gap-[6px] rounded-full px-[14px] text-sm hover:opacity-90 ${
          gold ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"
        }`}
      >
        {copied ? <CheckIcon className="h-[13px] w-[13px]" /> : <CopyIcon className="h-[13px] w-[13px]" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** One reward: what it is, where it stands and — once approved — the code. */
export default function RewardCard({ reward, showHeadline = true }: { reward: UserReward; showHeadline?: boolean }) {
  const [termsOpen, setTermsOpen] = useState(false);
  const gold = reward.audience === "jobseeker";
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className={`rounded-full px-[10px] py-[3px] text-xs ${STATE_PILL[reward.state]}`}>{USER_STATE_LABEL[reward.state]}</span>
        <span className="text-xs text-[#9AA3B2]">{reward.campaignName}</span>
      </div>
      {showHeadline && <h3 className="text-base font-semibold text-[#141B2E]">{rewardHeadline(reward)}</h3>}
      <p className="text-sm leading-[20px] text-[#4B5468]">{rewardMessage(reward)}</p>
      {reward.rejectReason && <p className="rounded-[12px] bg-[#F8FAFB] p-[10px] text-sm text-[#4B5468]">Reason: {reward.rejectReason}</p>}
      {reward.code && (
        <div className="flex flex-col gap-[6px]">
          <CopyCode code={reward.code} gold={gold} />
          {reward.codeExpiresOn && <p className="text-xs text-[#9AA3B2]">Use it by {formatDay(reward.codeExpiresOn)}.</p>}
        </div>
      )}
      {reward.details && (reward.state === "ready" || reward.state === "in_draw" || reward.state === "won" || reward.state === "reviewing") && (
        <p className="whitespace-pre-line rounded-[12px] bg-[#F8FAFB] p-[12px] text-xs leading-[18px] text-[#4B5468]">{reward.details}</p>
      )}
      {reward.terms && (
        <div>
          <button
            type="button"
            onClick={() => setTermsOpen((o) => !o)}
            aria-expanded={termsOpen}
            className={`text-xs hover:underline ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}
          >
            {termsOpen ? "Hide terms & conditions" : "Terms & conditions"}
          </button>
          {termsOpen && <p className="mt-[6px] whitespace-pre-line text-xs leading-[18px] text-[#9AA3B2]">{reward.terms}</p>}
        </div>
      )}
    </div>
  );
}

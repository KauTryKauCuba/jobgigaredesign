"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import RewardCard, { rewardHeadline } from "./RewardCard";
import type { UserReward } from "@/lib/campaigns-shared";

// Closed during this visit — every dashboard page renders its own shell, so
// this stops a page that still carries the earlier server answer reopening it.
const closedThisVisit = new Set<string>();

/**
 * "🎉 You've earned a reward" — shown once, on the dashboard, when someone
 * gets a campaign reward (just verified, or verified before the campaign
 * began). Waits until no other dialog is open, so it never lands on top of one.
 */
export default function RewardPopup({ reward }: { reward: UserReward | null | undefined }) {
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const id = reward?.id;

  useEffect(() => {
    if (!id || closedThisVisit.has(id)) return;
    // A short pause so it doesn't flash in with the page, then wait for any
    // other dialog (e.g. a form in a modal) to close first.
    let timer: ReturnType<typeof setTimeout>;
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"]')) timer = setTimeout(tryOpen, 1500);
      else setReady(true);
    };
    timer = setTimeout(tryOpen, 700);
    return () => clearTimeout(timer);
  }, [id]);

  if (!reward || !ready || closed || closedThisVisit.has(reward.id)) return null;
  const gold = reward.audience === "jobseeker";

  function close() {
    if (!reward) return;
    closedThisVisit.add(reward.id);
    setClosed(true);
    fetch("/api/rewards/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reward.id }),
    }).catch(() => {
      // Best-effort — worst case it shows once more on the next visit.
    });
  }

  return (
    <Modal ariaLabel={rewardHeadline(reward)} onClose={close}>
      <div className="text-center text-[44px] leading-none" aria-hidden>
        🎉
      </div>
      <h2 className="mt-[10px] text-center text-lg font-semibold text-[#141B2E]">{rewardHeadline(reward)}</h2>
      <div className="mt-[14px]">
        <RewardCard reward={reward} showHeadline={false} />
      </div>
      <div className="mt-[18px] flex flex-col gap-[8px]">
        <Link
          href={`/${reward.audience}/rewards`}
          onClick={close}
          className={`flex h-[38px] items-center justify-center rounded-full text-sm hover:opacity-90 ${
            gold ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"
          }`}
        >
          View My Rewards
        </Link>
        <button type="button" onClick={close} className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]">
          Close
        </button>
      </div>
    </Modal>
  );
}

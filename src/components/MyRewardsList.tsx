import { gradientFrameClass } from "./formStyles";
import RewardCard from "./RewardCard";
import { GiftIcon } from "./icons";
import { formatMytDateTime, type UserReward } from "@/lib/campaigns-shared";

/** The "My Rewards" page body — every campaign reward this person has, newest first. */
export default function MyRewardsList({ rewards, accent }: { rewards: UserReward[]; accent: "teal" | "gold" }) {
  if (rewards.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[20px] border border-dashed border-black/[0.12] bg-white px-[20px] py-[40px] text-center">
        <span
          className={`flex h-[44px] w-[44px] items-center justify-center rounded-full ${
            accent === "gold" ? "bg-brand-gold-soft text-brand-gold-dark" : "bg-brand-teal-soft text-brand-teal-dark"
          }`}
        >
          <GiftIcon className="h-[20px] w-[20px]" />
        </span>
        <p className="mt-[12px] text-sm text-[#141B2E]">No rewards yet</p>
        <p className="mt-[4px] max-w-[360px] text-xs leading-[18px] text-[#9AA3B2]">
          When JobGiga runs a reward campaign — for example, a voucher for verifying your phone number — what you earn shows up here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
      {rewards.map((reward) => (
        <div key={reward.id} className={gradientFrameClass(accent)}>
          <div className="flex h-full flex-col gap-[12px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <RewardCard reward={reward} />
            <p className="mt-auto text-xs text-[#9AA3B2]">Earned {formatMytDateTime(reward.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

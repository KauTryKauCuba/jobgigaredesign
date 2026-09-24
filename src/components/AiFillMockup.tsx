import { MOCKUP_CARD_CLASS as cardClass } from "./formStyles";
import { UserIcon } from "./icons";
import SiriOrb from "./SiriOrb";

function FieldBar({ w = "100%" }: { w?: string }) {
  return <div className="h-[26px] rounded-[8px] border border-black/[0.08] bg-[#F8FAFB]" style={{ width: w }} />;
}

/**
 * A small, animated recreation of the real onboarding layout — three cards
 * (About you / Company name / Company profile) side by side, same
 * composition as the actual form — not a screenshot, so it stays crisp at
 * any size and can actually move (the shimmer sweeping through the profile
 * fields, standing in for AI actively populating them; the pill's soft
 * pulse standing in for "Looking up…"). Pure CSS (see .ai-fill-* in
 * globals.css), same pattern as SiriOrb — no JS, respects
 * prefers-reduced-motion.
 */
export default function AiFillMockup() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F2FAF5] p-[20px]">
      <div className="grid w-full max-w-[840px] grid-cols-1 gap-[12px] md:grid-cols-[1fr_3fr]">
        {/* Hidden below md — three columns of dense text don't fit a phone-width
            card without overflowing; the other two cards carry the idea fine
            on their own at that size. */}
        <div className={`${cardClass} hidden flex-col gap-[10px] self-start md:flex`}>
          <div>
            <h3 className="text-xs font-semibold text-[#141B2E]">About you</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Who&rsquo;s registering this company.</p>
          </div>

          <div className="flex items-center gap-[8px]">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#F1F4F8]">
              <UserIcon className="h-[13px] w-[13px] text-[#9AA3B2]" />
            </span>
            <span className="rounded-full bg-[#F1F4F8] px-[8px] py-[3px] text-xs text-[#4B5468]">
              Upload photo
            </span>
          </div>

          <div className="flex flex-col gap-[6px]">
            <FieldBar />
            <FieldBar />
            <FieldBar />
            <FieldBar w="70%" />
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={cardClass}>
            <h3 className="text-xs font-semibold text-[#141B2E]">Company name</h3>
            <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">
              We&rsquo;ll search public sources to fill out the rest.
            </p>

            <div className="mt-[8px] flex gap-[6px]">
              <div className="flex h-[26px] min-w-0 flex-1 items-center overflow-hidden rounded-[8px] border border-black/[0.1] px-[8px] text-xs whitespace-nowrap text-ellipsis text-[#141B2E]">
                Maju Jaya Sdn Bhd
              </div>
              <div className="ai-fill-pulse flex h-[26px] shrink-0 items-center gap-[4px] whitespace-nowrap rounded-[8px] bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] px-[8px] text-xs text-white">
                <SiriOrb className="h-[10px] w-[10px]" active />
                Looking up…
              </div>
            </div>
          </div>

          <div className={`${cardClass} flex flex-col gap-[8px] pb-[63px]`}>
            <div>
              <h3 className="text-xs font-semibold text-[#141B2E]">Company profile</h3>
              <p className="mt-[2px] text-xs leading-[13px] text-[#4B5468]">Filled in as AI finds it.</p>
            </div>

            <div className="flex flex-col gap-[6px]">
              {[
                { w: "40%", h: 7 },
                { w: "88%", h: 10 },
                { w: "96%", h: 10 },
                { w: "62%", h: 10 },
                { w: "80%", h: 10 },
                { w: "48%", h: 10 },
                { w: "90%", h: 10 },
                { w: "58%", h: 10 },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="ai-fill-shimmer rounded-full"
                  style={{ width: bar.w, height: bar.h, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

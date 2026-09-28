import BadgeMedal from "./BadgeMedal";
import { gradientFrameClass } from "./formStyles";
import { BADGE_DEFINITIONS, type BadgeKey } from "@/lib/badge-definitions";

function formatEarnedDate(date: Date): string {
  return date.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function CompanyBadgesCard({ earnedBadges }: { earnedBadges: Record<BadgeKey, Date | undefined> }) {
  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
      <div className="rounded-[19px] bg-white p-[22px]">
        <p className="text-sm text-[#141B2E]">Badges</p>
        <p className="mt-[2px] text-xs text-[#9AA3B2]">Milestones your company has reached.</p>
        <div className="mt-[14px] grid grid-cols-2 gap-[14px] sm:grid-cols-4 lg:grid-cols-8">
          {BADGE_DEFINITIONS.map((badge) => {
            const earnedAt = earnedBadges[badge.key];
            const earned = !!earnedAt;

            return (
              <div
                key={badge.key}
                title={badge.description}
                className={`flex flex-col items-center gap-[6px] transition-opacity ${earned ? "" : "opacity-70"}`}
              >
                <BadgeMedal badge={badge} earned={earned} />
                <span className="text-center text-[11px] text-[#9AA3B2]">
                  {earned ? formatEarnedDate(earnedAt) : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

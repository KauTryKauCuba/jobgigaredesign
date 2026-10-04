import { gradientFrameClass } from "./formStyles";
import ResponsivenessBadge from "./ResponsivenessBadge";
import { formatWait, type EmployerResponsiveness } from "@/lib/responsiveness";

/**
 * The employer's own side of the anti-ghosting badge: what jobseekers see
 * on their postings, and how many applicants are waiting on a first reply —
 * the nudge that keeps the badge (and candidates) from going stale.
 */
export default function EmployerResponsivenessCard({
  responsiveness,
  waitingLong,
  onShowWaiting,
}: {
  responsiveness: EmployerResponsiveness | null;
  waitingLong: number;
  // Filters the list to untouched "Applied" candidates.
  onShowWaiting?: () => void;
}) {
  return (
    <div className={gradientFrameClass("teal")}>
      <div className="flex flex-col gap-[10px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <div>
          <p className="text-sm text-[#141B2E]">Your reply speed</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">Shown to jobseekers on every posting.</p>
        </div>

        {responsiveness ? (
          <>
            <ResponsivenessBadge responsiveness={responsiveness} />
            <p className="text-xs text-[#4B5468]">
              Typical first reply: {formatWait(responsiveness.medianHours)} · you responded to{" "}
              {Math.round(responsiveness.responseRate * 100)}% of {responsiveness.sampleSize} recent applicants.
            </p>
          </>
        ) : (
          <p className="text-xs text-[#4B5468]">
            Your badge appears once you&rsquo;ve responded to a few applicants — screen, shortlist or reject to get
            started.
          </p>
        )}

        {waitingLong > 0 && (
          <div className="rounded-[10px] bg-[#FFF3D6] p-[10px]">
            <p className="text-xs text-brand-gold-dark">
              {waitingLong} applicant{waitingLong === 1 ? " has" : "s have"} been waiting over 3 days for a first reply.
            </p>
            {onShowWaiting && (
              <button
                type="button"
                onClick={onShowWaiting}
                className="mt-[6px] text-xs text-brand-gold-dark underline hover:no-underline"
              >
                Show applicants awaiting a reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

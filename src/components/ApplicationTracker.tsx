import { APPLICATION_STATUS_LABEL, relativeTimeAgo } from "@/lib/applicationStatus";
import {
  TRACKER_STEPS,
  formatWait,
  responsivenessBadge,
  trackerStepDates,
  trackerStepIndex,
  type ApplicationEvent,
  type EmployerResponsiveness,
} from "@/lib/responsiveness";
import { CheckIcon } from "./icons";

const HOUR = 60 * 60 * 1000;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// What the last step reads as once a decision is in.
const DECISION_LABEL: Record<string, { label: string; tone: string }> = {
  offer: { label: "Offer", tone: "bg-[#C2600A]" },
  hired: { label: "Hired", tone: "bg-[#2F9E56]" },
  rejected: { label: "Not selected", tone: "bg-red-500" },
  withdrawn: { label: "Withdrawn", tone: "bg-[#9AA3B2]" },
};

/**
 * The jobseeker's "where does this stand" view of one application: four
 * plain-language milestones with the date each was reached, then a line
 * that answers the real anxiety — how long they've been waiting, and
 * whether that's normal for this employer.
 */
export default function ApplicationTracker({
  status,
  appliedAt,
  events,
  companyName,
  responsiveness,
  now,
}: {
  status: string;
  appliedAt: string;
  events: ApplicationEvent[];
  companyName: string;
  responsiveness: EmployerResponsiveness | null;
  // Passed in (captured once by the page) so render stays pure.
  now: number;
}) {
  const currentIndex = trackerStepIndex(status);
  const dates = trackerStepDates(events, appliedAt);
  const decision = DECISION_LABEL[status];
  const isClosed = status === "hired" || status === "rejected" || status === "withdrawn";
  const lastUpdate = events.length > 0 ? events[events.length - 1].createdAt : appliedAt;

  const badge = responsivenessBadge(responsiveness);
  const waitedHours = (now - new Date(appliedAt).getTime()) / HOUR;
  // "Longer than usual" = over twice their typical reply time, and never
  // before 3 days — a 1-hour median shouldn't flag a 3-hour wait.
  const overdue =
    status === "applied" && waitedHours > Math.max(72, (responsiveness?.medianHours ?? 72) * 2);

  return (
    <div className="flex flex-col gap-[10px]">
      <ol className="grid grid-cols-4 gap-[4px]">
        {TRACKER_STEPS.map((step, i) => {
          // Earlier steps count as done — except, once closed, ones that were
          // skipped entirely (e.g. rejected straight after screening never
          // reached "Interview").
          const done =
            i === currentIndex ? i === 0 || isClosed : i < currentIndex && (!isClosed || dates[i] !== null);
          const current = i === currentIndex && !done;
          const isDecisionStep = i === TRACKER_STEPS.length - 1;
          const dotTone =
            isDecisionStep && decision && i === currentIndex
              ? decision.tone
              : done
                ? "bg-brand-gold-dark"
                : current
                  ? "bg-white ring-2 ring-brand-gold-dark"
                  : "bg-[#E4E7EC]";
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              {/* Connector to the next step */}
              {i < TRACKER_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute top-[8px] left-1/2 h-[2px] w-full ${
                    i < currentIndex ? "bg-brand-gold-dark" : "bg-[#E4E7EC]"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full ${dotTone}`}
              >
                {done && <CheckIcon className="h-[9px] w-[9px] text-white" />}
              </span>
              <span
                className={`mt-[5px] text-xs ${i <= currentIndex ? "text-[#141B2E]" : "text-[#9AA3B2]"}`}
              >
                {isDecisionStep && decision && i === currentIndex ? decision.label : step.label}
              </span>
              <span className="text-xs text-[#9AA3B2]">{dates[i] ? shortDate(dates[i]!) : " "}</span>
            </li>
          );
        })}
      </ol>

      {!isClosed && (
        <p className={`rounded-[10px] px-[10px] py-[7px] text-xs ${overdue ? "bg-[#FFF3D6] text-brand-gold-dark" : "bg-white text-[#4B5468]"}`}>
          {status === "applied" ? (
            <>
              Waiting on {companyName} for {formatWait(waitedHours)}.
              {badge && ` ${badge.label.replace("Usually", "They usually")}.`}
              {overdue && " This is taking longer than usual — it may be worth applying elsewhere in the meantime."}
            </>
          ) : (
            <>Last update {relativeTimeAgo(lastUpdate)} — {APPLICATION_STATUS_LABEL[status] ?? status}.</>
          )}
        </p>
      )}

      {events.length > 1 && (
        <details className="group">
          <summary className="w-fit cursor-pointer list-none text-xs text-brand-gold-dark hover:underline">
            <span className="group-open:hidden">View full history</span>
            <span className="hidden group-open:inline">Hide history</span>
          </summary>
          <ol className="mt-[6px] flex flex-col gap-[4px] border-l-2 border-[#EAEDF2] pl-[10px]">
            {events.map((event, i) => (
              <li key={i} className="text-xs text-[#4B5468]">
                <span className="text-[#141B2E]">{APPLICATION_STATUS_LABEL[event.toStatus] ?? event.toStatus}</span>
                {" · "}
                {new Date(event.createdAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

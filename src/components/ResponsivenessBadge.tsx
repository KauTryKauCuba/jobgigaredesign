import { ClockIcon } from "./icons";
import {
  RESPONSIVENESS_TONE_CLASS,
  responsivenessBadge,
  type EmployerResponsiveness,
} from "@/lib/responsiveness";

/**
 * "Usually replies within 2 days" — an employer's typical time to first
 * respond to an application, measured from their own pipeline history.
 * Renders nothing until there's enough history to say anything honest.
 */
export default function ResponsivenessBadge({
  responsiveness,
  showRate = false,
  className = "",
}: {
  responsiveness: EmployerResponsiveness | null | undefined;
  // Also show "· responds to 85% of applicants" (detail views, not compact lists).
  showRate?: boolean;
  className?: string;
}) {
  const badge = responsivenessBadge(responsiveness);
  if (!badge || !responsiveness) return null;
  return (
    <span
      className={`inline-flex w-fit items-center gap-[5px] rounded-full px-[9px] py-[3px] text-xs ${RESPONSIVENESS_TONE_CLASS[badge.tone]} ${className}`}
      title={`Based on ${responsiveness.sampleSize} recent applications`}
    >
      <ClockIcon className="h-[11px] w-[11px] shrink-0" />
      {badge.label}
      {showRate && <span className="opacity-75">· responds to {Math.round(responsiveness.responseRate * 100)}% of applicants</span>}
    </span>
  );
}

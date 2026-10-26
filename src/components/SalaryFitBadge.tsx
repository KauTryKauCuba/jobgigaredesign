import { salaryFit } from "@/lib/job-posting-options";

/**
 * Small flag next to an applicant's expected salary: whether it fits the
 * posting's salary range. Renders nothing when the two can't be compared
 * (no range on the posting, or a non-monthly posting — expectations are
 * monthly).
 */
export default function SalaryFitBadge({
  expectedMin,
  expectedMax,
  postingMin,
  postingMax,
  postingPeriod,
}: {
  expectedMin: number;
  expectedMax: number;
  postingMin?: number | null;
  postingMax?: number | null;
  postingPeriod?: string;
}) {
  const fit = salaryFit(
    { min: expectedMin, max: expectedMax },
    { min: postingMin ?? null, max: postingMax ?? null, period: postingPeriod },
  );
  if (!fit) return null;
  return fit === "fits" ? (
    <span className="whitespace-nowrap rounded-full bg-[#E7F6EC] px-[8px] py-[1px] text-xs text-[#2F7D4F]">
      Fits your range
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-[#FFF1E6] px-[8px] py-[1px] text-xs text-[#B4561F]">
      Above your range
    </span>
  );
}

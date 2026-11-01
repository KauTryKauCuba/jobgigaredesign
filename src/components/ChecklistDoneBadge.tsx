import { CheckIcon } from "./icons";

/**
 * The tick beside a finished onboarding checklist's heading ("Required",
 * "Optional") — a larger version of the green done-circle on each checklist
 * row, instead of a typed "✓" glyph whose look depends on the font.
 */
export default function ChecklistDoneBadge() {
  return (
    <span
      role="img"
      aria-label="Complete"
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#1F7A3F]"
    >
      <CheckIcon className="h-[11px] w-[11px] text-white" />
    </span>
  );
}

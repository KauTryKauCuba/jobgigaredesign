"use client";

/** An on/off switch in the side's colour (superadmin pages: Themes, Campaigns). */
export default function Switch({
  on,
  label,
  disabled,
  accent,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  accent: "teal" | "gold";
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        on ? (accent === "gold" ? "bg-brand-gold-dark" : "bg-brand-teal-dark") : "bg-[#D7DCE4]"
      }`}
    >
      <span
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] ${
          on ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

import Field from "./Field";
import { inputClass as formInputClass } from "./formStyles";

export default function PhoneInput({
  id,
  label,
  value,
  onChange,
  accent = "teal",
  className = "",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent?: "teal" | "gold";
  className?: string;
  required?: boolean;
}) {
  // The static "+60" and the <input> share one bordered box, so the box
  // highlights on `focus-within` where a plain field would use `focus`.
  const wrapperClass = formInputClass(accent).replace("focus:border", "focus-within:border");

  return (
    <Field required={required} label={label} htmlFor={id} className={className}>
      <div className={`flex items-center gap-[8px] ${wrapperClass}`}>
        <span className="shrink-0 border-r border-black/[0.1] pr-[8px] text-sm text-[#4B5468]">+60</span>
        <input
          id={id}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="12-345 6789"
          className="w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
        />
      </div>
    </Field>
  );
}

"use client";

import { useEffect, useState } from "react";
import Field from "./Field";
import PhoneVerifyControl from "./PhoneVerifyControl";
import { toMalaysianMobileE164 } from "@/lib/phone";
import { inputClass as formInputClass } from "./formStyles";

/** Brings a phone field into the middle of the screen and puts the cursor in it. */
export function focusPhoneField(id: string) {
  const input = document.getElementById(id);
  if (!input) return;
  input.scrollIntoView({ block: "center", behavior: "smooth" });
  input.focus({ preventScroll: true });
}

export default function PhoneInput({
  id,
  label,
  value,
  onChange,
  accent = "teal",
  className = "",
  required = false,
  verifiable = false,
  onVerifiedChange,
  initialStatus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent?: "teal" | "gold";
  className?: string;
  required?: boolean;
  // Offers "Verify this number" (a text-message code) under the field.
  verifiable?: boolean;
  // Tells the form whether the number now in the field is verified (e.g. to badge the avatar).
  onVerifiedChange?: (verified: boolean) => void;
  // From the server, for the number the page loaded with — makes the first
  // frame correct (locked, "Phone verified") instead of loading in afterwards.
  initialStatus?: { canVerify: boolean; verified: boolean };
}) {
  // The number the page loaded with: the server's status applies to it only,
  // and only until the field first changes (after that it could be stale).
  const [initialValue] = useState(value);
  const [initialStillValid, setInitialStillValid] = useState(true);
  if (initialStillValid && value !== initialValue) setInitialStillValid(false);
  // The number the control last reported as verified. While the field still
  // shows exactly that number it is locked (greyed out) so it can't be
  // changed by accident — "Change number" unlocks it.
  const [verifiedValue, setVerifiedValue] = useState<string | null>(initialStatus?.verified ? value : null);
  const [unlocked, setUnlocked] = useState(false);
  const locked = verifiable && verifiedValue === value && !unlocked;

  // Arriving from the "Verify your phone number" bar (…/profile#phone): go
  // straight to this field, clear of the sticky navbar.
  useEffect(() => {
    if (!verifiable || window.location.hash !== `#${id}`) return;
    const timer = setTimeout(() => focusPhoneField(id), 150);
    return () => clearTimeout(timer);
  }, [verifiable, id]);

  // The static "+60" and the <input> share one bordered box, so the box
  // highlights on `focus-within` where a plain field would use `focus`.
  const wrapperClass = formInputClass(accent).replace("focus:border", "focus-within:border");

  return (
    <Field required={required} label={label} htmlFor={id} className={className}>
      <div className={`flex items-center gap-[8px] ${wrapperClass} ${locked ? "cursor-not-allowed bg-[#F8FAFB]" : "bg-white"}`}>
        <span className="shrink-0 border-r border-black/[0.1] pr-[8px] text-sm text-[#4B5468]">+60</span>
        <input
          id={id}
          type="tel"
          value={value}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          placeholder="12-345 6789"
          className={`w-full bg-transparent text-sm outline-none placeholder:text-[#9AA3B2] ${
            locked ? "cursor-not-allowed text-[#9AA3B2]" : "text-[#141B2E]"
          }`}
        />
      </div>
      {/* Keyed by the number, so changing it starts a fresh verification. */}
      {verifiable && (
        <PhoneVerifyControl
          key={toMalaysianMobileE164(value) ?? "none"}
          phone={value}
          accent={accent}
          locked={locked}
          initialStatus={
            initialStatus && initialStillValid
              ? {
                  canVerify: initialStatus.canVerify,
                  isMobile: toMalaysianMobileE164(value) !== null,
                  verified: initialStatus.verified,
                }
              : undefined
          }
          onUnlock={() => setUnlocked(true)}
          onVerified={(verified) => {
            setVerifiedValue(verified ? value : null);
            // A newly verified number locks again.
            if (verified) setUnlocked(false);
            onVerifiedChange?.(verified);
          }}
        />
      )}
    </Field>
  );
}

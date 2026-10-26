"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "./icons";

type Status = { canVerify: boolean; isMobile: boolean; verified: boolean };

const RESEND_SECONDS = 30;

/**
 * Under a phone field: "Verify this number" → we text a 6-digit code → type it
 * in → "Phone verified". Remounted (via `key`) whenever the number changes, so
 * a half-finished attempt never carries over to a different number.
 */
export default function PhoneVerifyControl({
  phone,
  accent,
  locked = false,
  onUnlock,
  onVerified,
  initialStatus,
}: {
  phone: string;
  accent: "teal" | "gold";
  // The field is greyed out while its number is verified; this offers to unlock it.
  locked?: boolean;
  onUnlock?: () => void;
  // Tells the field whether this exact number is verified.
  onVerified?: (verified: boolean) => void;
  // Worked out by the server for the number the page loaded with, so the
  // first frame is already right — no fetch, no flash.
  initialStatus?: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(initialStatus ?? null);
  // The number the server's answer was for — no need to ask again while it's unchanged.
  const serverCheckedPhone = useRef(initialStatus ? phone : null);
  const [step, setStep] = useState<"idle" | "sending" | "code" | "checking" | "calling">("idle");
  const [sentBy, setSentBy] = useState<"sms" | "call">("sms");
  // Which one the person just asked for, while that request is in flight.
  const [pending, setPending] = useState<"sms" | "call" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const text = accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark";
  const soft = accent === "gold" ? "bg-brand-gold-soft" : "bg-brand-teal-soft";
  const ring = accent === "gold" ? "focus:border-brand-gold-dark" : "focus:border-brand-teal-dark";

  // Can this number be verified, and is it already? (Not needed for the number
  // the page loaded with — the server already said.)
  useEffect(() => {
    if (serverCheckedPhone.current === phone) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/phone/status?phone=${encodeURIComponent(phone)}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data) setStatus(data);
      } catch {
        // No status, no control — the field still works without it.
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  // Tell the field when this number is verified (and when it isn't).
  const isVerified = !!status && status.canVerify && status.isMobile && status.verified;
  useEffect(() => {
    if (status) onVerified?.(isVerified);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // "sms" texts the code; "call" phones and reads it out (the fallback when
  // a text doesn't arrive — some networks filter texts from unknown senders).
  async function sendCode(channel: "sms" | "call" = "sms") {
    setError(null);
    setPending(channel);
    // From the code box, stay on it (busy) rather than flipping back to the choice.
    setStep(step === "code" ? "calling" : "sending");
    try {
      const res = await fetch("/api/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof data.retryAfterSeconds === "number") setCooldown(data.retryAfterSeconds);
        throw new Error(data.error ?? "We couldn't send the code. Try again.");
      }
      if (data.alreadyVerified) {
        setStatus((s) => (s ? { ...s, verified: true } : s));
        setStep("idle");
        return;
      }
      setCode("");
      setSentBy(channel);
      setCooldown(RESEND_SECONDS);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send the code. Try again.");
      setStep(step === "code" || step === "calling" ? "code" : "idle");
    }
  }

  async function confirm() {
    setError(null);
    setStep("checking");
    try {
      const res = await fetch("/api/phone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "We couldn't check the code. Try again.");
      setStatus((s) => (s ? { ...s, verified: true } : s));
      setStep("idle");
      // Re-reads the page's server data, so the navbar's avatar picks up its
      // seal straight away (for a number that's already saved on the profile).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't check the code. Try again.");
      setStep("code");
    }
  }

  if (!status || !status.canVerify) return null;

  if (!status.isMobile) {
    // A landline or other number: nothing to verify, but say why.
    return phone.trim() ? (
      <p className="mt-[6px] text-xs text-[#9AA3B2]">Only mobile numbers can be verified — we text the code.</p>
    ) : null;
  }

  if (status.verified) {
    return (
      <p className="mt-[6px] flex items-center gap-[6px] text-xs text-[#2F9E56]">
        <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#E8F7EE]">
          <CheckIcon className="h-[8px] w-[8px]" />
        </span>
        Phone verified
        {locked && onUnlock && (
          <button type="button" onClick={onUnlock} className="ml-[6px] text-[#4B5468] underline-offset-2 hover:text-[#141B2E] hover:underline">
            Change number
          </button>
        )}
      </p>
    );
  }

  if (step === "idle" || step === "sending") {
    // Two ways to get the code, so nobody has to spend a text on a number
    // that texts don't reach (some networks filter them) — a call works there.
    return (
      <div className="mt-[6px] flex flex-col gap-[6px]">
        <span className="text-xs text-[#4B5468]">Verify this number — get the 6-digit code by:</span>
        {/* Both choices on one row. */}
        <div className="flex gap-[8px]">
          {(["sms", "call"] as const).map((channel) => (
            <button
              key={channel}
              type="button"
              disabled={step === "sending"}
              onClick={() => sendCode(channel)}
              className={`h-[28px] whitespace-nowrap rounded-full ${soft} px-[12px] text-xs ${text} transition-opacity hover:opacity-80 disabled:opacity-60`}
            >
              {step === "sending" && pending === channel
                ? channel === "call"
                  ? "Calling…"
                  : "Sending…"
                : channel === "call"
                  ? "Call me"
                  : "Text me"}
            </button>
          ))}
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-[8px] flex flex-col gap-[6px]">
      <p className="text-xs text-[#4B5468]">
        {sentBy === "call"
          ? `We're calling +60 ${phone.replace(/^\+?60|^0/, "").trim()} — answer and listen for the 6-digit code, then enter it here.`
          : `Enter the 6-digit code we texted to +60 ${phone.replace(/^\+?60|^0/, "").trim()}.`}
      </p>
      <div className="flex flex-wrap items-center gap-[8px]">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="6-digit verification code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6 && step === "code") {
              e.preventDefault();
              void confirm();
            }
          }}
          placeholder="123456"
          className={`h-[34px] w-[130px] rounded-[10px] border border-black/[0.1] px-[12px] text-sm tracking-[3px] text-[#141B2E] outline-none placeholder:tracking-normal placeholder:text-[#9AA3B2] ${ring}`}
        />
        <button
          type="button"
          disabled={code.length !== 6 || step === "checking"}
          onClick={confirm}
          className={`h-[34px] rounded-full ${soft} px-[16px] text-xs ${text} transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {step === "checking" ? "Checking…" : "Confirm"}
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || step === "checking" || step === "calling"}
          onClick={() => sendCode(sentBy)}
          className="text-xs text-[#4B5468] hover:text-[#141B2E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : sentBy === "call" ? "Call again" : "Resend text"}
        </button>
      </div>
      {/* The other way to get the code. */}
      <button
        type="button"
        disabled={cooldown > 0 || step === "checking" || step === "calling"}
        onClick={() => sendCode(sentBy === "call" ? "sms" : "call")}
        className={`w-fit text-xs ${text} hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50`}
      >
        {step === "calling"
          ? pending === "call"
            ? "Calling…"
            : "Sending…"
          : sentBy === "call"
            ? "Text me the code instead"
            : "Didn’t get the text? Call me with the code"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

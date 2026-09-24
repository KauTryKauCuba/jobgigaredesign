"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/auth-messages";
import Field from "./Field";
import Modal from "./Modal";

export type AuthMode = "sign-in" | "get-started";
export type Role = "employer" | "jobseeker";
export type AuthUser = { email: string; name: string | null; avatarUrl?: string | null; role: Role };

const OTP_LENGTH = 6;

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M19.6 10.23c0-.68-.06-1.33-.17-1.96H10v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.27Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.08v2.59A10 10 0 0 0 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.41 11.9a6.02 6.02 0 0 1 0-3.8V5.51H1.08a10 10 0 0 0 0 8.98l3.33-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.6 9.6 0 0 0 10 0a10 10 0 0 0-8.92 5.51l3.33 2.59C5.2 5.74 7.4 3.98 10 3.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function AuthModal({
  mode,
  onClose,
  onAuthenticated,
  onSwitchToGetStarted,
  initialRole = "employer",
  lockRole = false,
  initialError = null,
}: {
  mode: AuthMode;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  // Sign-in's "no account found" error means the visitor is in the wrong
  // flow entirely, not that they mistyped something — offered as a direct
  // "Get started" button instead of making them close the modal and reopen
  // it from a different entry point. The parent owns `mode`, so switching it
  // is a callback rather than local state.
  onSwitchToGetStarted?: () => void;
  initialRole?: Role;
  // When the flow already knows which side the user is on (e.g. they
  // uploaded a resume, or clicked an employer-specific CTA), the
  // Employer/Jobseeker toggle is just a confusing, unnecessary extra choice
  // — this hides it and locks the modal to initialRole.
  lockRole?: boolean;
  // Surfaces a failure from an out-of-band flow that reopened this modal —
  // currently just the Google sign-in callback (e.g. "no account found"),
  // which can't show an error inline the way the email/OTP flow does since
  // it's a full-page redirect, not a fetch this component made itself.
  initialError?: string | null;
}) {
  const [role, setRole] = useState<Role>(initialRole);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  // Sign-in never shows the Employer/Jobseeker toggle up front — the
  // account itself determines the role. This only fills in for the rare
  // case where the same email genuinely has both, and the server can't
  // guess which one is wanted right now.
  const [roleChoicePending, setRoleChoicePending] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyRequestId = useRef(0);
  const router = useRouter();

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  // The parent switches `mode` in place (no remount) when the visitor clicks
  // "Get started" off the account-not-found error below — clear that error
  // once the mode actually changes, but not on first mount, where it's how
  // `initialError` (the Google-callback case) gets shown at all. Adjusted
  // during render (React's documented pattern for this exact case), not in
  // a useEffect: an effect would clear `error` only after the stale text had
  // already committed and painted with the new "Create your account" title
  // for one frame; this bails out and re-renders before anything paints.
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    setError(null);
  }

  const isSignIn = mode === "sign-in";
  const accountNotFound = isSignIn && error === ACCOUNT_NOT_FOUND_MESSAGE;

  // For sign-in, `role` is omitted on the first attempt so the server can
  // auto-detect it from the account; `roleOverride` is used once it's known
  // (after a role-choice pick, or on resend once `role` state is set).
  async function requestOtp(targetEmail: string, roleOverride?: Role) {
    const explicitRole = !isSignIn ? role : roleOverride;
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail, ...(explicitRole ? { role: explicitRole } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Couldn't send the code.");
    return data as { role?: Role; needsRoleChoice?: boolean };
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetEmail = email;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const data = await requestOtp(targetEmail);
      if (data.needsRoleChoice) {
        setRoleChoicePending(true);
        return;
      }
      if (data.role) setRole(data.role);
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpEmail(targetEmail);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setSending(false);
    }
  }

  async function handleChooseRole(chosenRole: Role) {
    setError(null);
    setSending(true);
    try {
      await requestOtp(email, chosenRole);
      setRole(chosenRole);
      setRoleChoicePending(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpEmail(email);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      await requestOtp(otpEmail, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code.");
    } finally {
      setResending(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    setOtp((prev) => {
      const next = [...prev];
      for (let i = 0; i < OTP_LENGTH; i++) next[i] = digits[i] ?? next[i];
      return next;
    });
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const requestId = ++verifyRequestId.current;
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otp.join(""), role }),
      });
      const data = await res.json();
      if (requestId !== verifyRequestId.current) return;
      if (!res.ok) throw new Error(data.error ?? "That code isn't right.");
      onAuthenticated(data.user as AuthUser);
      if (data.redirectTo) router.push(data.redirectTo as string);
    } catch (err) {
      if (requestId !== verifyRequestId.current) return;
      setError(err instanceof Error ? err.message : "That code isn't right.");
    } finally {
      if (requestId === verifyRequestId.current) setVerifying(false);
    }
  }

  const otpComplete = otp.every((d) => d !== "");

  return (
    <Modal onClose={onClose} ariaLabel={isSignIn ? "Sign in" : "Get started"}>
      <>
        <div className="flex items-start justify-between">
          <Image src="/jg-logo.svg" alt="JobGiga" width={111} height={28} priority />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[#9AA3B2] transition-colors hover:bg-black/[0.05] hover:text-[#141B2E]"
          >
            ×
          </button>
        </div>

        {step === "email" ? (
          <>
            <h2 className="mt-[16px] text-lg font-semibold text-[#141B2E]">
              {isSignIn ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
              {roleChoicePending
                ? "This email has both an employer and a jobseeker account — which one do you want to continue as?"
                : lockRole
                  ? `Create your ${role} account to continue.`
                  : isSignIn
                    ? "Enter your email to continue."
                    : "Get started as an employer or jobseeker."}
            </p>

            {roleChoicePending ? (
              <div className="mt-[24px] flex flex-col gap-[12px]">
                <button
                  type="button"
                  onClick={() => handleChooseRole("employer")}
                  disabled={sending}
                  className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Continue as Employer"}
                </button>
                <button
                  type="button"
                  onClick={() => handleChooseRole("jobseeker")}
                  disabled={sending}
                  className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Continue as Jobseeker"}
                </button>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRoleChoicePending(false);
                  }}
                  className="text-sm text-[#4B5468] hover:text-[#141B2E]"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} noValidate className="mt-[24px] flex flex-col gap-[12px]">
                {!lockRole && !isSignIn && (
                  <div
                    role="radiogroup"
                    aria-label="Account type"
                    className={`grid grid-cols-2 gap-[4px] rounded-full p-[4px] ${
                      role === "jobseeker" ? "bg-brand-teal-dark" : "bg-[#FFE9A6]"
                    }`}
                  >
                    <button
                      type="button"
                      role="radio"
                      onClick={() => setRole("employer")}
                      aria-checked={role === "employer"}
                      className={`h-[38px] rounded-full text-sm transition-colors aria-checked:bg-brand-teal-dark aria-checked:text-white aria-checked:shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                        role === "jobseeker" ? "text-white" : "text-[#4B5468]"
                      }`}
                    >
                      Employer
                    </button>
                    <button
                      type="button"
                      role="radio"
                      onClick={() => setRole("jobseeker")}
                      aria-checked={role === "jobseeker"}
                      className={`h-[38px] rounded-full text-sm transition-colors aria-checked:bg-[#FFE9A6] aria-checked:text-[#141B2E] aria-checked:shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                        role === "jobseeker" ? "" : "text-[#4B5468]"
                      }`}
                    >
                      Jobseeker
                    </button>
                  </div>
                )}

                <a
                  href={`/api/auth/google?role=${role}&intent=${isSignIn ? "sign-in" : "get-started"}`}
                  className="flex h-[38px] items-center justify-center gap-[10px] rounded-full border border-black/[0.1] text-sm text-[#141B2E] transition-colors hover:bg-black/[0.03]"
                >
                  <GoogleIcon className="h-[18px] w-[18px]" />
                  Continue with Google
                </a>

                <div className="flex items-center gap-[10px] text-xs text-[#9AA3B2]">
                  <div className="h-px flex-1 bg-black/[0.08]" />
                  or
                  <div className="h-px flex-1 bg-black/[0.08]" />
                </div>

                <Field label="Email address" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="h-[38px] rounded-[12px] border border-black/[0.1] px-[14px] text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2] focus:border-brand-teal-dark"
                  />
                </Field>

                {error && <p className="text-xs text-red-500">{error}</p>}

                {accountNotFound && onSwitchToGetStarted ? (
                  // Distinct `key` from the submit button below forces React
                  // to unmount/remount rather than reuse the same DOM node —
                  // without it, this button's type="button" mutates in place
                  // to the other branch's type="submit" as part of the same
                  // click's synchronous re-render, and the browser evaluates
                  // the click's default action (submitting the form) against
                  // that new type, silently firing a real OTP request.
                  <button
                    key="get-started-cta"
                    type="button"
                    onClick={onSwitchToGetStarted}
                    className={`mt-[4px] flex h-[38px] items-center justify-center rounded-full text-sm transition-opacity hover:opacity-90 ${
                      role === "jobseeker" ? "bg-[#FFE9A6] text-[#141B2E]" : "bg-brand-teal-dark text-white"
                    }`}
                  >
                    Get started
                  </button>
                ) : (
                  <button
                    key="send-code-cta"
                    type="submit"
                    disabled={sending}
                    className={`mt-[4px] flex h-[38px] items-center justify-center rounded-full text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSignIn && !lockRole
                        ? "bg-[linear-gradient(45deg,var(--color-brand-teal-dark),#FFE9A6)] text-white"
                        : role === "jobseeker"
                          ? "bg-[#FFE9A6] text-[#141B2E]"
                          : "bg-brand-teal-dark text-white"
                    }`}
                  >
                    {sending ? "Sending…" : "Send code"}
                  </button>
                )}
              </form>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-[16px] text-lg font-semibold text-[#141B2E]">
              Enter your code
            </h2>
            <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
              We sent a 6-digit code to <span className="text-[#141B2E]">{otpEmail}</span>.
            </p>

            <form onSubmit={handleOtpSubmit} className="mt-[24px] flex flex-col gap-[16px]">
              <div className="flex justify-between gap-[8px]">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    inputMode="numeric"
                    maxLength={1}
                    aria-label={`Digit ${i + 1} of 6`}
                    className="h-[52px] w-[44px] rounded-[12px] border border-black/[0.1] text-center text-lg text-[#141B2E] outline-none focus:border-brand-teal-dark"
                  />
                ))}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={!otpComplete || verifying}
                className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {verifying ? "Verifying…" : isSignIn ? "Sign in" : "Create account"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    verifyRequestId.current++;
                    setVerifying(false);
                    setError(null);
                    setStep("email");
                  }}
                  className="text-[#4B5468] hover:text-[#141B2E]"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-brand-teal-dark hover:opacity-80 disabled:opacity-60"
                >
                  {resending ? "Resending…" : "Resend code"}
                </button>
              </div>
            </form>
          </>
        )}
      </>
    </Modal>
  );
}

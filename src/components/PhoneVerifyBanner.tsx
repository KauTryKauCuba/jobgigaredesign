"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { focusPhoneField } from "./PhoneInput";
import { useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import VerifiedBadge from "./VerifiedBadge";
import { XIcon } from "./icons";

// Closed during this visit — every dashboard page renders its own shell, and
// a cached page could still carry the server's earlier "show it" answer.
let closedThisVisit = false;
export function phoneBannerClosedThisVisit() {
  return closedThisVisit;
}

const COPY = {
  jobseeker: {
    detail: "Confirm your number with a one-time code — employers see the green seal on your profile and know you're easy to reach.",
    profilePath: "/jobseeker/profile",
    fieldId: "phone",
  },
  employer: {
    detail: "Confirm your number with a one-time code — jobseekers see a verified contact on your company page and know you're real.",
    profilePath: "/employer/profile",
    fieldId: "contactPhone",
  },
} as const;

/**
 * Full-width bar under the dashboard navbar, like the "Get sample data" one:
 * asks jobseekers and employer owners to verify their phone and earn the
 * green "Phone verified" seal. Whether it shows (`show`) is worked out on the
 * server with the page (getAuthUser), so it never pops in late; it goes once
 * they verify (verifying refreshes the page's data) or close it (remembered
 * on their account, so on every device).
 */
export default function PhoneVerifyBanner({
  role,
  show,
  rewardText,
  onClose,
}: {
  role: "jobseeker" | "employer";
  show: boolean;
  // While a reward campaign runs: "Verify now to get your … 🎁" (see campaigns-shared.ts).
  rewardText?: string | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const guardNavigation = useUnsavedChangesGuard();
  const [closed, setClosed] = useState(closedThisVisit);
  if (!show || closed) return null;

  const copy = COPY[role];
  const gold = role === "jobseeker";

  function verify() {
    // Already on My Profile: just go to the field.
    if (pathname === copy.profilePath) {
      focusPhoneField(copy.fieldId);
      return;
    }
    guardNavigation(() => router.push(`${copy.profilePath}#${copy.fieldId}`));
  }

  function close() {
    closedThisVisit = true;
    setClosed(true);
    onClose?.();
    fetch("/api/phone/banner", { method: "POST" }).catch(() => {
      // Best-effort — worst case it shows again on the next page load.
    });
  }

  return (
    // Employer uses a lighter teal than the "Get sample data" bar right
    // above it (#009BA3 vs. brand-teal-dark #008990), so the two don't blend
    // together — still solid and dark enough to read white text clearly.
    <div className={`${gold ? "bg-brand-gold-dark" : "bg-brand-teal-bar"} text-white`}>
      <div className="app-shell flex items-center gap-[12px] py-[10px]">
        <VerifiedBadge variant="phone" placement="inline" size={20} tooltip={false} />
        <p className="min-w-0 flex-1 text-sm leading-[20px]">
          {rewardText ? (
            // A reward on offer is the bigger reason to verify, so it leads —
            // and stays on phones, where the detail line is dropped.
            <>
              <span className="font-semibold">{rewardText}</span>{" "}
              <span className="hidden text-white/85 sm:inline">You&rsquo;ll also get the Phone verified badge.</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Get the Phone verified badge.</span>{" "}
              {/* The detail line is dropped on phones so the button keeps its room. */}
              <span className="hidden text-white/85 sm:inline">{copy.detail}</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={verify}
          className={`flex h-[32px] shrink-0 items-center rounded-full bg-white px-[14px] text-sm transition-opacity hover:opacity-90 ${
            gold ? "text-brand-gold-dark" : "text-brand-teal-dark"
          }`}
        >
          Verify my phone
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close this notice"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <XIcon className="h-[12px] w-[12px]" />
        </button>
      </div>
    </div>
  );
}

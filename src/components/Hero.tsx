"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Hero({
  overlay,
  belowNav,
  showRoleToggle = true,
  heading = (
    <>
      Hiring in Malaysia,
      <br />
      without the forms.
    </>
  ),
  subheading = (
    <>
      Talk to an AI assistant that builds your job post or profile, finds the
      right matches, and keeps everyone in the loop.
    </>
  ),
  subheadingClassName = "mb-[18px]",
}: {
  overlay?: React.ReactNode;
  belowNav?: React.ReactNode;
  showRoleToggle?: boolean;
  heading?: React.ReactNode;
  subheading?: React.ReactNode;
  subheadingClassName?: string;
}) {
  const pathname = usePathname();
  const isJobseeker = pathname === "/jobseeker";

  return (
    <div className="shell relative pt-[clamp(48px,9vh,96px)] pb-[64px] text-center">
      {overlay}

      {/*
        Text content sits in its own elevated stacking context, separate
        from `overlay` (the floating badges) — that's what lets the ribbon,
        further down the page, paint over the badges once they've scrolled
        into its territory, while the headline/nav always stay on top.
      */}
      <div className="relative z-10">
        <h1
          className="font-sans font-semibold text-[#141B2E]"
          style={{
            fontSize: "clamp(34px, 4vw, 56px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
          }}
        >
          {heading}
        </h1>

        <p className={`mx-auto mt-[18px] max-w-[560px] text-sm leading-[24px] text-[#4B5468] ${subheadingClassName}`}>
          {subheading}
        </p>

        {showRoleToggle && (
          <nav
            aria-label="View as"
            className={`mx-auto mt-[28px] grid w-fit grid-cols-2 gap-[4px] rounded-full p-[4px] ${
              isJobseeker ? "bg-brand-teal-dark" : "bg-[#FFE9A6]"
            }`}
          >
            <Link
              href="/employer"
              aria-current={!isJobseeker ? "page" : undefined}
              className={`flex h-[38px] items-center justify-center rounded-full px-[22px] text-sm transition-colors aria-[current=page]:bg-brand-teal-dark aria-[current=page]:text-white aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                isJobseeker ? "text-white" : "text-[#4B5468]"
              }`}
            >
              Employer
            </Link>

            <Link
              href="/jobseeker"
              aria-current={isJobseeker ? "page" : undefined}
              className={`flex h-[38px] items-center justify-center rounded-full px-[22px] text-sm transition-colors aria-[current=page]:bg-[#FFE9A6] aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                isJobseeker ? "" : "text-[#4B5468]"
              }`}
            >
              Jobseeker
            </Link>
          </nav>
        )}

        {belowNav}
      </div>
    </div>
  );
}

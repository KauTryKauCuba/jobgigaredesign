"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCenterActiveTab } from "./useCenterActiveTab";
import AnimatedRibbon from "./AnimatedRibbon";
import Navbar from "./Navbar";
import { BriefcaseIcon, GiftIcon, HomeIcon, ImageIcon, MegaphoneIcon, PaletteIcon, StarIcon, TrendUpIcon, UserIcon, UsersIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

export type SuperadminNavKey =
  | "overview"
  | "job-postings"
  | "jobseekers"
  | "employers"
  | "company-ads"
  | "job-ads"
  | "welcome-popup"
  | "themes"
  | "campaigns"
  | "ai-usage";

const NAV_ITEMS = [
  { key: "overview", href: "/superadmin/dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "job-postings", href: "/superadmin/job-postings", label: "Job Postings", icon: BriefcaseIcon },
  { key: "jobseekers", href: "/superadmin/jobseekers", label: "Jobseekers", icon: UserIcon },
  { key: "employers", href: "/superadmin/employers", label: "Employers", icon: UsersIcon },
  { key: "company-ads", href: "/superadmin/company-ads", label: "Company Ads", icon: MegaphoneIcon },
  { key: "job-ads", href: "/superadmin/job-ads", label: "Job Ads", icon: ImageIcon },
  { key: "welcome-popup", href: "/superadmin/welcome-popup", label: "Welcome Popup", icon: StarIcon },
  { key: "themes", href: "/superadmin/themes", label: "Themes", icon: PaletteIcon },
  { key: "campaigns", href: "/superadmin/campaigns", label: "Campaigns", icon: GiftIcon },
  { key: "ai-usage", href: "/superadmin/ai-usage", label: "AI Usage", icon: TrendUpIcon },
] as const;

// Campaign rewards waiting for approval, for the number beside "Campaigns".
// Kept for the visit so moving between pages doesn't blink it; the
// Campaigns page reports changes through `jg:pending-rewards`.
let cachedPendingRewards = 0;
export function setPendingRewardCount(count: number) {
  cachedPendingRewards = count;
  window.dispatchEvent(new CustomEvent("jg:pending-rewards", { detail: count }));
}

function usePendingRewardCount() {
  const [count, setCount] = useState(cachedPendingRewards);
  useEffect(() => {
    const onChange = (e: Event) => setCount((e as CustomEvent<number>).detail);
    window.addEventListener("jg:pending-rewards", onChange);
    let cancelled = false;
    fetch("/api/superadmin/campaigns/pending-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || typeof data?.count !== "number") return;
        cachedPendingRewards = data.count;
        setCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener("jg:pending-rewards", onChange);
    };
  }, []);
  return count;
}

// Same sidebar/shell/ribbon layout as EmployerDashboardShell, but in the
// superadmin blue (src/app/superadmin/layout.tsx swaps the brand-teal-*
// colours) so it's never mistaken for the employer side.
export default function SuperadminDashboardShell({
  authUser,
  active,
  heading,
  headerAction,
  subheading,
  children,
}: {
  authUser: AuthUser;
  active: SuperadminNavKey;
  heading: React.ReactNode;
  headerAction?: React.ReactNode;
  subheading: React.ReactNode;
  children: React.ReactNode;
}) {
  const barRef = useCenterActiveTab<HTMLElement>();
  const pendingRewards = usePendingRewardCount();
  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
      <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-brand-teal-page">
        <Navbar initialUser={authUser} hideProfileLinks appShell />
      </div>

      <div className="app-shell pt-[20px]">
        <div className="flex flex-col gap-[24px] xl:flex-row xl:items-start">
          <aside ref={barRef} className="scrollbar-hide flex shrink-0 flex-row gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[4px] xl:sticky xl:top-[85px] xl:w-[220px] xl:flex-col xl:gap-[2px] xl:rounded-[14px] xl:border xl:border-[#EAEDF2] xl:bg-white xl:p-[10px]">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-[current=page]:bg-white aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] xl:rounded-[10px] xl:aria-[current=page]:bg-brand-teal-soft xl:aria-[current=page]:text-brand-teal-dark xl:aria-[current=page]:shadow-none ${
                  item.key === active ? "animate-fade-in-up" : ""
                }`}
              >
                <item.icon className="h-[16px] w-[16px] shrink-0" />
                {item.label}
                {item.key === "campaigns" && pendingRewards > 0 && (
                  <span
                    className="ml-auto rounded-full bg-brand-teal-dark px-[7px] py-[1px] text-xs text-white"
                    title={`${pendingRewards} waiting for approval`}
                  >
                    {pendingRewards > 99 ? "99+" : pendingRewards}
                  </span>
                )}
              </Link>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-[12px]">
              <h1
                className="text-xl font-sans font-semibold text-[#141B2E]"
                style={{ lineHeight: 1.15, letterSpacing: "-0.02em" }}
              >
                {heading}
              </h1>
              {headerAction}
            </div>
            <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">{subheading}</p>

            <div className="mt-[24px]">{children}</div>
          </div>
        </div>
      </div>

      <div className="flex-1" />
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon />
      </div>
    </main>
  );
}

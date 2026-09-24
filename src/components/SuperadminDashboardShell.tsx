"use client";

import Link from "next/link";
import AnimatedRibbon from "./AnimatedRibbon";
import Navbar from "./Navbar";
import { BriefcaseIcon, HomeIcon, UserIcon, UsersIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

export type SuperadminNavKey = "overview" | "job-postings" | "jobseekers" | "employers";

const NAV_ITEMS = [
  { key: "overview", href: "/superadmin/dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "job-postings", href: "/superadmin/job-postings", label: "Job Postings", icon: BriefcaseIcon },
  { key: "jobseekers", href: "/superadmin/jobseekers", label: "Jobseekers", icon: UserIcon },
  { key: "employers", href: "/superadmin/employers", label: "Employers", icon: UsersIcon },
] as const;

// Deliberately mirrors EmployerDashboardShell (same sidebar/shell/ribbon
// layout, same teal accent) rather than inventing a separate look — this is
// an internal review tool for a couple of people, not a branded surface.
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
  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#F2FAF5] pb-[92px]">
      <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-[#F2FAF5]">
        <Navbar initialUser={authUser} hideProfileLinks />
      </div>

      <div className="shell pt-[20px]">
        <div className="flex flex-col gap-[24px] lg:flex-row lg:items-start">
          <aside className="flex shrink-0 flex-row gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[4px] lg:sticky lg:top-[85px] lg:w-[220px] lg:flex-col lg:gap-[2px] lg:rounded-[14px] lg:border lg:border-[#EAEDF2] lg:bg-white lg:p-[10px]">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
                className="flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-[current=page]:bg-white aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:rounded-[10px] lg:aria-[current=page]:bg-[#E6F9FA] lg:aria-[current=page]:text-brand-teal-dark lg:aria-[current=page]:shadow-none"
              >
                <item.icon className="h-[16px] w-[16px] shrink-0" />
                {item.label}
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

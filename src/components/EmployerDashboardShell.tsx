"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AnimatedRibbon from "./AnimatedRibbon";
import CompanySwitcher from "./CompanySwitcher";
import FloatingDemoWidget from "./FloatingDemoWidget";
import Navbar from "./Navbar";
import PosterGeneratorTeaser from "./PosterGeneratorTeaser";
import { UnsavedChangesGuardBoundary, useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { BriefcaseIcon, BuildingIcon, CalendarIcon, HomeIcon, UserIcon, UsersIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

export type EmployerNavKey = "overview" | "jobs" | "applicants" | "interviews" | "company" | "team" | "profile";

const NAV_ITEMS = [
  { key: "overview", href: "/employer/dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "jobs", href: "/employer/jobs", label: "Manage Job", icon: BriefcaseIcon },
  { key: "applicants", href: "/employer/applicants", label: "Applicants", icon: UsersIcon },
  { key: "interviews", href: "/employer/interviews", label: "Interviews", icon: CalendarIcon },
  { key: "company", href: "/employer/company", label: "Company Profile", icon: BuildingIcon },
  { key: "team", href: "/employer/team", label: "Team", icon: UsersIcon },
  { key: "profile", href: "/employer/profile", label: "My Profile", icon: UserIcon },
] as const;

// Split out so useUnsavedChangesGuard() is called by a genuine descendant of
// the UnsavedChangesGuardBoundary rendered below — calling it directly in
// EmployerDashboardShell's own body would read the tree position ABOVE that
// Boundary (a component can't be inside a Provider it renders as part of its
// own output), always getting the default no-op guard.
function Sidebar({ active }: { active: EmployerNavKey }) {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();
  return (
    <aside className="flex shrink-0 flex-row gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[4px] lg:flex-col lg:gap-[2px] lg:rounded-[14px] lg:border lg:border-[#EAEDF2] lg:bg-white lg:p-[10px]">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          onClick={(e) => {
            if (item.key === active) return;
            e.preventDefault();
            guardNavigation(() => router.push(item.href));
          }}
          className="flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-[current=page]:bg-white aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:rounded-[10px] lg:aria-[current=page]:bg-[#E6F9FA] lg:aria-[current=page]:text-brand-teal-dark lg:aria-[current=page]:shadow-none"
        >
          <item.icon className="h-[16px] w-[16px] shrink-0" />
          {item.label}
        </Link>
      ))}
    </aside>
  );
}

// Shared sidebar app-shell (Navbar, sidebar nav, content pane, ribbon,
// floating chat) reused by Dashboard, Manage Job, Company Profile, and My
// Profile so all four read as one dashboard rather than differently-laid-out
// pages. Manage Job links to a real page with a "coming soon" empty state —
// there's no job_postings table yet (see the finalized but unbuilt
// application-pipeline design), so it can't show real data yet.
export default function EmployerDashboardShell({
  authUser,
  active,
  heading,
  headerAction,
  subheading,
  children,
}: {
  authUser: AuthUser;
  active: EmployerNavKey;
  heading: React.ReactNode;
  headerAction?: React.ReactNode;
  subheading: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <UnsavedChangesGuardBoundary>
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#F2FAF5] pb-[92px]">
      <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-[#F2FAF5]">
        <Navbar initialUser={authUser} hideProfileLinks />
      </div>

      <div className="shell pt-[20px]">
        <div className="flex flex-col gap-[24px] lg:flex-row lg:items-start">
          <div className="flex shrink-0 flex-col gap-[10px] lg:sticky lg:top-[85px] lg:w-[220px]">
            {/* Only renders once someone actually belongs to more than one
                company — invisible for the common single-company case. */}
            <CompanySwitcher />
            <Sidebar active={active} />
            <PosterGeneratorTeaser />
          </div>

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

      {/* Pushes the ribbon down to the bottom of the viewport instead of
          sitting right under the content above. */}
      <div className="flex-1" />
      {/* Clipped to its top half and pulled down past the floating-chat
          clearance (-mb cancels the <main> padding reserved for it) so the
          ribbon reads as bleeding off the bottom edge rather than sitting
          fully in view. */}
      <div className="-mb-[92px] h-[80px] overflow-hidden sm:h-[110px] lg:h-[150px]">
        <AnimatedRibbon />
      </div>
      {/* FloatingDemoWidget is fixed to the viewport bottom, like the navbar
          pinned to the top — it renders here for source order, not layout. */}
      <FloatingDemoWidget />
    </main>
    </UnsavedChangesGuardBoundary>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AnimatedRibbon from "./AnimatedRibbon";
import FloatingDemoWidget from "./FloatingDemoWidget";
import Navbar from "./Navbar";
import SidebarResumeCard from "./SidebarResumeCard";
import { UnsavedChangesGuardBoundary, useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { BriefcaseIcon, HomeIcon, UserIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

export type JobseekerNavKey = "overview" | "applications" | "profile";

const NAV_ITEMS = [
  { key: "overview", href: "/jobseeker/dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "applications", href: "/jobseeker/applications", label: "My Applications", icon: BriefcaseIcon },
  { key: "profile", href: "/jobseeker/profile", label: "My Profile", icon: UserIcon },
] as const;

// Split out so useUnsavedChangesGuard() is called by a genuine descendant of
// the UnsavedChangesGuardBoundary rendered below — calling it directly in
// JobseekerDashboardShell's own body would read the tree position ABOVE that
// Boundary (a component can't be inside a Provider it renders as part of its
// own output), always getting the default no-op guard.
function Sidebar({ active, resume }: { active: JobseekerNavKey; resume: { fileName: string; fileSize: number | null } | null }) {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();
  return (
    <div className="flex shrink-0 flex-col gap-[16px] lg:sticky lg:top-[85px] lg:w-[220px]">
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
            className="flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-[current=page]:bg-white aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:rounded-[10px] lg:aria-[current=page]:bg-[#FFF3D6] lg:aria-[current=page]:text-brand-gold-dark lg:aria-[current=page]:shadow-none"
          >
            <item.icon className="h-[16px] w-[16px] shrink-0" />
            {item.label}
          </Link>
        ))}
      </aside>

      <SidebarResumeCard initialResume={resume} />
    </div>
  );
}

// Jobseeker counterpart to EmployerDashboardShell — same sidebar app-shell
// (Navbar, sidebar nav, content pane, ribbon, floating chat) so Dashboard and
// My Profile read as one dashboard, just re-themed gold instead of teal and
// trimmed to the two nav items jobseeker actually has.
export default function JobseekerDashboardShell({
  authUser,
  active,
  heading,
  headerAction,
  subheading,
  resume = null,
  children,
}: {
  authUser: AuthUser;
  active: JobseekerNavKey;
  heading: React.ReactNode;
  headerAction?: React.ReactNode;
  subheading: React.ReactNode;
  resume?: { fileName: string; fileSize: number | null } | null;
  children: React.ReactNode;
}) {
  return (
    <UnsavedChangesGuardBoundary>
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-[#FDFAF0] pb-[92px]">
      <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-[#FDFAF0]">
        <Navbar initialUser={authUser} pageRole="jobseeker" hideProfileLinks />
      </div>

      <div className="shell pt-[20px]">
        <div className="flex flex-col gap-[24px] lg:flex-row lg:items-start">
          <Sidebar active={active} resume={resume} />

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
        <AnimatedRibbon accent="gold" />
      </div>
      {/* FloatingDemoWidget is fixed to the viewport bottom, like the navbar
          pinned to the top — it renders here for source order, not layout. */}
      <FloatingDemoWidget />
    </main>
    </UnsavedChangesGuardBoundary>
  );
}

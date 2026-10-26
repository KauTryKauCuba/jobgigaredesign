"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AnimatedRibbon from "./AnimatedRibbon";
import CompanySwitcher from "./CompanySwitcher";
import FloatingAssistant from "./FloatingAssistant";
import Navbar from "./Navbar";
import PhoneVerifyBanner, { phoneBannerClosedThisVisit } from "./PhoneVerifyBanner";
import RewardPopup from "./RewardPopup";
import SampleDataBanner from "./SampleDataBanner";
import { UnsavedChangesGuardBoundary, useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { useCenterActiveTab } from "./useCenterActiveTab";
import { BriefcaseIcon, BuildingIcon, CalendarIcon, GiftIcon, HomeIcon, MegaphoneIcon, UserIcon, UsersIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import type { TeamRole } from "@/lib/team-roles";

export type EmployerNavKey =
  | "overview"
  | "jobs"
  | "applicants"
  | "interviews"
  | "company"
  | "advertisement"
  | "team"
  | "profile"
  | "rewards";

const NAV_ITEMS = [
  { key: "overview", href: "/employer/dashboard", label: "Dashboard", icon: HomeIcon },
  { key: "jobs", href: "/employer/jobs", label: "Manage Job", icon: BriefcaseIcon },
  { key: "applicants", href: "/employer/applicants", label: "Applicants", icon: UsersIcon },
  { key: "interviews", href: "/employer/interviews", label: "Interviews", icon: CalendarIcon },
  { key: "company", href: "/employer/company", label: "Company Profile", icon: BuildingIcon },
  { key: "advertisement", href: "/employer/advertisement", label: "Advertisement", icon: MegaphoneIcon },
  { key: "team", href: "/employer/team", label: "Team", icon: UsersIcon },
  { key: "profile", href: "/employer/profile", label: "My Profile", icon: UserIcon },
] as const;

// Only once they've earned something from a reward campaign.
const REWARDS_ITEM = { key: "rewards", href: "/employer/rewards", label: "My Rewards", icon: GiftIcon } as const;

// Hiring managers work on their assigned jobs only; Panel members only on
// the interviews they're on (the pages themselves enforce the same).
const LIMITED_NAV: Partial<Record<TeamRole, EmployerNavKey[]>> = {
  hiring_manager: ["overview", "jobs", "applicants", "interviews", "profile"],
  panel: ["interviews", "profile"],
};

function navItemsFor(teamRole: TeamRole | null | undefined, hasRewards: boolean) {
  const allowed = teamRole ? LIMITED_NAV[teamRole] : undefined;
  const items = !allowed
    ? NAV_ITEMS.map((item) => ({ ...item, label: item.label as string }))
    : NAV_ITEMS.filter((item) => allowed.includes(item.key)).map((item) => ({
        ...item,
        label: item.key === "jobs" ? "My jobs" : (item.label as string),
      }));
  return hasRewards ? [...items, { ...REWARDS_ITEM, label: REWARDS_ITEM.label as string }] : items;
}

// Split out so useUnsavedChangesGuard() is called by a genuine descendant of
// the UnsavedChangesGuardBoundary rendered below — calling it directly in
// EmployerDashboardShell's own body would read the tree position ABOVE that
// Boundary (a component can't be inside a Provider it renders as part of its
// own output), always getting the default no-op guard.
function Sidebar({
  active,
  teamRole,
  hasRewards,
}: {
  active: EmployerNavKey;
  teamRole: TeamRole | null | undefined;
  hasRewards: boolean;
}) {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();
  const barRef = useCenterActiveTab<HTMLElement>();
  return (
    <aside ref={barRef} className="scrollbar-hide flex shrink-0 flex-row gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[4px] xl:flex-col xl:gap-[2px] xl:rounded-[14px] xl:border xl:border-[#EAEDF2] xl:bg-white xl:p-[10px]">
      {navItemsFor(teamRole, hasRewards).map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          onClick={(e) => {
            if (item.key === active) return;
            e.preventDefault();
            guardNavigation(() => router.push(item.href));
          }}
          className={`flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] aria-[current=page]:bg-white aria-[current=page]:text-[#141B2E] aria-[current=page]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] xl:rounded-[10px] xl:aria-[current=page]:bg-brand-teal-soft xl:aria-[current=page]:text-brand-teal-dark xl:aria-[current=page]:shadow-none ${
            item.key === active ? "animate-fade-in-up" : ""
          }`}
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
  // The rail sticks 85px below the top — unless it's taller than the screen
  // (nav plus the sidebar cards), in which case it scrolls with the page until
  // its bottom is in view and sticks there, so nothing in it is unreachable.
  const railRef = useRef<HTMLDivElement>(null);
  const [railTop, setRailTop] = useState(85);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => setRailTop(Math.min(85, window.innerHeight - rail.offsetHeight - 16));
    // ResizeObserver also fires once right away, which sets the first value.
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const [phoneBarClosed, setPhoneBarClosed] = useState(phoneBannerClosedThisVisit);
  const showPhoneBar = !!authUser.showPhoneVerifyBar && !phoneBarClosed;

  return (
    <UnsavedChangesGuardBoundary>
    <main className="flex min-h-[100svh] flex-col overflow-x-clip bg-brand-teal-page pb-[92px]">
      <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-brand-teal-page">
        <Navbar initialUser={authUser} hideProfileLinks appShell />
      </div>
      {/* Both can show at once, stacked — sample data on top. */}
      <SampleDataBanner initialShow={authUser.showSampleDataBar} />
      {showPhoneBar && (
        <PhoneVerifyBanner
          role="employer"
          show
          rewardText={authUser.rewards?.verifyBarText}
          onClose={() => setPhoneBarClosed(true)}
        />
      )}
      <RewardPopup reward={authUser.rewards?.popup} />

      <div className="app-shell pt-[20px]">
        <div className="flex flex-col gap-[24px] xl:flex-row xl:items-start">
          {/* `contents` below xl flattens this column so its pieces stack
              with the page content on smaller screens; xl restores the sticky rail. */}
          <div
            ref={railRef}
            className="contents xl:sticky xl:flex xl:w-[220px] xl:shrink-0 xl:flex-col xl:gap-[10px]"
            style={{ top: railTop }}
          >
            {/* Only renders once someone actually belongs to more than one
                company — invisible for the common single-company case. */}
            <CompanySwitcher />
            <Sidebar active={active} teamRole={authUser.teamRole} hasRewards={!!authUser.rewards?.hasRewards || active === "rewards"} />
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
      {/* FloatingAssistant is fixed to the viewport bottom, like the navbar
          pinned to the top — it renders here for source order, not layout. */}
      <FloatingAssistant />
    </main>
    </UnsavedChangesGuardBoundary>
  );
}

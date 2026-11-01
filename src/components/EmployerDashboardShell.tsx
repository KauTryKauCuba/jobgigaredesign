"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import AnimatedRibbon from "./AnimatedRibbon";
import CompanySwitcher from "./CompanySwitcher";
import FloatingAssistant, { type ChatRailActions } from "./FloatingAssistant";
import Navbar from "./Navbar";
import NavLinkIcon from "./NavLinkIcon";
import PhoneVerifyBanner, { phoneBannerClosedThisVisit } from "./PhoneVerifyBanner";
import RewardPopup from "./RewardPopup";
import SampleDataBanner from "./SampleDataBanner";
import SiriOrb from "./SiriOrb";
import { UnsavedChangesGuardBoundary, useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import { useCenterActiveTab } from "./useCenterActiveTab";
import { CHAT_MODE_COOKIE, SIDEBAR_COLLAPSED_ATTR, SIDEBAR_COLLAPSED_KEY } from "@/lib/employer-dashboard-prefs";
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  GiftIcon,
  GridIcon,
  HomeIcon,
  MegaphoneIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
} from "./icons";
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
// A sidebar nav spinner clears itself after this long even if the
// transition it's tracking never resolves — see the watchdog in Sidebar.
const NAV_PENDING_TIMEOUT_MS = 10_000;
const NAV_ITEM =
  "emp-nav-link flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full px-[16px] py-[10px] text-sm text-[#4B5468] transition-colors hover:bg-black/[0.03] xl:h-[40px] xl:rounded-[10px]";
// The current page (or, in Chat mode, an open Past chats panel).
const NAV_ITEM_SELECTED =
  "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.06)] xl:bg-brand-teal-soft xl:text-brand-teal-dark xl:shadow-none";

function Sidebar({
  active,
  teamRole,
  hasRewards,
  collapsed,
  onToggleCollapsed,
  chatActions,
  onNavigate,
}: {
  // null in Chat mode, where no dashboard page is showing.
  active: EmployerNavKey | null;
  teamRole: TeamRole | null | undefined;
  hasRewards: boolean;
  // Icon-only, xl+ only — below that it's already the compact horizontal
  // pill row, so there's nothing further to collapse there.
  collapsed: boolean;
  onToggleCollapsed: () => void;
  // Chat mode: New chat and Past chats, above the pages.
  chatActions?: ChatRailActions;
  // Chat mode: opening a page goes through here (it switches back to
  // Dashboard mode first, so the page actually shows).
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();
  const barRef = useCenterActiveTab<HTMLElement>();
  // router.push inside a transition, so the clicked item can show it's loading.
  const [navigating, startNavigation] = useTransition();
  const [clickedKey, setClickedKey] = useState<EmployerNavKey | null>(null);
  // Self-heals a spinner that never clears (e.g. the destination page threw
  // during the transition, so `navigating` never goes back to false) — the
  // page itself may already be there even if the nav state got stuck.
  useEffect(() => {
    if (clickedKey === null) return;
    const timer = setTimeout(() => setClickedKey(null), NAV_PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [clickedKey]);
  const itemClass = (selected: boolean) =>
    `${NAV_ITEM} ${selected ? `${NAV_ITEM_SELECTED} animate-fade-in-up` : ""} ${collapsed ? "xl:justify-center xl:px-0" : ""}`;
  const label = (text: string) => <span className={`emp-nav-label ${collapsed ? "xl:hidden" : ""}`}>{text}</span>;
  return (
    <aside ref={barRef} className="scrollbar-hide flex shrink-0 flex-row gap-[4px] overflow-x-auto rounded-full bg-[#F1F4F8] p-[4px] xl:flex-col xl:gap-[2px] xl:rounded-[14px] xl:border xl:border-[#EAEDF2] xl:bg-white xl:p-[10px]">
      {chatActions && (
        <>
          <button type="button" onClick={chatActions.newChat} title={collapsed ? "New chat" : undefined} className={itemClass(false)}>
            <PlusIcon className="h-[16px] w-[16px] shrink-0" />
            {label("New chat")}
          </button>
          {chatActions.canShowPastChats && (
            <button
              type="button"
              onClick={chatActions.togglePastChats}
              aria-pressed={chatActions.pastChatsOpen}
              title={collapsed ? "Past chats" : undefined}
              className={itemClass(chatActions.pastChatsOpen)}
            >
              <ClockIcon className="h-[16px] w-[16px] shrink-0" />
              {label("Past chats")}
            </button>
          )}
          <span aria-hidden className="mx-[2px] my-[8px] w-px shrink-0 bg-black/[0.1] xl:mx-[6px] xl:my-[6px] xl:h-px xl:w-auto xl:bg-[#EAEDF2]" />
        </>
      )}
      {navItemsFor(teamRole, hasRewards).map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          onClick={(e) => {
            if (item.key === active) return;
            e.preventDefault();
            if (onNavigate) {
              onNavigate(item.href);
              return;
            }
            guardNavigation(() => {
              setClickedKey(item.key);
              startNavigation(() => router.push(item.href));
            });
          }}
          className={itemClass(item.key === active)}
        >
          <NavLinkIcon icon={item.icon} pending={navigating && clickedKey === item.key} />
          {label(item.label)}
        </Link>
      ))}
      {/* Collapse/expand — xl only, where the vertical layout has width worth reclaiming. */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden shrink-0 items-center justify-center rounded-[10px] py-[10px] text-[#9AA3B2] transition-colors hover:bg-black/[0.03] hover:text-[#4B5468] xl:flex"
      >
        <ChevronDownIcon
          className={`h-[11px] w-[11px] transition-transform ${collapsed ? "-rotate-90" : "rotate-90"}`}
        />
      </button>
    </aside>
  );
}

type ViewMode = "dashboard" | "chat";

// How long the outgoing view takes to fade out (matches .animate-mode-out).
const MODE_FADE_MS = 220;

/**
 * Dashboard / Chat — under the assistant's message box, sized to match the
 * "AI can make mistakes" note beside it. Chat turns the page into a
 * full-screen assistant.
 */
function ModeSwitch({ mode, onChange, disabled }: { mode: ViewMode; onChange: (mode: ViewMode) => void; disabled: boolean }) {
  return (
    <div role="radiogroup" aria-label="View" className="flex rounded-full bg-white/80 p-[2px] backdrop-blur-sm">
      {(["dashboard", "chat"] as const).map((option) => {
        const selected = mode === option;
        const label = option === "dashboard" ? "Dashboard" : "Chat";
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`flex h-[17px] items-center gap-[4px] rounded-full px-[8px] text-[11px] transition-colors ${
              selected ? "bg-brand-teal-soft text-brand-teal-dark" : "text-[#9AA3B2] hover:text-[#4B5468]"
            }`}
          >
            {option === "dashboard" ? (
              <GridIcon className="h-[10px] w-[10px]" />
            ) : (
              <SiriOrb className="h-[10px] w-[10px]" active={selected} />
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
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

  // Icon-only sidebar, remembered per browser — loaded after mount (not
  // during the initial render) so server and client agree on the first
  // paint, same reasoning as the dashboard's other saved-locally prefs.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setSidebarCollapsed(true);
    } catch {
      // Storage unavailable — just show the sidebar expanded.
    }
  }, []);
  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Won't persist past a reload, but still reflects locally.
      }
      // The before-paint script (app/layout.tsx) only ever ADDS this
      // attribute, never removes it — it has no reason to on its own, since
      // a page load starts from a fresh <body> each time. Clicking here,
      // mid-session, is the one path that can leave it stuck "collapsed"
      // from an earlier load: its CSS rule targets the rail by id, which
      // outranks a Tailwind width *class*, so without this, expanding would
      // update the state/classes but the sidebar would stay visually
      // collapsed anyway.
      try {
        document.body.toggleAttribute(SIDEBAR_COLLAPSED_ATTR, next);
      } catch {
        // No DOM access — nothing to desync.
      }
      return next;
    });
  }

  // Dashboard / Chat mode, remembered in a cookie the server reads (see
  // getAuthUser), so a page always arrives in the right mode — no flash.
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<ViewMode>(authUser.chatMode ? "chat" : "dashboard");
  const [switching, setSwitching] = useState(false);
  // The view that's just come in plays its fade-in (not on a plain page load).
  const [arrived, setArrived] = useState(false);

  function saveMode(next: ViewMode) {
    document.cookie = `${CHAT_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  function switchMode(next: ViewMode) {
    if (next === mode || switching) return;
    saveMode(next);
    const apply = () => {
      setMode(next);
      setArrived(true);
      setSwitching(false);
      window.scrollTo(0, 0);
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }
    setSwitching(true);
    setTimeout(apply, MODE_FADE_MS);
  }

  // Chat mode's page links (the rail, and links in the assistant's replies)
  // switch back to Dashboard mode so the page actually shows.
  function openFromChat(href: string) {
    if (href.split(/[?#]/)[0] === pathname) {
      switchMode("dashboard");
      if (href !== pathname) router.push(href);
      return;
    }
    saveMode("dashboard");
    router.push(href);
  }

  const chat = mode === "chat";
  const hasRewards = !!authUser.rewards?.hasRewards || active === "rewards";

  // Chat mode's left rail: the very same company card and sidebar (and its
  // collapse state, and its height), with New chat / Past chats on top —
  // flush against the left edge.
  const chatRail = (actions: ChatRailActions) => (
    <div
      // No overflow clipping here — the company switcher's dropdown opens out
      // past the rail's edge — and above the chat, like the dashboard's rail.
      className={`relative z-20 flex shrink-0 flex-col gap-[10px] px-4 pt-[16px] xl:self-start xl:px-0 xl:py-[16px] xl:pl-[16px] ${
        sidebarCollapsed ? "xl:w-[80px]" : "xl:w-[236px]"
      }`}
    >
      <CompanySwitcher collapsed={sidebarCollapsed} />
      <Sidebar
        active={null}
        teamRole={authUser.teamRole}
        hasRewards={hasRewards}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        chatActions={actions}
        onNavigate={openFromChat}
      />
    </div>
  );

  return (
    <UnsavedChangesGuardBoundary>
    <main
      className={`flex flex-col overflow-x-clip bg-brand-teal-page ${chat ? "h-[100svh] overflow-hidden" : "min-h-[100svh] pb-[92px]"}`}
    >
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

      {!chat && (
      <div
        id="employer-dashboard-view"
        className={`flex flex-1 flex-col ${switching ? "animate-mode-out" : arrived ? "animate-mode-in" : ""}`}
      >
      <div className="app-shell pt-[20px]">
        <div className="flex flex-col gap-[24px] xl:flex-row xl:items-start">
          {/* `contents` below xl flattens this column so its pieces stack
              with the page content on smaller screens; xl restores the sticky rail. */}
          <div
            id="employer-sidebar-rail"
            ref={railRef}
            // `sticky` makes this its own stacking context, so its own
            // z-index decides whether it (and anything that opens inside
            // it, like the company switcher's dropdown) paints above or
            // below the main content next to it — without one, it's z-auto
            // and loses to content, which comes later in the markup.
            className={`contents xl:sticky xl:z-20 xl:flex xl:shrink-0 xl:flex-col xl:gap-[10px] ${sidebarCollapsed ? "xl:w-[64px]" : "xl:w-[220px]"}`}
            style={{ top: railTop }}
          >
            {/* Only renders once someone actually belongs to more than one
                company — invisible for the common single-company case. */}
            <CompanySwitcher collapsed={sidebarCollapsed} />
            <Sidebar
              active={active}
              teamRole={authUser.teamRole}
              hasRewards={hasRewards}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={toggleSidebarCollapsed}
            />
          </div>
          {/* The matching before-paint script that sets this look from
              localStorage (so there's no snap-to-collapsed on load) lives
              in the root layout, not here — see app/layout.tsx. */}

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
      </div>
      )}
      {/* Dashboard mode: the bar fixed to the viewport bottom (it renders
          here for source order, not layout). Chat mode: the same component
          fills the page — one instance either way, so the chat carries
          across a switch. */}
      <FloatingAssistant
        layout={chat ? "full" : "floating"}
        leaving={switching}
        entering={arrived && !switching}
        greetingName={authUser.name}
        viewer={{
          id: authUser.id,
          isOwner: authUser.teamRole === "owner",
          name: authUser.name,
          avatarUrl: authUser.avatarUrl,
          position: authUser.position,
        }}
        rail={chatRail}
        onNavigate={chat ? openFromChat : undefined}
        modeSwitch={<ModeSwitch mode={mode} onChange={switchMode} disabled={switching} />}
      />
    </main>
    </UnsavedChangesGuardBoundary>
  );
}

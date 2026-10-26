"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthModal, { type AuthMode, type AuthUser } from "./AuthModal";
import { useDraftName } from "./DraftNameContext";
import { ChevronDownIcon, SignOutIcon, UserIcon } from "./icons";
import Modal from "./Modal";
import NotificationBell from "./NotificationBell";
import ToolsMenu from "./ToolsMenu";
import VerifiedBadge from "./VerifiedBadge";
import { hasFullAccess, TEAM_ROLE_LABEL } from "@/lib/team-roles";

export default function Navbar({
  showUserName = true,
  initialUser,
  pageRole = "employer",
  onboarding = false,
  hideProfileLinks = false,
  appShell = false,
}: {
  showUserName?: boolean;
  initialUser?: AuthUser | null;
  pageRole?: "employer" | "jobseeker";
  // Mid-onboarding, there's no profile yet — "Dashboard" and the avatar
  // menu's "My Profile"/"Company Profile" links would all 404 or redirect
  // straight back here, so this trims the signed-in nav down to just an
  // avatar (no dropdown), a direct "Switch to X" button, and Sign out.
  onboarding?: boolean;
  // Drops "My Profile"/"Company Profile" from the avatar dropdown — for
  // pages that already surface those as sidebar nav links (the employer
  // dashboard shell), where repeating them in the dropdown is redundant.
  hideProfileLinks?: boolean;
  // Dashboards use .app-shell gutters; the navbar must match so its logo
  // and buttons line up with the content below.
  appShell?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  // Sign in opened from a team-invite link — the invited email and company.
  const [inviteSignIn, setInviteSignIn] = useState<{ email: string; company: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(initialUser);
  // Re-syncs `user` whenever a new initialUser comes in on a later render
  // (e.g. router.refresh() after saving a profile edit re-runs the server
  // page and passes a fresh avatarUrl/name down) — without this, `user`
  // would stay stuck at whatever it was on this component's first mount,
  // since useState only reads its initializer once. Adjusting state during
  // render (rather than in an effect) is the React-sanctioned way to sync
  // state to a changed prop without an extra render round-trip.
  const [syncedInitialUser, setSyncedInitialUser] = useState(initialUser);
  if (initialUser !== syncedInitialUser) {
    setSyncedInitialUser(initialUser);
    if (initialUser !== undefined) setUser(initialUser);
  }
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchConfirmStep, setSwitchConfirmStep] = useState<0 | 1 | 2>(0);
  // Set by the Google sign-in callback for a dual-role account — it can't
  // ask mid-redirect the way OTP sign-in asks mid-request, so it signs in
  // provisionally and flags this instead. Read via plain browser APIs
  // (not useSearchParams) so this doesn't force the otherwise-static "/"
  // page into a Suspense boundary just for this one-time check.
  const [postGoogleRoleChoice, setPostGoogleRoleChoice] = useState(false);
  // Set by the Google sign-in callback when it fails (e.g. no account found
  // for a "sign in" attempt) — same cookie-based handoff as
  // postGoogleRoleChoice above, and for the same reason: "/" unconditionally
  // redirects to "/employer", dropping any query string before this page
  // ever sees it.
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiUsage, setAiUsage] = useState<{ totalCalls: number; totalTokens: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const draftContext = useDraftName();
  const draftName = draftContext?.draftName.trim();
  const displayName = draftName || user?.name || user?.email;
  const displayAvatarUrl = draftContext?.draftAvatarUrl || user?.avatarUrl;
  // During onboarding nothing is saved yet, so the form's live answer decides;
  // everywhere else it's the saved profile's phone.
  const showPhoneSeal = draftContext?.draftPhoneVerified || !!user?.phoneVerified;
  // The company the employer is currently acting for takes the main avatar
  // circle, with their own photo as a small badge on its corner — mid-
  // onboarding there's no company yet, so it's the draft's own avatar as usual.
  const companyLogoUrl = !draftContext && user?.role === "employer" ? user.companyLogoUrl : null;
  const aboutHref = pageRole === "jobseeker" ? "/jobseeker/about" : "/employer/about";

  // Fetched lazily on first open (not on mount) — this is an inline summary
  // inside the dropdown itself, not a page, so there's no reason to pay for
  // it before anyone's actually looked. Fetched once, not on every reopen.
  useEffect(() => {
    if (!menuOpen || aiUsage) return;
    fetch("/api/ai-usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAiUsage({ totalCalls: data.totalCalls, totalTokens: data.totalTokens });
      })
      .catch(() => {});
  }, [menuOpen, aiUsage]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    // Already known server-side (passed as initialUser) — skip the client
    // fetch entirely so there's no signed-out flash while it resolves.
    if (initialUser !== undefined) return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, [initialUser]);

  useEffect(() => {
    // A cookie, not a URL param — the Google callback's redirect can chain
    // through more server-side redirects before landing on a real page
    // (e.g. "/" -> "/employer" -> "/employer/onboarding"), each of which
    // drops query params; the cookie survives all of them since it's resent
    // on every request to this origin regardless of how many hops happen.
    if (!document.cookie.split("; ").includes("post_google_role_choice=1")) return;
    // document.cookie only exists client-side after mount; there's no
    // render-time equivalent to derive this from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPostGoogleRoleChoice(true);
    document.cookie = "post_google_role_choice=; Max-Age=0; path=/";
  }, []);

  useEffect(() => {
    // Same cookie-handoff reasoning as postGoogleRoleChoice above — this one
    // carries a failure message (e.g. "no account found") from the Google
    // callback back to a real page, since a URL param on the "/" redirect
    // would be silently dropped by its own unconditional redirect to
    // "/employer".
    const match = document.cookie.split("; ").find((row) => row.startsWith("google_auth_error="));
    if (!match) return;
    const message = decodeURIComponent(match.split("=").slice(1).join("="));
    document.cookie = "google_auth_error=; Max-Age=0; path=/";
    if (!message) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoogleAuthError(message);
    setAuthMode("sign-in");
  }, []);

  useEffect(() => {
    // Set by a team-invite link (/invite/[id]) after signing out any other
    // account: open Sign in, pre-filled with the invited email — or, for a
    // cancelled invite, showing why it can't be used.
    const match = document.cookie.split("; ").find((row) => row.startsWith("invite_signin="));
    if (!match) return;
    document.cookie = "invite_signin=; Max-Age=0; path=/";
    let data: { email?: string; company?: string; error?: string } = {};
    try {
      data = JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
    } catch {
      return;
    }
    // document.cookie only exists client-side after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(null);
    if (data.error) {
      setGoogleAuthError(data.error);
    } else if (data.email) {
      setInviteSignIn({ email: data.email, company: data.company ?? "the team" });
    }
    setAuthMode("sign-in");
  }, []);

  async function choosePostGoogleRole(chosenRole: "employer" | "jobseeker") {
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: chosenRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwitchError(data.error ?? "Couldn't continue.");
        return;
      }
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      setUser(meData.user ?? null);
      setPostGoogleRoleChoice(false);
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setSwitchError("Couldn't continue.");
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    // Send the user back to their own role's landing page instead of the
    // generic "/" home, which always redirects to "/employer" regardless of
    // the signed-out user's actual role.
    const postLogoutPath = user?.role === "jobseeker" ? "/jobseeker" : "/employer";
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      return;
    }
    setUser(null);
    router.push(postLogoutPath);
    router.refresh();
  }

  async function performSwitchRole() {
    if (!user) return;
    const nextRole = user.role === "employer" ? "jobseeker" : "employer";
    setSwitching(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwitchError(data.error ?? "Couldn't switch roles.");
        return;
      }
      // Name and avatar are per-role, so re-fetch rather than reuse the
      // previous role's values.
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      setUser(meData.user ?? { ...user, role: nextRole });
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setSwitchError("Couldn't switch roles.");
    } finally {
      setSwitching(false);
    }
  }

  function handleSwitchRoleClick() {
    setMenuOpen(false);
    setSwitchConfirmStep(1);
  }

  function confirmSwitchRole() {
    setSwitchConfirmStep(0);
    performSwitchRole();
  }

  return (
    <header className="relative z-20 h-[65px] shrink-0">
      <nav className={`${appShell ? "app-shell" : "shell"} flex h-full items-center justify-between`}>
        {/* Left: logo, then Find job / Find companies and About. */}
        <div className="flex items-center gap-[18px] text-sm text-[#141B2E] sm:gap-[28px]">
        <Link
          href={user ? (user.role === "employer" ? "/employer" : "/jobseeker") : "/"}
          className="flex items-center"
        >
          <Image src="/jg-logo.svg" alt="JobGiga" width={111} height={28} loading="eager" />
        </Link>
          {pageRole === "jobseeker" && (
            <Link
              href="/jobseeker#job-search"
              onClick={(e) => {
                // Next's built-in hash-scroll only fires on an actual
                // navigation — clicking this while already on "/jobseeker"
                // doesn't change the route, so it never scrolls on its own.
                // Scrolling directly here covers that case; elsewhere it
                // still navigates to "/jobseeker" first as a normal link.
                if (pathname !== "/jobseeker") return;
                e.preventDefault();
                document.getElementById("job-search")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="hidden whitespace-nowrap px-[6px] py-[6px] hover:opacity-60 sm:block"
            >
              Find job
            </Link>
          )}
          {/* The public company directory — on the employer landing pages, not
              the jobseeker ones, nor inside the signed-in dashboards (appShell),
              which have their own sidebar. */}
          {!appShell && pageRole !== "jobseeker" && (
            <Link
              href="/companies"
              aria-current={pathname?.startsWith("/companies") ? "page" : undefined}
              className="hidden whitespace-nowrap px-[6px] py-[6px] hover:opacity-60 aria-[current=page]:font-semibold sm:block"
            >
              Find companies
            </Link>
          )}
          {/* Each side has its own About page — the link follows the side
              this page belongs to (teal employer / gold jobseeker). */}
          {!appShell && !onboarding && (
            <Link
              href={aboutHref}
              aria-current={pathname === aboutHref ? "page" : undefined}
              className="hidden whitespace-nowrap px-[6px] py-[6px] hover:opacity-60 aria-[current=page]:font-semibold sm:block"
            >
              About
            </Link>
          )}
        </div>

        {/* Right: Employer · Jobseeker, then Sign in / Get started (or the
            account controls) at the far right. Employer / Jobseeker are on
            the public pages only, not inside the dashboards (appShell) or
            mid-onboarding. */}
        <div className="flex items-center gap-[18px] text-sm text-[#141B2E]">
          {!appShell && !onboarding && (
            <>
              <Link
                href="/employer"
                aria-current={pathname === "/employer" ? "page" : undefined}
                className="hidden whitespace-nowrap px-[6px] py-[6px] hover:opacity-60 aria-[current=page]:font-semibold sm:block"
              >
                Employer
              </Link>
              <Link
                href="/jobseeker"
                aria-current={pathname === "/jobseeker" ? "page" : undefined}
                className="hidden whitespace-nowrap px-[6px] py-[6px] hover:opacity-60 aria-[current=page]:font-semibold sm:block"
              >
                Jobseeker
              </Link>
            </>
          )}
          {user === undefined ? null : user ? (
            <>
              {showUserName && (
                <span className="relative flex" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                    className="flex h-[38px] items-center gap-[8px] rounded-full px-[6px] text-sm text-[#4B5468] hover:bg-black/[0.03]"
                  >
                    {/* Wrapped so the "phone verified" seal and the overlapping
                        company logo/avatar can sit on the circle's edges. With
                        a company logo, both circles are the same size, the
                        avatar overlapping the logo's corner by about a third. */}
                    <span className={`relative shrink-0 ${companyLogoUrl && displayAvatarUrl ? "h-[28px] w-[47px]" : ""}`}>
                      <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F4F8] text-[#9AA3B2]">
                        {companyLogoUrl || displayAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={companyLogoUrl || displayAvatarUrl || undefined}
                            referrerPolicy="no-referrer"
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserIcon className="h-[13px] w-[13px]" />
                        )}
                      </span>
                      {/* Their own photo, same size as the logo, overlapping it by about a third
                          — its own relative wrapper so the phone seal below anchors to it, not the logo. */}
                      {companyLogoUrl && displayAvatarUrl ? (
                        <span className="absolute top-0 left-[19px] h-[28px] w-[28px] shrink-0">
                          <span className="relative block h-[28px] w-[28px]">
                            <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-white bg-[#F1F4F8]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={displayAvatarUrl} referrerPolicy="no-referrer" alt="" className="h-full w-full object-cover" />
                            </span>
                            {showPhoneSeal && <VerifiedBadge variant="phone" placement="avatar" size={13} tooltip={false} />}
                          </span>
                        </span>
                      ) : (
                        showPhoneSeal && <VerifiedBadge variant="phone" placement="avatar" size={13} tooltip={false} />
                      )}
                    </span>
                    <span className="hidden min-w-0 max-w-[200px] flex-col items-start leading-tight md:flex">
                      <span className="max-w-full truncate whitespace-nowrap">{displayName}</span>
                      {user.role === "employer" && (user.position || user.teamRole) && (
                        <span className="max-w-full truncate whitespace-nowrap text-xs text-[#9AA3B2]">
                          {[user.position, user.teamRole ? TEAM_ROLE_LABEL[user.teamRole] : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <ChevronDownIcon className="h-[9px] w-[9px] text-[#9AA3B2]" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute top-[calc(100%+8px)] right-0 z-30 w-[220px] rounded-[14px] border border-black/[0.06] bg-white py-[6px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                    >
                      {/* Mid-onboarding there's no profile yet, and "Switch
                          to X" is already its own button in the navbar (see
                          below) — so this trims down to just AI Usage,
                          rather than linking to pages that would only
                          redirect straight back here. hideProfileLinks does
                          the same trim for the employer dashboard shell,
                          which already surfaces these as sidebar links. */}
                      {/* The navbar's own Dashboard / Find job / Switch buttons are
                          hidden below sm to fit a phone header, so they live
                          in this menu there instead. */}
                      <div className="sm:hidden">
                        {!onboarding && (
                          <Link
                            href={user.role === "employer" ? "/employer/dashboard" : "/jobseeker/dashboard"}
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            Dashboard
                          </Link>
                        )}
                        {pageRole === "jobseeker" && (
                          <Link
                            href="/jobseeker#job-search"
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            Find job
                          </Link>
                        )}
                        {!appShell && pageRole !== "jobseeker" && (
                          <Link
                            href="/companies"
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            Find companies
                          </Link>
                        )}
                        {!appShell && !onboarding && (
                          <Link
                            href={aboutHref}
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            About
                          </Link>
                        )}
                        {onboarding && (
                          <button
                            type="button"
                            onClick={handleSwitchRoleClick}
                            disabled={switching}
                            className="block w-full px-[16px] py-[9px] text-left text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {switching ? "Switching…" : `Switch to ${user.role === "employer" ? "Jobseeker" : "Employer"}`}
                          </button>
                        )}
                      </div>
                      {!onboarding && !hideProfileLinks && (
                        <>
                          <Link
                            href={user.role === "employer" ? "/employer/profile" : "/jobseeker/profile"}
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            My Profile
                          </Link>
                          {/* Company Profile is Owner/Admin only. */}
                          {user.role === "employer" && hasFullAccess(user.teamRole ?? "owner") && (
                            <Link
                              href="/employer/company"
                              onClick={() => setMenuOpen(false)}
                              className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                            >
                              Company Profile
                            </Link>
                          )}
                        </>
                      )}
                      <div className="px-[16px] py-[9px]">
                        <p className="text-xs text-[#141B2E]">AI Usage</p>
                        <p className="mt-[2px] text-xs text-[#9AA3B2]">
                          {aiUsage
                            ? `${aiUsage.totalCalls} calls · ${aiUsage.totalTokens.toLocaleString()} tokens`
                            : "Loading…"}
                        </p>
                      </div>
                      {!onboarding && (
                        <>
                          <div className="my-[6px] h-px bg-black/[0.06]" />
                          <button
                            type="button"
                            onClick={handleSwitchRoleClick}
                            disabled={switching}
                            className="block w-full px-[16px] py-[9px] text-left text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {switching
                              ? "Switching…"
                              : `Switch to ${user.role === "employer" ? "Jobseeker" : "Employer"}`}
                          </button>
                          {switchError && (
                            <p className="px-[16px] py-[6px] text-xs text-red-500">{switchError}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </span>
              )}
              {onboarding ? (
                <button
                  type="button"
                  onClick={handleSwitchRoleClick}
                  disabled={switching}
                  className="hidden h-[38px] items-center rounded-full border border-black/[0.1] px-[18px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
                >
                  {switching
                    ? "Switching…"
                    : `Switch to ${user.role === "employer" ? "Jobseeker" : "Employer"}`}
                </button>
              ) : (
                <Link
                  href={user.role === "employer" ? "/employer/dashboard" : "/jobseeker/dashboard"}
                  className={`hidden h-[38px] items-center rounded-full px-[18px] text-sm sm:flex ${
                    user.role === "jobseeker"
                      ? "bg-brand-gold text-[#141B2E] hover:opacity-90"
                      : "bg-brand-teal-dark text-white hover:opacity-90"
                  }`}
                >
                  Dashboard
                </Link>
              )}
              {/* Poster generator / Refer a company — moved here from the
                  dashboard sidebar cards. Dashboard-only; owners/admins only,
                  same as the cards were (posters and referrals are company-
                  account things, not something a hiring manager/panelist does). */}
              {!onboarding && appShell && user.role === "employer" && hasFullAccess(user.teamRole ?? "owner") && (
                <ToolsMenu />
              )}
              {/* Paired with Sign out — same circle style, side by side. */}
              {!onboarding && <NotificationBell accent={user.role === "jobseeker" ? "gold" : "teal"} />}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-black/[0.1] text-[#141B2E] hover:bg-black/[0.03]"
              >
                <SignOutIcon className="h-[16px] w-[16px]" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAuthMode("sign-in")}
                className="hidden px-[6px] py-[6px] hover:opacity-60 sm:block"
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => setAuthMode("get-started")}
                className={`flex h-[38px] items-center rounded-full px-[18px] text-sm hover:opacity-90 ${
                  pageRole === "jobseeker" ? "bg-brand-gold text-[#141B2E]" : "bg-brand-teal-dark text-white"
                }`}
              >
                Get started
              </button>
            </>
          )}
        </div>
      </nav>

      {authMode && (
        <AuthModal
          mode={authMode}
          initialRole={inviteSignIn ? "employer" : pageRole}
          initialError={googleAuthError}
          initialEmail={inviteSignIn?.email}
          notice={inviteSignIn ? `Sign in with ${inviteSignIn.email} to join ${inviteSignIn.company}.` : null}
          onSwitchToGetStarted={() => setAuthMode("get-started")}
          onClose={() => {
            setAuthMode(null);
            setGoogleAuthError(null);
            setInviteSignIn(null);
          }}
          onAuthenticated={(authedUser) => {
            setUser(authedUser);
            setAuthMode(null);
            setGoogleAuthError(null);
            setInviteSignIn(null);
          }}
        />
      )}

      {switchConfirmStep > 0 && user && (
        <Modal onClose={() => setSwitchConfirmStep(0)}>
          <>
            {(() => {
              const nextRole = user.role === "employer" ? "jobseeker" : "employer";
              return switchConfirmStep === 1 ? (
                <>
                  <h2 className="text-lg font-semibold text-[#141B2E]">
                    Thinking about the {nextRole} side too?
                  </h2>
                  <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
                    Switching now will pause what you&rsquo;re setting up here and take you to start
                    your {nextRole} profile instead. No stress — everything you&rsquo;ve filled in so
                    far is already saved, so you can hop back and pick up right where you left off,
                    anytime.
                  </p>
                  <div className="mt-[20px] flex flex-col gap-[8px]">
                    <button
                      type="button"
                      onClick={() => setSwitchConfirmStep(2)}
                      className={`flex h-[38px] items-center justify-center rounded-full text-sm transition-opacity hover:opacity-90 ${
                        nextRole === "jobseeker"
                          ? "bg-brand-gold text-[#141B2E]"
                          : "bg-brand-teal-dark text-white"
                      }`}
                    >
                      Yes, let&rsquo;s switch
                    </button>
                    <button
                      type="button"
                      onClick={() => setSwitchConfirmStep(0)}
                      className="flex h-[38px] items-center justify-center rounded-full text-sm text-[#4B5468] hover:bg-black/[0.03]"
                    >
                      Not right now
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-[#141B2E]">Just double-checking!</h2>
                  <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
                    You&rsquo;re about to start a separate {nextRole} profile under this same
                    account. Ready to go?
                  </p>
                  <div className="mt-[20px] flex flex-col gap-[8px]">
                    <button
                      type="button"
                      onClick={confirmSwitchRole}
                      className={`flex h-[38px] items-center justify-center rounded-full text-sm transition-opacity hover:opacity-90 ${
                        nextRole === "jobseeker"
                          ? "bg-brand-gold text-[#141B2E]"
                          : "bg-brand-teal-dark text-white"
                      }`}
                    >
                      Yes, I&rsquo;m sure — switch now
                    </button>
                    <button
                      type="button"
                      onClick={() => setSwitchConfirmStep(1)}
                      className="flex h-[38px] items-center justify-center rounded-full text-sm text-[#4B5468] hover:bg-black/[0.03]"
                    >
                      Wait, go back
                    </button>
                  </div>
                </>
              );
            })()}
          </>
        </Modal>
      )}

      {postGoogleRoleChoice && user && (
        <Modal>
          <>
            <h2 className="text-lg font-semibold text-[#141B2E]">Welcome back!</h2>
            <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
              This account has both an employer and a jobseeker profile — which one do you want to
              continue as?
            </p>
            {switchError && <p className="mt-[10px] text-xs text-red-500">{switchError}</p>}
            <div className="mt-[20px] flex flex-col gap-[8px]">
              <button
                type="button"
                onClick={() => choosePostGoogleRole("employer")}
                disabled={switching}
                className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {switching ? "Continuing…" : "Continue as Employer"}
              </button>
              <button
                type="button"
                onClick={() => choosePostGoogleRole("jobseeker")}
                disabled={switching}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {switching ? "Continuing…" : "Continue as Jobseeker"}
              </button>
            </div>
          </>
        </Modal>
      )}
    </header>
  );
}

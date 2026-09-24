"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthModal, { type AuthMode, type AuthUser } from "./AuthModal";
import { useDraftName } from "./DraftNameContext";
import { ChevronDownIcon, SignOutIcon, UserIcon } from "./icons";
import Modal from "./Modal";

export default function Navbar({
  showUserName = true,
  initialUser,
  pageRole = "employer",
  onboarding = false,
  hideProfileLinks = false,
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
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
      <nav className="shell flex h-full items-center justify-between">
        <Link
          href={user ? (user.role === "employer" ? "/employer" : "/jobseeker") : "/"}
          className="flex items-center"
        >
          <Image src="/jg-logo.svg" alt="JobGiga" width={111} height={28} priority />
        </Link>

        <div className="flex items-center gap-[18px] text-sm text-[#141B2E]">
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
              className="hidden px-[6px] py-[6px] hover:opacity-60 sm:block"
            >
              Find job
            </Link>
          )}
          {user === undefined ? null : user ? (
            <>
              {showUserName && (
                <span className="relative hidden sm:flex" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-[8px] rounded-full px-[6px] py-[4px] text-sm text-[#4B5468] hover:bg-black/[0.03]"
                  >
                    <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F4F8] text-[#9AA3B2]">
                      {displayAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-[13px] w-[13px]" />
                      )}
                    </span>
                    {displayName}
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
                      {!onboarding && !hideProfileLinks && (
                        <>
                          <Link
                            href={user.role === "employer" ? "/employer/profile" : "/jobseeker/profile"}
                            onClick={() => setMenuOpen(false)}
                            className="block px-[16px] py-[9px] text-sm text-[#141B2E] hover:bg-black/[0.03]"
                          >
                            My Profile
                          </Link>
                          {user.role === "employer" && (
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
                      ? "bg-[#FFE9A6] text-[#141B2E] hover:opacity-90"
                      : "bg-brand-teal-dark text-white hover:opacity-90"
                  }`}
                >
                  Dashboard
                </Link>
              )}
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
                  pageRole === "jobseeker" ? "bg-[#FFE9A6] text-[#141B2E]" : "bg-brand-teal-dark text-white"
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
          initialRole={pageRole}
          initialError={googleAuthError}
          onSwitchToGetStarted={() => setAuthMode("get-started")}
          onClose={() => {
            setAuthMode(null);
            setGoogleAuthError(null);
          }}
          onAuthenticated={(authedUser) => {
            setUser(authedUser);
            setAuthMode(null);
            setGoogleAuthError(null);
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
                          ? "bg-[#FFE9A6] text-[#141B2E]"
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
                          ? "bg-[#FFE9A6] text-[#141B2E]"
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

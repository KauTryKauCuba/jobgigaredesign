"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

// Lets a page with an in-progress form intercept sidebar navigation the same
// way it intercepts its own Cancel button — both funnel through this one
// guard so there's a single confirm-dialog path.
export type NavigationGuard = (proceed: () => void) => void;

const NOOP_GUARD: NavigationGuard = (proceed) => proceed();

const UnsavedChangesContext = createContext<NavigationGuard>(NOOP_GUARD);
// Lets a descendant register the guard into a boundary that's an ancestor of
// both it and whatever else needs to read it (see UnsavedChangesGuardBoundary
// below) — separate from UnsavedChangesContext itself so a boundary's own
// guard value (a stable function reading the ref) never changes identity.
const RegisterGuardContext = createContext<(guard: NavigationGuard | null) => void>(() => {});

export function useUnsavedChangesGuard() {
  return useContext(UnsavedChangesContext);
}

// A dashboard shell renders its sidebar AND
// `children` as siblings, so a form passed in as `children` sits *below*
// the sidebar in the tree, not above it. A Provider rendered inside that
// form could never reach the sidebar (context only flows to descendants).
// This boundary goes around the whole shell instead (sidebar included), and
// exposes a `useRegisterUnsavedChangesGuard` hook the nested form calls to
// push its guard logic up into a ref the boundary's own stable guard reads —
// so the direction of "who provides, who consumes" is right without the
// form needing to know or render anything about the shell it's inside.
export function UnsavedChangesGuardBoundary({ children }: { children: ReactNode }) {
  const guardRef = useRef<NavigationGuard | null>(null);
  const stableGuard = useMemo<NavigationGuard>(
    () => (proceed) => {
      if (guardRef.current) guardRef.current(proceed);
      else proceed();
    },
    [],
  );
  const registerGuard = useMemo(
    () => (guard: NavigationGuard | null) => {
      guardRef.current = guard;
    },
    [],
  );
  return (
    <UnsavedChangesContext.Provider value={stableGuard}>
      <RegisterGuardContext.Provider value={registerGuard}>{children}</RegisterGuardContext.Provider>
    </UnsavedChangesContext.Provider>
  );
}

// Called by a form nested inside a UnsavedChangesGuardBoundary (directly or
// several levels down, e.g. inside a dashboard shell's `children`) to make
// its guard the one sidebar navigation actually runs. Pass `null` when
// there's nothing to guard (e.g. not in edit mode) so navigation proceeds
// freely. Outside a Boundary this is a no-op — the default RegisterGuardContext
// value ignores the call, same graceful fallback as useUnsavedChangesGuard's
// default no-op guard.
export function useRegisterUnsavedChangesGuard(guard: NavigationGuard | null) {
  const registerGuard = useContext(RegisterGuardContext);
  useEffect(() => {
    registerGuard(guard);
    return () => registerGuard(null);
  }, [guard, registerGuard]);
}

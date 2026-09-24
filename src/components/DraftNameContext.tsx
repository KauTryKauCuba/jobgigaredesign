"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DraftNameContextValue = {
  draftName: string;
  setDraftName: (name: string) => void;
  draftAvatarUrl: string | null;
  setDraftAvatarUrl: (url: string | null) => void;
};

const DraftNameContext = createContext<DraftNameContextValue | null>(null);

/**
 * Lets an onboarding form broadcast its "full name"/avatar fields live, so
 * the Navbar rendered alongside it can preview them as the user edits
 * instead of only updating once the form is submitted and saved.
 */
export function DraftNameProvider({ children }: { children: ReactNode }) {
  const [draftName, setDraftName] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(null);
  const value = useMemo(
    () => ({ draftName, setDraftName, draftAvatarUrl, setDraftAvatarUrl }),
    [draftName, draftAvatarUrl],
  );
  return <DraftNameContext.Provider value={value}>{children}</DraftNameContext.Provider>;
}

// Returns null when rendered outside a DraftNameProvider (e.g. every page
// other than the onboarding forms) so callers can fall back gracefully.
export function useDraftName() {
  return useContext(DraftNameContext);
}

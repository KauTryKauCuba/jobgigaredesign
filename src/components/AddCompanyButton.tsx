"use client";

import { useRouter } from "next/navigation";
import { useUnsavedChangesGuard } from "./UnsavedChangesGuard";

/**
 * Company Profile's "+ Add a company" — goes through the same unsaved-changes
 * guard as the sidebar, so a half-edited profile isn't lost. Greyed out with
 * a reason once the account has reached its company limit.
 */
export default function AddCompanyButton({ canAdd, limit }: { canAdd: boolean; limit: number }) {
  const router = useRouter();
  const guardNavigation = useUnsavedChangesGuard();

  return (
    <button
      type="button"
      disabled={!canAdd}
      title={canAdd ? undefined : `You've reached your limit of ${limit} companies. Contact JobGiga to add more.`}
      onClick={() => guardNavigation(() => router.push("/employer/companies/new"))}
      className="flex h-[38px] items-center justify-center rounded-full border border-brand-teal-dark px-[18px] text-sm text-brand-teal-dark transition-colors hover:bg-brand-teal-soft disabled:cursor-not-allowed disabled:border-black/[0.1] disabled:text-[#9AA3B2] disabled:hover:bg-transparent"
    >
      + Add a company
    </button>
  );
}

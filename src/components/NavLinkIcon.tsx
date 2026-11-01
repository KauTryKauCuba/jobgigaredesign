"use client";

import { useLinkStatus } from "next/link";

/**
 * A dashboard sidebar link's icon, which turns into a spinner while the page
 * it opens is loading — otherwise nothing changes on screen until the new
 * page arrives, and a slow one looks stuck. Same 16px box either way, so
 * nothing shifts; shown only after a short delay, so fast pages don't flash.
 *
 * Must render inside the <Link>. A plain Link reports its own loading state;
 * sidebars that navigate with router.push instead (behind the unsaved-changes
 * guard) pass `pending` themselves.
 */
export default function NavLinkIcon({
  icon: Icon,
  pending = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  pending?: boolean;
}) {
  const linkStatus = useLinkStatus();
  const loading = pending || linkStatus.pending;

  return (
    <span className="relative h-[16px] w-[16px] shrink-0">
      <Icon
        className={`h-[16px] w-[16px] transition-opacity ${loading ? "opacity-0 delay-150" : "opacity-100"}`}
      />
      <span
        aria-hidden
        className={`absolute inset-[1px] rounded-full border-[1.5px] border-current border-t-transparent transition-opacity ${
          loading ? "animate-spin opacity-100 delay-150" : "opacity-0"
        }`}
      />
    </span>
  );
}

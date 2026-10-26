"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Shown only to a superadmin previewing a theme on the real site. */
export default function SiteThemePreviewBar({ name, live }: { name: string; live: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    await fetch("/api/superadmin/themes/preview", { method: "DELETE" }).catch(() => null);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="relative z-[22] bg-[#141B2E] text-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-[12px] gap-y-[6px] px-[16px] py-[8px] text-xs">
        <span>
          Previewing <span className="font-semibold">{name}</span>
          {live ? " (live)" : " — only you can see this"}
        </span>
        <a href="/superadmin/themes" className="text-white/80 underline hover:text-white">
          Back to Themes
        </a>
        <button
          type="button"
          onClick={exit}
          disabled={busy}
          className="rounded-full bg-white px-[12px] py-[3px] text-[#141B2E] hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Exiting…" : "Exit preview"}
        </button>
      </div>
    </div>
  );
}

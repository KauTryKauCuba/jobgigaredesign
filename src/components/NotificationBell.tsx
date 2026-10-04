"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "./icons";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

// How often the bell re-checks while the tab is open (it also re-checks
// whenever the tab regains focus).
const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string, now: number) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The navbar's notification bell: unread count badge, a dropdown of the
 * latest notifications for the side of the app the user is signed in as,
 * and "Mark all read". Polls every 30s and on tab focus.
 */
export default function NotificationBell({ accent = "teal" }: { accent?: "teal" | "gold" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setNow(Date.now());
      setLoaded(true);
    } catch {
      // Offline or a blip — keep showing what we had; the next poll retries.
    }
  }, []);

  useEffect(() => {
    // First check right away, then on a timer and whenever the tab regains focus.
    const initial = setTimeout(load, 0);
    const interval = setInterval(load, POLL_INTERVAL_MS);
    window.addEventListener("focus", load);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(body: { ids: string[] } | { all: true }) {
    // Optimistic — the badge clears immediately; the server catches up.
    const ids = "ids" in body ? new Set(body.ids) : null;
    const readAt = new Date().toISOString();
    setItems((prev) => prev.map((n) => (!n.readAt && (!ids || ids.has(n.id)) ? { ...n, readAt } : n)));
    setUnreadCount((c) => (ids ? Math.max(0, c - ids.size) : 0));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      load();
    }
  }

  function openItem(item: NotificationItem) {
    if (!item.readAt) markRead({ ids: [item.id] });
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  const accentText = accent === "gold" ? "text-brand-gold-dark" : "text-brand-teal-dark";
  const unreadDot = accent === "gold" ? "bg-brand-gold-dark" : "bg-brand-teal-dark";

  return (
    <div ref={ref} className="relative flex">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        // Same circle as the navbar's Sign out button, so the two read as a pair.
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-black/[0.1] text-[#141B2E] hover:bg-black/[0.03]"
      >
        <BellIcon className="h-[16px] w-[16px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-[3px] -right-[3px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#E5484D] px-[4px] text-[10px] leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-[340px] max-w-[calc(100vw-32px)] flex-col rounded-[14px] border border-black/[0.06] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] px-[16px] py-[10px]">
            <p className="text-sm text-[#141B2E]">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markRead({ all: true })}
                className={`text-xs ${accentText} hover:underline`}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto py-[4px]">
            {!loaded ? (
              <p className="px-[16px] py-[14px] text-xs text-[#9AA3B2]">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-[16px] py-[14px] text-xs text-[#9AA3B2]">
                You&rsquo;re all caught up — updates about your applications and interviews will show up here.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(item)}
                  className={`flex w-full items-start gap-[10px] px-[16px] py-[10px] text-left hover:bg-black/[0.03] ${
                    item.readAt ? "" : "bg-[#F8FAFB]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${item.readAt ? "bg-transparent" : unreadDot}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-[#141B2E]">{item.title}</span>
                    {item.body && <span className="mt-[2px] block text-xs text-[#4B5468]">{item.body}</span>}
                    <span className="mt-[3px] block text-xs text-[#9AA3B2]">{timeAgo(item.createdAt, now)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

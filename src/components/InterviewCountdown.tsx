"use client";

import { useEffect, useState } from "react";

// Ticks every second so the countdown stays live while the page/modal is
// open, rather than freezing at whatever time it was when it first rendered.
export default function InterviewCountdown({
  scheduledAt,
  className = "mt-[4px] text-xs text-[#7C5CD1]",
}: {
  scheduledAt: string;
  className?: string;
}) {
  // Starts null so server and client render the same (empty) markup on
  // first paint — seeding this with Date.now() would embed the server's
  // render-time clock into the SSR HTML, which almost never matches the
  // client's clock by the time hydration runs, causing a mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const diffMs = new Date(scheduledAt).getTime() - now;
  if (diffMs <= 0) return null;

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s`;
  else label = `${seconds}s`;

  return <p className={className}>Starts in {label}</p>;
}

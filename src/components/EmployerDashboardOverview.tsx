"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gradientFrameClass } from "./formStyles";
import {
  BriefcaseIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  DraftIcon,
  EyeIcon,
  FlagIcon,
  PencilIcon,
  PlusIcon,
  StackIcon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from "./icons";
import InterviewCountdown from "./InterviewCountdown";
import TopMatchesCard from "./TopMatchesCard";
import type { CriteriaFlags } from "./MatchSettingsModal";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  INTERVIEW_MODE_LABEL,
  relativeTimeAgo,
  type InterviewDetails,
} from "@/lib/applicationStatus";

export type DashboardData = {
  stats: {
    activePostings: number;
    totalApplicants: number;
    interviewsThisWeek: number;
    needsEvaluation: number;
    rescheduleRequests: number;
    postingsNeedingAttention: number;
    noShows: number;
    newApplicants: number;
    kiv: number;
    staleOffers: number;
    interviewedNotEvaluated: number;
  };
  funnel: { stage: string; count: number }[];
  recentApplicants: {
    applicationId: string;
    applicantName: string;
    applicantAvatarUrl: string | null;
    jobPostingTitle: string;
    appliedAt: string;
    status: string;
  }[];
  upcomingInterviews: {
    applicationId: string;
    applicantName: string;
    applicantAvatarUrl: string | null;
    jobPostingTitle: string;
    scheduledAt: string;
    mode: InterviewDetails["mode"];
    round: number;
    durationMinutes: number | null;
  }[];
  hiringTrend: { monthLabel: string; hires: number }[];
  avgTimeToHireDays: number | null;
  postingPerformance: { id: string; title: string; status: string; applicantCount: number; viewCount: number }[];
  hasPostings: boolean;
};

type MatchResult = {
  applicationId: string;
  jobPostingId: string;
  score: number;
  eligible: boolean;
};

// Same bands as TopMatchesCard.tsx/EmployerJobPostingView.tsx's own "Top
// Matches" treatment, so a score reads the same wherever it shows up.
function matchBand(score: number): { bg: string; text: string } {
  if (score >= 80) return { bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" };
  if (score >= 60) return { bg: "bg-[#E6F9FA]", text: "text-[#008990]" };
  return { bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
}

// Same status pill colors/labels as Manage Job's STATUS_TILE_COLOR
// (EmployerJobsView.tsx), keyed by the raw db status instead of its
// capitalized display label, so this card's badge matches exactly.
const POSTING_STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#E6F9FA]", text: "text-[#008990]", label: "Active" },
  pending: { bg: "bg-[#FFF3D6]", text: "text-[#A67C00]", label: "Pending" },
  filled: { bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]", label: "Filled" },
  closed: { bg: "bg-black/[0.04]", text: "text-[#9AA3B2]", label: "Closed" },
  draft: { bg: "bg-[#F1ECFB]", text: "text-[#7C5CD1]", label: "Draft" },
  rejected: { bg: "bg-red-50", text: "text-red-500", label: "Rejected" },
  flagged: { bg: "bg-[#FFEFE3]", text: "text-[#C2600A]", label: "Flagged" },
};

function SectionCard({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`h-full ${gradientFrameClass("teal")}`}>
      <div className="flex h-full flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
        <div className="flex items-center justify-between gap-[8px]">
          <p className="text-sm text-[#141B2E]">{title}</p>
          {viewAllHref && (
            <Link href={viewAllHref} className="text-sm text-brand-teal-dark hover:underline">
              View all →
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] bg-[#F8FAFB] p-[16px] text-center text-xs text-[#9AA3B2]">{children}</p>
  );
}

type StatTileProps = {
  label: string;
  value: number;
  sublabel: string;
  sublabelColorClass: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  gradient: string;
} & ({ href: string } | { onClick: () => void });

// Shared shell for every Overview tile — the three "state of the world"
// stats (postings/applicants/interviews) and the "needs your action" ones
// (evaluations, reschedules, etc.) render identically, just wired to either
// a same-page scroll (onClick) or a link to another page (href).
function StatTile(props: StatTileProps) {
  const { label, value, sublabel, sublabelColorClass, actionLabel, icon: Icon, gradient } = props;
  const disabled = value === 0;
  const className = `gradient-noise group relative block h-full w-full overflow-hidden rounded-[20px] bg-gradient-to-b to-white to-90% p-[18px] text-left transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal-dark ${
    disabled ? "cursor-default opacity-60" : "cursor-pointer hover:-translate-y-[2px]"
  }`;
  const style = { backgroundImage: `linear-gradient(to bottom, ${gradient}, white 90%)` } as React.CSSProperties;

  const content = (
    <>
      <span aria-hidden className="pointer-events-none absolute -top-[5%] -right-[5%]">
        <Icon
          className="icon-gradient-color h-[84px] w-[84px] opacity-40"
          strokeWidth={0.63}
          style={{ "--icon-accent": gradient } as React.CSSProperties}
        />
      </span>

      <div className="relative flex h-full flex-col justify-between gap-[16px]">
        <div>
          <span className="inline-flex items-center gap-[6px] rounded-[6px] bg-white/90 px-[10px] py-[5px] text-[11px] text-[#4B5468]">
            <Icon className="h-[11px] w-[11px]" />
            {label}
          </span>
          <p className="mt-[12px] text-[26px] leading-none text-[#202033]">{value}</p>
          <p className={`mt-[6px] text-xs ${sublabelColorClass}`}>{sublabel}</p>
        </div>

        <div className="flex items-center justify-between gap-[8px] rounded-[10px] bg-white/95 px-[12px] py-[10px]">
          <span className="text-xs text-[#4B5468]">{actionLabel}</span>
          <span
            aria-hidden
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] border border-[#BFC1C6] text-sm text-[#4B5468] transition-transform group-hover:translate-x-[2px]"
          >
            →
          </span>
        </div>
      </div>
    </>
  );

  if ("href" in props) {
    return (
      <Link
        href={props.href}
        aria-label={`${label}: ${value}. ${actionLabel}.`}
        className={disabled ? `${className} pointer-events-none` : className}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={props.onClick}
      aria-label={`${label}: ${value}. ${actionLabel}.`}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}

// Lets a mouse user click-and-drag anywhere on a horizontally scrolling row
// to pan it, like a carousel — `overflow-x-auto` alone only responds to the
// scrollbar or a trackpad/shift+wheel gesture, not a click-drag. Touch
// pointers are left alone (native touch scrolling already handles them);
// intercepting those too would fight the browser's own momentum scrolling.
// A drag past the threshold also suppresses the click it ends on, so
// dragging across a card doesn't trigger its link/button.
function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ dragging: false, moved: false, startX: 0, startScrollLeft: 0 });
  // 0–1 how far scrolled; drives the dot-pagination indicator below the row.
  const [progress, setProgress] = useState(0);

  function measureProgress() {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, el.scrollLeft / max)));
  }

  function onPointerDown(e: React.PointerEvent<T>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    state.current = { dragging: true, moved: false, startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<T>) {
    const el = ref.current;
    if (!el || !state.current.dragging) return;
    const dx = e.clientX - state.current.startX;
    if (Math.abs(dx) > 4) state.current.moved = true;
    el.scrollLeft = state.current.startScrollLeft - dx;
    measureProgress();
  }

  function onPointerUp(e: React.PointerEvent<T>) {
    const el = ref.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    state.current.dragging = false;
  }

  function onClickCapture(e: React.MouseEvent<T>) {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      state.current.moved = false;
    }
  }

  return {
    ref,
    progress,
    className: "cursor-grab select-none active:cursor-grabbing",
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClickCapture,
    onScroll: measureProgress,
  };
}

// The dot-pagination strip under a drag-scrollable row — a fixed number of
// dots standing in for scroll position (not one dot per item, which would
// be unreadable for a row of 11 cards): the dot matching how far through
// `progress` (0–1) the scroll is stretches into the active pill.
function ScrollDots({ progress, count = 3 }: { progress: number; count?: number }) {
  const active = Math.min(count - 1, Math.round(progress * (count - 1)));
  return (
    <div className="flex items-center justify-center gap-[6px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-[8px] rounded-full transition-all ${
            i === active ? "w-[24px] bg-brand-teal-dark" : "w-[8px] bg-[#E5E8ED]"
          }`}
        />
      ))}
    </div>
  );
}

const OVERVIEW_HIDDEN_TILES_KEY = "jobgiga:employerOverviewHiddenTiles";
const OVERVIEW_ORDER_KEY = "jobgiga:employerOverviewTileOrder";

function SlidersIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M1.5 4h5M9 4h3.5M1.5 10h3M7 10h5.5M6.5 2.3v3.4M9.5 8.3v3.4" />
    </svg>
  );
}


function ApplicantAvatar({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#E6F9FA] text-brand-teal-dark">
        <UserIcon className="h-[14px] w-[14px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />;
}

function formatScheduledAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    // Pinned so this renders identically on the server (SSR) and client —
    // otherwise it's the same hydration-mismatch class as
    // InterviewCountdown's Date.now() bug, just triggered by the server
    // process's timezone differing from the browser's instead of elapsed
    // time. See the matching note in EmployerInterviewsView.tsx.
    timeZone: "UTC",
  });
}

export default function EmployerDashboardOverview({
  data,
  initialSmartMatchEnabled,
  initialCriteria,
}: {
  data: DashboardData;
  initialSmartMatchEnabled: boolean;
  initialCriteria: CriteriaFlags;
}) {
  // Same scoring "Top Matches"/the per-posting applicant list use, fetched
  // once here so "Recent applicants" can show the same score badge without
  // making the employer visit either of those pages first. Declared above
  // the no-postings early return below so hook order stays stable across
  // renders regardless of data.hasPostings.
  const [matchByApplicationId, setMatchByApplicationId] = useState<Record<string, MatchResult>>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/employer/applicants/matches")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { results: MatchResult[] } | null) => {
        if (cancelled || !data) return;
        const byId: Record<string, MatchResult> = {};
        for (const result of data.results) byId[result.applicationId] = result;
        setMatchByApplicationId(byId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const overviewDrag = useDragScroll<HTMLDivElement>();

  // Which Overview tiles the employer has hidden, per browser — loaded after
  // mount (not during the initial render) so server and client agree on the
  // first paint; it then flips to whatever was saved, same as any other
  // client-only preference.
  const [hiddenTileIds, setHiddenTileIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OVERVIEW_HIDDEN_TILES_KEY);
      // One-time client-only read on mount (localStorage isn't available
      // during SSR), not a reaction to a dependency change — no cascading
      // render risk despite the rule's generic warning.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHiddenTileIds(JSON.parse(raw));
    } catch {
      // Storage unavailable/corrupt — just show every tile.
    }
  }, []);

  function toggleTileHidden(id: string) {
    setHiddenTileIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(OVERVIEW_HIDDEN_TILES_KEY, JSON.stringify(next));
      } catch {
        // Won't persist past a reload, but still reflects locally.
      }
      return next;
    });
  }

  // The employer's custom tile order, as a list of ids — same load-after-
  // mount reasoning as hiddenTileIds above. `null` until loaded (or if
  // nothing was ever saved) means "use statTiles' own declared order".
  const [tileOrder, setTileOrder] = useState<string[] | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OVERVIEW_ORDER_KEY);
      // Same one-time client-only read on mount as hiddenTileIds above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setTileOrder(JSON.parse(raw));
    } catch {
      // Storage unavailable/corrupt — fall back to declared order.
    }
  }, []);

  function reorderTiles(draggedId: string, targetId: string) {
    setTileOrder((prev) => {
      const base = prev ?? statTiles.map((t) => t.id);
      const current = base.filter((id) => id !== draggedId);
      const targetIndex = current.indexOf(targetId);
      current.splice(targetIndex, 0, draggedId);
      try {
        localStorage.setItem(OVERVIEW_ORDER_KEY, JSON.stringify(current));
      } catch {
        // Won't persist past a reload, but still reflects locally.
      }
      return current;
    });
  }

  // Clears both saved preferences, back to statTiles' own declared order
  // with nothing hidden.
  function resetOverviewLayout() {
    setHiddenTileIds([]);
    setTileOrder(null);
    try {
      localStorage.removeItem(OVERVIEW_HIDDEN_TILES_KEY);
      localStorage.removeItem(OVERVIEW_ORDER_KEY);
    } catch {
      // Nothing left to clean up locally either way.
    }
  }

  // Whether the Overview row is in "arrange" mode — swaps the horizontal
  // scroll strip for a wrapping grid of every tile (hidden ones included,
  // dimmed) so the employer can drag actual cards into place and tap
  // X/+ to hide/restore them, instead of a separate abstracted list.
  const [editingOverview, setEditingOverview] = useState(false);
  const [dragTileId, setDragTileId] = useState<string | null>(null);

  const maxFunnelCount = Math.max(1, ...data.funnel.map((f) => f.count));
  const maxHiringCount = Math.max(1, ...data.hiringTrend.map((h) => h.hires));

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const statTiles: (StatTileProps & { id: string; label: string })[] = [
    {
      id: "active-postings",
      label: "Postings",
      value: data.stats.activePostings,
      sublabel: "Active postings",
      sublabelColorClass: "text-[#0B6E63]",
      actionLabel: "See performance by posting",
      icon: BriefcaseIcon,
      gradient: "#8CE6D9",
      onClick: () => scrollToSection("posting-performance"),
    },
    {
      id: "total-applicants",
      label: "Applicants",
      value: data.stats.totalApplicants,
      sublabel: "Total applicants",
      sublabelColorClass: "text-[#4B5468]",
      actionLabel: "See all applicants",
      icon: UsersIcon,
      gradient: "#BBC3D2",
      onClick: () => scrollToSection("recent-applicants"),
    },
    {
      id: "interviews-this-week",
      label: "Interviews",
      value: data.stats.interviewsThisWeek,
      sublabel: "Interviews this week",
      sublabelColorClass: "text-[#7C5CD1]",
      actionLabel: "See interview schedule",
      icon: CalendarIcon,
      gradient: "#C7CBF7",
      onClick: () => scrollToSection("upcoming-interviews"),
    },
    {
      id: "needs-evaluation",
      label: "Evaluations",
      value: data.stats.needsEvaluation,
      sublabel: "Interviews awaiting your evaluation",
      sublabelColorClass: "text-[#B06A2A]",
      actionLabel: "Score and decide next step",
      icon: PencilIcon,
      gradient: "#FFCFA3",
      href: "/employer/applicants",
    },
    {
      id: "reschedule-requests",
      label: "Reschedules",
      value: data.stats.rescheduleRequests,
      sublabel: "Candidates asking to reschedule",
      sublabelColorClass: "text-[#C2600A]",
      actionLabel: "Pick a new time",
      icon: CalendarIcon,
      gradient: "#FFCDA1",
      href: "/employer/interviews",
    },
    {
      id: "postings-needing-attention",
      label: "Postings",
      value: data.stats.postingsNeedingAttention,
      sublabel: "Rejected or flagged — needs edits",
      sublabelColorClass: "text-red-500",
      actionLabel: "Review and resubmit",
      icon: FlagIcon,
      gradient: "#F9B9B9",
      href: "/employer/jobs",
    },
    {
      id: "no-shows",
      label: "No-shows",
      value: data.stats.noShows,
      sublabel: "Skipped their scheduled interview",
      sublabelColorClass: "text-[#4B5468]",
      actionLabel: "Reschedule or move on",
      icon: XCircleIcon,
      gradient: "#D4D7DC",
      href: "/employer/interviews",
    },
    {
      id: "new-applicants",
      label: "New applicants",
      value: data.stats.newApplicants,
      sublabel: "Not yet screened",
      sublabelColorClass: "text-[#4B5468]",
      actionLabel: "Review new applicants",
      icon: StackIcon,
      gradient: "#C9CFDA",
      href: "/employer/applicants",
    },
    {
      id: "kiv",
      label: "KIV",
      value: data.stats.kiv,
      sublabel: "Parked — worth a second look",
      sublabelColorClass: "text-[#5566B0]",
      actionLabel: "Revisit these candidates",
      icon: ClockIcon,
      gradient: "#B9C3F9",
      href: "/employer/applicants",
    },
    {
      id: "stale-offers",
      label: "Stale offers",
      value: data.stats.staleOffers,
      sublabel: "Extended 3+ days ago, no response",
      sublabelColorClass: "text-[#B06A2A]",
      actionLabel: "Follow up with candidate",
      icon: DraftIcon,
      gradient: "#FFCDA1",
      href: "/employer/applicants",
    },
    {
      id: "interviewed-not-evaluated",
      label: "Interviewed",
      value: data.stats.interviewedNotEvaluated,
      sublabel: "Done interviewing — not yet evaluated",
      sublabelColorClass: "text-[#3B6FBF]",
      actionLabel: "Start the evaluation",
      icon: CheckCircleIcon,
      gradient: "#A5C6F7",
      href: "/employer/applicants",
    },
  ];

  // Tiles in the employer's saved order, falling back to declaration order
  // for any id that order doesn't mention — covers both "nothing saved yet"
  // and a newly added tile that predates whatever was saved.
  const orderedTiles = tileOrder
    ? [...statTiles].sort((a, b) => {
        const ai = tileOrder.indexOf(a.id);
        const bi = tileOrder.indexOf(b.id);
        return (ai === -1 ? tileOrder.length : ai) - (bi === -1 ? tileOrder.length : bi);
      })
    : statTiles;
  const visibleTiles = orderedTiles.filter((tile) => !hiddenTileIds.includes(tile.id));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[20px]">
      {!data.hasPostings && (
        <div className={gradientFrameClass("teal")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <p className="text-sm text-[#141B2E]">Get started</p>
            <p className="mt-[6px] text-xs text-[#4B5468]">
              You haven&rsquo;t posted a job yet — once you do, everything below fills in with real applicants,
              interviews, and match insights. Here&rsquo;s a preview of what this page looks like.
            </p>
          </div>
        </div>
      )}

      <div className={gradientFrameClass("teal")}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
          <div className="flex items-center justify-between gap-[8px]">
            <p className="text-sm text-[#141B2E]">Overview</p>
            <div className="flex items-center gap-[8px]">
              {editingOverview && (
                <button
                  type="button"
                  onClick={resetOverviewLayout}
                  className="rounded-full border border-[#EAEDF2] px-[12px] py-[6px] text-xs text-[#4B5468] hover:bg-[#F8FAFB]"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingOverview((v) => !v)}
                className={`flex items-center gap-[6px] rounded-full px-[12px] py-[6px] text-xs transition-colors ${
                  editingOverview
                    ? "bg-brand-teal-dark text-white hover:opacity-90"
                    : "border border-[#EAEDF2] text-[#4B5468] hover:bg-[#F8FAFB]"
                }`}
              >
                {editingOverview ? (
                  "Done"
                ) : (
                  <>
                    <SlidersIcon className="h-[12px] w-[12px]" />
                    Arrange
                  </>
                )}
              </button>
            </div>
          </div>

          {editingOverview ? (
            <div className="scrollbar-hide -mx-[22px] -my-[14px] overflow-x-auto px-[22px] py-[14px]">
            <div className="flex w-max gap-[12px]">
              {orderedTiles.map((tile) => {
                const hidden = hiddenTileIds.includes(tile.id);
                return (
                  <div
                    key={tile.id}
                    draggable
                    onDragStart={(e) => {
                      setDragTileId(tile.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragTileId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragTileId && dragTileId !== tile.id) reorderTiles(dragTileId, tile.id);
                      setDragTileId(null);
                    }}
                    className={`relative w-[220px] shrink-0 cursor-grab active:cursor-grabbing ${
                      dragTileId === tile.id ? "opacity-30" : ""
                    }`}
                  >
                    <div
                      className={`pointer-events-none transition-all ${hidden ? "opacity-40 grayscale" : ""}`}
                    >
                      <StatTile {...tile} />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTileHidden(tile.id)}
                      aria-label={hidden ? `Show ${tile.label}` : `Hide ${tile.label}`}
                      className="absolute -top-[8px] -right-[8px] z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#EAEDF2] bg-white text-[#4B5468] shadow-[0_2px_6px_rgba(0,0,0,0.12)] hover:bg-[#F8FAFB]"
                    >
                      {hidden ? (
                        <PlusIcon className="h-[11px] w-[11px]" />
                      ) : (
                        <XIcon className="h-[11px] w-[11px]" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            </div>
          ) : visibleTiles.length === 0 ? (
            <EmptyRow>Every tile is hidden — tap Arrange above to bring some back.</EmptyRow>
          ) : (
            <>
              {/* eslint-disable react-hooks/refs -- useDragScroll returns its
                  ref bundled with plain event-handler functions and a
                  progress value; the handlers only read ref.current when an
                  actual pointer/scroll event fires them, never during this
                  render, so the rule's static "ref access during render"
                  check is a false positive here. */}
              <div
                ref={overviewDrag.ref}
                onPointerDown={overviewDrag.onPointerDown}
                onPointerMove={overviewDrag.onPointerMove}
                onPointerUp={overviewDrag.onPointerUp}
                onPointerCancel={overviewDrag.onPointerCancel}
                onClickCapture={overviewDrag.onClickCapture}
                onScroll={overviewDrag.onScroll}
                className={`scrollbar-hide -mx-[22px] -my-[4px] overflow-x-auto px-[22px] py-[4px] ${overviewDrag.className}`}
              >
                <div className="flex w-max gap-[12px]">
                  {visibleTiles.map((tile) => (
                    <div key={tile.id} className="w-[220px] shrink-0">
                      <StatTile {...tile} />
                    </div>
                  ))}
                </div>
              </div>
              <ScrollDots progress={overviewDrag.progress} />
              {/* eslint-enable react-hooks/refs */}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
        <div id="upcoming-interviews" className="scroll-mt-[100px]">
        <SectionCard title="Upcoming interviews" viewAllHref="/employer/interviews">
          {data.upcomingInterviews.length === 0 ? (
            <EmptyRow>No interviews scheduled yet.</EmptyRow>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {data.upcomingInterviews.map((interview) => (
                <div
                  key={interview.applicationId}
                  className="flex flex-col gap-[8px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                >
                  <div className="flex items-center gap-[8px]">
                    <ApplicantAvatar url={interview.applicantAvatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-[#141B2E]">{interview.applicantName}</p>
                      <p className="mt-[1px] truncate text-xs text-[#9AA3B2]">{interview.jobPostingTitle}</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-x-[10px] gap-y-[2px] rounded-[10px] bg-[#F1ECFB] px-[10px] py-[6px]">
                    <p className="flex shrink-0 items-center gap-[6px] text-xs text-[#7C5CD1]">
                      <CalendarIcon className="h-[12px] w-[12px]" />
                      Round {interview.round} · {INTERVIEW_MODE_LABEL[interview.mode]}
                    </p>
                    <p className="shrink-0 text-xs text-[#4B5468]">
                      {formatScheduledAt(interview.scheduledAt)}
                      {interview.durationMinutes ? ` · ${interview.durationMinutes} min` : ""}
                    </p>
                    <InterviewCountdown scheduledAt={interview.scheduledAt} className="shrink-0 text-xs text-[#7C5CD1]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        </div>

        <SectionCard title="Top Matches">
          <TopMatchesCard initialEnabled={initialSmartMatchEnabled} initialCriteria={initialCriteria} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
        <div id="recent-applicants" className="scroll-mt-[100px]">
        <SectionCard title="Recent applicants" viewAllHref="/employer/applicants">
          {data.recentApplicants.length === 0 ? (
            <EmptyRow>No applicants yet — once candidates apply, they&rsquo;ll show up here.</EmptyRow>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {data.recentApplicants.map((applicant) => {
                const color = APPLICATION_STATUS_COLOR[applicant.status] ?? APPLICATION_STATUS_COLOR.applied;
                const match = matchByApplicationId[applicant.applicationId];
                const band = match ? matchBand(match.score) : null;
                return (
                  <div
                    key={applicant.applicationId}
                    className="flex items-center gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                  >
                    <ApplicantAvatar url={applicant.applicantAvatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-[#141B2E]">{applicant.applicantName}</p>
                      <p className="mt-[1px] flex flex-wrap items-center gap-x-[6px] truncate text-xs text-[#9AA3B2]">
                        <span>{applicant.jobPostingTitle}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{relativeTimeAgo(applicant.appliedAt)}</span>
                      </p>
                    </div>
                    {band && match && (
                      <span className={`shrink-0 rounded-full px-[9px] py-[3px] text-xs ${band.bg} ${band.text}`}>
                        {match.score}% match
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full px-[9px] py-[3px] text-xs ${color.bg} ${color.text}`}
                    >
                      {APPLICATION_STATUS_LABEL[applicant.status] ?? applicant.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        </div>

        <SectionCard title="Where your applicants currently stand">
          <div className="flex flex-col gap-[8px]">
            {data.funnel.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-[10px]">
                <span className="w-[110px] shrink-0 text-xs text-[#4B5468]">
                  {APPLICATION_STATUS_LABEL[stage.stage] ?? stage.stage}
                </span>
                <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-[#F1F4F8]">
                  <div
                    className="h-full rounded-full bg-brand-teal-dark"
                    style={{ width: `${(stage.count / maxFunnelCount) * 100}%` }}
                  />
                </div>
                <span className="w-[20px] shrink-0 text-right text-xs text-[#141B2E]">
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#9AA3B2]">
            Snapshot of where every current applicant sits right now — not a conversion funnel, since an applicant
            only has one status at a time.
          </p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
        <div id="posting-performance" className="scroll-mt-[100px]">
        <SectionCard title="Per-posting performance" viewAllHref="/employer/jobs">
          {data.postingPerformance.length === 0 ? (
            <EmptyRow>No postings yet — views and applicant counts per posting will show up here.</EmptyRow>
          ) : (
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
            {data.postingPerformance.map((posting) => (
              <Link
                key={posting.id}
                href={`/employer/jobs?id=${posting.id}`}
                className="flex flex-col gap-[8px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] transition-colors hover:border-brand-teal-dark"
              >
                <div className="flex flex-wrap items-center gap-[6px]">
                  <p className="truncate text-xs text-[#141B2E]">{posting.title}</p>
                  {POSTING_STATUS_PILL[posting.status] && (
                    <span
                      className={`rounded-full px-[10px] py-[3px] text-xs ${POSTING_STATUS_PILL[posting.status].bg} ${POSTING_STATUS_PILL[posting.status].text}`}
                    >
                      {POSTING_STATUS_PILL[posting.status].label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                  <span className="flex items-center gap-[4px]">
                    <EyeIcon className="h-[13px] w-[13px] text-[#9AA3B2]" />
                    {posting.viewCount}
                  </span>
                  <span className="text-[#C7CDD7]">·</span>
                  <span className="flex items-center gap-[4px]">
                    <UsersIcon className="h-[13px] w-[13px] text-[#9AA3B2]" />
                    {posting.applicantCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          )}
        </SectionCard>
        </div>

        <SectionCard title="Hiring trend">
          {data.avgTimeToHireDays === null ? (
            <EmptyRow>No hires yet — trend and time-to-hire will show up here once you hire someone.</EmptyRow>
          ) : (
            <>
              <div className="flex items-end justify-between gap-[6px]">
                {data.hiringTrend.map((month) => (
                  <div key={month.monthLabel} className="flex flex-1 flex-col items-center gap-[4px]">
                    <div className="flex h-[80px] w-full items-end">
                      <div
                        className="w-full rounded-t-[6px] bg-brand-teal-dark"
                        style={{ height: `${Math.max(4, (month.hires / maxHiringCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#9AA3B2]">{month.monthLabel}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-[6px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]">
                <ClockIcon className="h-[14px] w-[14px] text-[#9AA3B2]" />
                <span className="text-xs text-[#4B5468]">
                  Average time to hire: {data.avgTimeToHireDays} day{data.avgTimeToHireDays === 1 ? "" : "s"}
                  <span className="ml-[4px] font-normal text-[#9AA3B2]">(estimated)</span>
                </span>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

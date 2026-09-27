"use client";

import { useEffect, useState } from "react";
import EmployerDashboardShell from "./EmployerDashboardShell";
import SiriOrb from "./SiriOrb";
import { gradientFrameClass } from "./formStyles";
import { CheckIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

export type PosterPosting = {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  salaryMin: number;
  salaryMax: number;
  minYearsExperience: number;
  openings: number;
  posterUrl: string | null;
  posterGeneratingSince: string | null;
};

type PosterHistoryItem = {
  id: string;
  posterUrl: string;
  style: string;
  createdAt: string;
};

// Mirrors POSTER_STYLES in @/lib/poster-content — kept as a separate
// client-side list rather than importing it, since that module pulls in
// server-only modules (db, session) that can't ship to the browser.
const POSTER_STYLE_OPTIONS = [
  {
    key: "playful",
    label: "Playful & Approachable",
    description: "Sticky note, pushpin, warm & friendly",
    swatch: "linear-gradient(135deg, #BEE3F8, #FFFFFF)",
  },
  {
    key: "photo_corporate",
    label: "Corporate with Photo",
    description: "Real photo, your logo, clean & professional",
    swatch: "linear-gradient(135deg, #141B2E, #1FA6C9)",
  },
] as const;
type PosterStyleKey = (typeof POSTER_STYLE_OPTIONS)[number]["key"];

// Purely cosmetic — real generation time varies with the API, so this only
// rotates the status message text while polling; it isn't used to decide
// when the poster is actually done (the /poster/status poll is).
const POSTER_GENERATING_MESSAGES = [
  { atSeconds: 0, label: "Reading the posting…" },
  { atSeconds: 8, label: "Sketching the layout…" },
  { atSeconds: 20, label: "Generating the poster…" },
  { atSeconds: 45, label: "Almost ready…" },
];

const POSTER_POLL_INTERVAL_MS = 4000;

function PosterGeneratorCard({ postings: initialPostings }: { postings: PosterPosting[] }) {
  const [postings, setPostings] = useState(initialPostings);
  const [selectedId, setSelectedId] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<PosterStyleKey>("playful");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [history, setHistory] = useState<PosterHistoryItem[]>([]);
  // Which poster is being previewed, scoped to the posting it belongs to —
  // storing the postingId alongside the url means switching postings (or a
  // fresh generation replacing the latest url) naturally invalidates it
  // without needing an effect to reset it back to null.
  const [viewedPoster, setViewedPoster] = useState<{ postingId: string; url: string } | null>(null);

  const selected = postings.find((p) => p.id === selectedId) ?? null;
  // Source of truth for "is anything generating" — a real field on the
  // posting (set by the /poster/start API), not local component state, so
  // it's correct even on a fresh page load after navigating away and back.
  const generatingPosting = postings.find((p) => p.posterGeneratingSince) ?? null;

  // While a posting is generating: ticks `nowMs` every second (for the
  // elapsed-time display/status message) and polls the real generation
  // status every POSTER_POLL_INTERVAL_MS — the image is produced
  // asynchronously by icreat.ai, so there's no client-side moment to detect
  // completion other than asking the server. Runs an immediate poll on
  // mount/id-change too, so a task that already finished while the user was
  // away resolves right away instead of waiting a full interval.
  useEffect(() => {
    if (!generatingPosting) return;
    const posting = generatingPosting;
    let cancelled = false;

    function poll() {
      fetch(`/api/employer/job-postings/${posting.id}/poster/status`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.generating) {
            setPostings((prev) =>
              prev.map((p) =>
                p.id === posting.id ? { ...p, posterUrl: data.posterUrl ?? null, posterGeneratingSince: null } : p,
              ),
            );
            if (!data.posterUrl && data.error) setStartError(data.error);
          }
        })
        .catch(() => {
          // Transient network error — the next interval tick will retry.
        });
    }

    poll();
    const tickInterval = setInterval(() => setNowMs(Date.now()), 1000);
    const pollInterval = setInterval(poll, POSTER_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(tickInterval);
      clearInterval(pollInterval);
    };
    // Deliberately keyed on the id alone — restarting the interval whenever
    // the postings array gets a new object reference (e.g. after this same
    // posting's fields update) would reset needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatingPosting?.id]);

  // Loads this posting's poster history whenever the selection changes or a
  // new poster finishes generating (selected.posterUrl changing is how we
  // detect that).
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/employer/job-postings/${selectedId}/poster/history`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHistory(data.posters ?? []);
      })
      .catch(() => {
        // Leave the last-known history in place on a transient error.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, selected?.posterUrl]);

  async function generate() {
    if (!selected || generatingPosting || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${selected.id}/poster/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: selectedStyle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error ?? "Couldn't start generating.");
        return;
      }
      setPostings((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, posterGeneratingSince: data.posting.posterGeneratingSince, posterUrl: null } : p,
        ),
      );
      setNowMs(Date.now());
    } catch {
      setStartError("Couldn't start generating — check your connection.");
    } finally {
      setStarting(false);
    }
  }

  function download(posting: PosterPosting, url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${posting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-poster.png`;
    link.click();
  }

  const elapsedSeconds =
    selected?.posterGeneratingSince && selected.id === generatingPosting?.id
      ? Math.floor((nowMs - new Date(selected.posterGeneratingSince).getTime()) / 1000)
      : 0;
  const message =
    [...POSTER_GENERATING_MESSAGES].reverse().find((m) => elapsedSeconds >= m.atSeconds)?.label ??
    POSTER_GENERATING_MESSAGES[0].label;

  return (
    <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start">
      <div className={`animate-fade-in-up min-w-0 lg:flex-[3] ${gradientFrameClass("teal")}`}>
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="text-sm text-[#141B2E]">Job posting</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            Pick which active posting to generate a poster for — only one can generate at a time, but
            you can browse or check on a previous poster while it runs.
          </p>

          {postings.length === 0 ? (
            <p className="mt-[16px] rounded-[12px] bg-[#F8FAFB] p-[14px] text-xs text-[#9AA3B2]">
              You don&rsquo;t have any active job postings yet. Once one goes live, you can generate a
              poster for it here.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Job posting" className="mt-[16px] flex flex-col gap-[6px]">
              {postings.map((p) => {
                const isGenerating = p.id === generatingPosting?.id;
                const isReady = !!p.posterUrl;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected?.id === p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-start justify-between gap-[8px] rounded-[12px] border px-[14px] py-[10px] text-left transition-colors ${
                      selected?.id === p.id
                        ? "border-brand-teal-dark bg-[#E6F9FA]"
                        : isReady
                          ? "border-[#B9EAC0] bg-[#F1FBF2] hover:bg-[#E7F8E9]"
                          : "border-black/[0.1] hover:bg-black/[0.03]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[6px]">
                        <p
                          className={`truncate text-sm ${
                            selected?.id === p.id ? "text-brand-teal-dark" : "text-[#141B2E]"
                          }`}
                        >
                          {p.title}
                        </p>
                        {isReady && (
                          <span className="flex shrink-0 items-center gap-[3px] rounded-full bg-[#E3F9E5] px-[8px] py-[1px] text-xs text-[#1F7A3F]">
                            <CheckIcon className="h-[9px] w-[9px]" />
                            Ready
                          </span>
                        )}
                        {isGenerating && (
                          <span className="flex shrink-0 items-center gap-[4px] rounded-full bg-[#F1F4F8] px-[8px] py-[1px] text-xs text-[#4B5468]">
                            <span className="h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-brand-teal-dark" />
                            Generating…
                          </span>
                        )}
                      </div>
                      <p className="mt-[2px] truncate text-xs text-[#9AA3B2]">{p.location}</p>
                      <p className="truncate text-xs text-[#9AA3B2]">
                        RM{p.salaryMin.toLocaleString()}–{p.salaryMax.toLocaleString()}
                      </p>
                    </div>
                    {selected?.id === p.id && (
                      <CheckIcon className="mt-[3px] h-[11px] w-[11px] shrink-0 text-brand-teal-dark" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`min-w-0 lg:sticky lg:top-[85px] lg:flex-[1] ${gradientFrameClass("teal")}`}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
          <div>
            <p className="text-sm text-[#141B2E]">Poster generator</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Turn the selected posting into a ready-to-share 9:16 recruitment flyer for
              Instagram Stories, WhatsApp Status, and more.
            </p>
          </div>

          {postings.length > 0 && selected && selected.id !== generatingPosting?.id && (
            <div role="radiogroup" aria-label="Poster style" className="flex flex-col gap-[6px]">
              {POSTER_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={selectedStyle === opt.key}
                  onClick={() => setSelectedStyle(opt.key)}
                  className={`flex items-center gap-[10px] rounded-[12px] border px-[10px] py-[8px] text-left transition-colors ${
                    selectedStyle === opt.key
                      ? "border-brand-teal-dark bg-[#E6F9FA]"
                      : "border-black/[0.1] hover:bg-black/[0.03]"
                  }`}
                >
                  <span
                    className="h-[28px] w-[28px] shrink-0 rounded-[8px]"
                    style={{ background: opt.swatch }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-xs ${selectedStyle === opt.key ? "text-brand-teal-dark" : "text-[#141B2E]"}`}
                    >
                      {opt.label}
                    </span>
                    <span className="block truncate text-[11px] text-[#9AA3B2]">{opt.description}</span>
                  </span>
                  {selectedStyle === opt.key && <CheckIcon className="h-[11px] w-[11px] shrink-0 text-brand-teal-dark" />}
                </button>
              ))}
            </div>
          )}

          {postings.length === 0 ? null : !selected ? (
            <p className="text-xs text-[#9AA3B2]">Select a job posting to get started.</p>
          ) : selected.id === generatingPosting?.id ? (
            <div className="flex flex-col items-center gap-[10px] rounded-[14px] bg-[#F8FAFB] p-[18px] text-center">
              <SiriOrb className="h-[22px] w-[22px]" active />
              <p className="text-xs text-[#141B2E]">{message}</p>
              {/* Indeterminate — real generation time isn't known in
                  advance, unlike the old fixed-delay fake progress bar. */}
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div className="poster-progress-indeterminate h-full w-1/3 rounded-full bg-brand-teal-dark" />
              </div>
              <p className="text-xs text-[#9AA3B2]">{elapsedSeconds}s elapsed</p>
              <p className="text-xs text-[#9AA3B2]">
                Feel free to leave this page — it&rsquo;ll be ready when you come back.
              </p>
            </div>
          ) : selected.posterUrl ? (
            <>
              {(() => {
                const displayedUrl =
                  viewedPoster?.postingId === selected.id ? viewedPoster.url : selected.posterUrl;
                const isLatest = displayedUrl === selected.posterUrl;
                return (
                  <>
                    <div className="overflow-hidden rounded-[14px] border border-[#EAEDF2]">
                      {/* next/image can't render a generated data: URI without extra config — a plain
                          <img> is the right tool for a client-only canvas export like this one. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayedUrl}
                        alt={`Poster for ${selected.title}`}
                        className="aspect-[9/16] w-full object-cover"
                      />
                    </div>
                    {!isLatest && (
                      <p className="text-xs text-[#9AA3B2]">
                        Viewing a previous poster.{" "}
                        <button
                          type="button"
                          onClick={() => setViewedPoster(null)}
                          className="text-brand-teal-dark underline underline-offset-2"
                        >
                          Back to latest
                        </button>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => download(selected, displayedUrl)}
                      className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90"
                    >
                      Download PNG
                    </button>
                  </>
                );
              })()}
              <button
                type="button"
                onClick={generate}
                disabled={!!generatingPosting || starting}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate another
              </button>

              {history.length > 1 && (
                <div>
                  <p className="text-xs text-[#9AA3B2]">History</p>
                  <div className="mt-[6px] flex gap-[8px] overflow-x-auto pb-[2px]">
                    {history.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setViewedPoster({ postingId: selected.id, url: h.posterUrl })}
                        className={`shrink-0 overflow-hidden rounded-[8px] border-2 transition-colors ${
                          (viewedPoster?.postingId === selected.id ? viewedPoster.url : selected.posterUrl) ===
                          h.posterUrl
                            ? "border-brand-teal-dark"
                            : "border-transparent hover:border-black/[0.1]"
                        }`}
                        title={new Date(h.createdAt).toLocaleString()}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={h.posterUrl} alt="" className="aspect-[9/16] h-[70px] object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={generate}
                disabled={!!generatingPosting || starting}
                className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? "Starting…" : "Generate poster"}
              </button>
              <p className="text-xs text-[#9AA3B2]">
                {generatingPosting
                  ? `Only one poster can generate at a time — "${generatingPosting.title}" is still working.`
                  : "Usually takes 1–2 minutes. You can leave this page while it works."}
              </p>
              {startError && <p className="text-xs text-red-500">{startError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PosterGeneratorView({
  authUser,
  postings,
}: {
  authUser: AuthUser;
  postings: PosterPosting[];
}) {
  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="jobs"
      heading="Poster generator"
      subheading="Turn an active posting into a ready-to-share social media poster."
    >
      <div className="mt-[16px]">
        <PosterGeneratorCard postings={postings} />
      </div>
    </EmployerDashboardShell>
  );
}

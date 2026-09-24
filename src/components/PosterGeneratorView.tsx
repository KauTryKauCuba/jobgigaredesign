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

const POSTER_WIDTH = 720;
const POSTER_HEIGHT = 1280;

// Fixed rather than randomized like the original inline version — a random
// per-run duration can't be recovered after a page reload without storing it
// separately, and the whole point of this rewrite is that "is it done yet"
// has to be computable purely from `posterGeneratingSince` + this constant,
// whether the tab stayed open or was reopened minutes later.
const POSTER_TARGET_MS = 90000;

const POSTER_GENERATING_MESSAGES = [
  { at: 0, label: "Reading the posting…" },
  { at: 0.25, label: "Laying out the poster…" },
  { at: 0.55, label: "Adding your branding…" },
  { at: 0.8, label: "Polishing the final details…" },
  { at: 0.95, label: "Almost ready…" },
];

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

function renderPosterCanvas(posting: PosterPosting): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 0, POSTER_HEIGHT);
  bg.addColorStop(0, "#008990");
  bg.addColorStop(1, "#07BCCA");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFE9A6";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("WE'RE HIRING", POSTER_WIDTH / 2, 130);

  const cardX = 48;
  const cardY = 200;
  const cardW = POSTER_WIDTH - cardX * 2;
  const cardH = POSTER_HEIGHT - cardY - 64;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(cardX, cardY, cardW, cardH, 28);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fill();

  ctx.fillStyle = "#141B2E";
  ctx.font = "700 52px system-ui, sans-serif";
  const titleBottomY = wrapCanvasText(ctx, posting.title, POSTER_WIDTH / 2, cardY + 100, cardW - 80, 60);

  ctx.strokeStyle = "#E6F9FA";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 60, titleBottomY + 50);
  ctx.lineTo(cardX + cardW - 60, titleBottomY + 50);
  ctx.stroke();

  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillStyle = "#008990";
  const detailLines = [
    posting.location,
    `${posting.employmentType} · ${posting.workArrangement}`,
    `RM${posting.salaryMin.toLocaleString()} – RM${posting.salaryMax.toLocaleString()} / month`,
    posting.minYearsExperience === 0 ? "No experience required" : `${posting.minYearsExperience}+ years experience`,
  ];
  let lineY = titleBottomY + 120;
  for (const line of detailLines) {
    ctx.fillText(line, POSTER_WIDTH / 2, lineY);
    lineY += 52;
  }

  ctx.fillStyle = "#9AA3B2";
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText(`${posting.openings} opening${posting.openings === 1 ? "" : "s"} available`, POSTER_WIDTH / 2, lineY + 20);

  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillStyle = "#008990";
  ctx.fillText("Apply now on JobGiga", POSTER_WIDTH / 2, cardY + cardH - 40);

  return canvas.toDataURL("image/png");
}

function PosterGeneratorCard({ postings: initialPostings }: { postings: PosterPosting[] }) {
  const [postings, setPostings] = useState(initialPostings);
  const [selectedId, setSelectedId] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const selected = postings.find((p) => p.id === selectedId) ?? null;
  // Source of truth for "is anything generating" — a real field on the
  // posting (set by the /poster/start API), not local component state, so
  // it's correct even on a fresh page load after navigating away and back.
  const generatingPosting = postings.find((p) => p.posterGeneratingSince) ?? null;

  // Ticks only while something is generating, purely to animate the progress
  // bar/elapsed counter — the actual "is it done" decision below is driven by
  // real timestamps, not by this interval having stayed alive.
  useEffect(() => {
    if (!generatingPosting) return;
    const interval = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(interval);
    // Deliberately keyed on the id alone — restarting the interval whenever
    // the postings array gets a new object reference (e.g. after this same
    // posting's fields update) would reset needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatingPosting?.id]);

  // Resolves a generating posting the moment enough wall-clock time has
  // passed — whether that's because this effect has been ticking the whole
  // time, or because the page just mounted and the delay already elapsed
  // while the user was elsewhere entirely.
  useEffect(() => {
    if (!generatingPosting?.posterGeneratingSince) return;
    if (finishingId === generatingPosting.id) return;
    const startedAt = new Date(generatingPosting.posterGeneratingSince).getTime();
    if (nowMs - startedAt < POSTER_TARGET_MS) return;

    const dataUrl = renderPosterCanvas(generatingPosting);
    if (!dataUrl) return;
    // Guards against this effect firing again (e.g. the next 250ms tick)
    // before the fetch below resolves — not a reaction to a value changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFinishingId(generatingPosting.id);
    fetch(`/api/employer/job-postings/${generatingPosting.id}/poster/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posterUrl: dataUrl }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setPostings((prev) =>
          prev.map((p) => (p.id === generatingPosting.id ? { ...p, posterUrl: dataUrl, posterGeneratingSince: null } : p)),
        );
      })
      .finally(() => setFinishingId(null));
  }, [nowMs, generatingPosting, finishingId]);

  async function generate() {
    if (!selected || generatingPosting || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/employer/job-postings/${selected.id}/poster/start`, { method: "POST" });
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

  function download(posting: PosterPosting) {
    if (!posting.posterUrl) return;
    const link = document.createElement("a");
    link.href = posting.posterUrl;
    link.download = `${posting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-poster.png`;
    link.click();
  }

  const elapsedMs =
    selected?.posterGeneratingSince && selected.id === generatingPosting?.id
      ? nowMs - new Date(selected.posterGeneratingSince).getTime()
      : 0;
  const progress = Math.min(elapsedMs / POSTER_TARGET_MS, 0.99);
  const message =
    [...POSTER_GENERATING_MESSAGES].reverse().find((m) => progress >= m.at)?.label ??
    POSTER_GENERATING_MESSAGES[0].label;

  return (
    <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start">
      <div className={`min-w-0 lg:flex-[3] ${gradientFrameClass("teal")}`}>
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

      <div className={`lg:sticky lg:top-[85px] lg:flex-[1] ${gradientFrameClass("teal")}`}>
        <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[22px]">
          <div>
            <p className="text-sm text-[#141B2E]">Poster generator</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              Turn the selected posting into a ready-to-share 9:16 poster for Instagram Stories,
              WhatsApp Status, and more.
            </p>
          </div>

          {postings.length === 0 ? null : !selected ? (
            <p className="text-xs text-[#9AA3B2]">Select a job posting to get started.</p>
          ) : selected.id === generatingPosting?.id ? (
            <div className="flex flex-col items-center gap-[10px] rounded-[14px] bg-[#F8FAFB] p-[18px] text-center">
              <SiriOrb className="h-[22px] w-[22px]" active />
              <p className="text-xs text-[#141B2E]">{message}</p>
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full bg-brand-teal-dark transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[#9AA3B2]">{Math.round(elapsedMs / 1000)}s elapsed</p>
              <p className="text-xs text-[#9AA3B2]">
                Feel free to leave this page — it&rsquo;ll be ready when you come back.
              </p>
            </div>
          ) : selected.posterUrl ? (
            <>
              <div className="overflow-hidden rounded-[14px] border border-[#EAEDF2]">
                {/* next/image can't render a generated data: URI without extra config — a plain
                    <img> is the right tool for a client-only canvas export like this one. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.posterUrl}
                  alt={`Poster for ${selected.title}`}
                  className="aspect-[9/16] w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => download(selected)}
                className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark text-sm text-white transition-opacity hover:opacity-90"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={!!generatingPosting || starting}
                className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate another
              </button>
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

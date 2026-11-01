"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import SiriOrb from "./SiriOrb";
import { gradientFrameClass } from "./formStyles";
import { CheckIcon, CopyIcon, FileIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import { locateQuote, type PdfPageText } from "@/lib/pdf-highlights";
import {
  RESUME_REVIEW_DAILY_LIMIT,
  REVIEW_SCORE_LABEL,
  highlightColor,
  scoreBand,
  type ResumeReviewResult,
  type ReviewImprovement,
} from "@/lib/resume-review-shared";

type Review = { result: ResumeReviewResult; createdAt: string; forCurrentResume: boolean };

const card = "rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]";
const primaryBtn =
  "flex h-[38px] items-center justify-center rounded-full bg-brand-gold px-[18px] text-sm text-[#141B2E] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

// Shown one after another while the review runs, so the wait feels like progress.
const REVIEWING_STEPS = [
  "Reading your resume…",
  "Looking at it the way a recruiter would…",
  "Comparing it with jobs on JobGiga…",
  "Writing your suggestions…",
];

const PRIORITY: Record<ReviewImprovement["priority"], { label: string; className: string }> = {
  high: { label: "Start here", className: "bg-brand-gold-soft text-brand-gold-dark" },
  medium: { label: "Worth doing", className: "bg-[#F1F4F8] text-[#4B5468]" },
  low: { label: "Nice to have", className: "bg-[#F1F4F8] text-[#9AA3B2]" },
};

const BAND_COLOR = { great: "#2F9E56", good: "var(--color-brand-gold-dark)", work: "#C2600A" } as const;

function formatReviewed(iso: string) {
  return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ResumeReviewView({
  authUser,
  resume,
  resumeKind,
  resumeVersion,
  docxText,
  initialReview,
  initialUsedToday,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  resumeKind: "pdf" | "docx" | null;
  resumeVersion: string | null;
  docxText: string | null;
  initialReview: Review | null;
  initialUsedToday: number;
}) {
  const [review, setReview] = useState(initialReview);
  const [usedToday, setUsedToday] = useState(initialUsedToday);
  const [reviewing, setReviewing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"review" | "resume">("review");

  // A newly uploaded resume (the page refreshes with new props) makes the old review "for an earlier version".
  const [syncedReview, setSyncedReview] = useState(initialReview);
  if (initialReview !== syncedReview) {
    setSyncedReview(initialReview);
    setReview(initialReview);
  }

  useEffect(() => {
    if (!reviewing) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, REVIEWING_STEPS.length - 1)), 3500);
    return () => clearInterval(timer);
  }, [reviewing]);

  const hasResume = !!resume && !!resumeKind;
  const left = Math.max(0, RESUME_REVIEW_DAILY_LIMIT - usedToday);
  const current = review?.forCurrentResume ? review : null;

  // Suggestion ↔ highlight on the resume: which one is picked, and which were found on the page.
  const [activeSuggestion, setActiveSuggestion] = useState<number | null>(null);
  const [locatedIds, setLocatedIds] = useState<number[]>([]);
  const highlights = useMemo(
    () =>
      (current?.result.improvements ?? []).flatMap((item, id) => (item.quote ? [{ id, quote: item.quote }] : [])),
    [current],
  );

  /** From a suggestion card: show its line on the resume (switching to the resume tab on phones). */
  function showOnResume(id: number) {
    setActiveSuggestion(id);
    setMobileTab("resume");
  }

  /** From a highlight on the resume: bring its suggestion into view. */
  function showSuggestion(id: number) {
    setActiveSuggestion(id);
    setMobileTab("review");
    requestAnimationFrame(() =>
      document.getElementById(`suggestion-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  async function runReview() {
    setStep(0);
    setReviewing(true);
    setError(null);
    setMobileTab("review");
    try {
      const res = await fetch("/api/jobseeker/resume-review", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (typeof data?.usedToday === "number") setUsedToday(data.usedToday);
      if (!res.ok || !data?.result) throw new Error(data?.error ?? "Something went wrong. Please try again.");
      setReview({ result: data.result, createdAt: data.createdAt, forCurrentResume: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setReviewing(false);
    }
  }

  const reviewButton = (
    <button type="button" onClick={runReview} disabled={!hasResume || reviewing || left === 0} className={primaryBtn}>
      {reviewing ? "Reviewing…" : current ? "Review again" : "Review my resume"}
    </button>
  );

  const segment = (active: boolean) =>
    `flex-1 rounded-full px-[12px] py-[6px] text-xs transition-colors ${
      active ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
    }`;

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="resumeReview"
      heading="Resume Review"
      subheading="Friendly feedback on your resume — what's already working, and simple ways to make it stronger."
      resume={resume}
      headerAction={hasResume ? reviewButton : undefined}
    >
      {!hasResume ? (
        <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
          <div className={`${card} flex flex-col items-center gap-[10px] py-[36px] text-center`}>
            <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-brand-gold-soft text-brand-gold-dark">
              <FileIcon className="h-[20px] w-[20px]" />
            </span>
            {resume ? (
              // A name with no stored file — e.g. saved before uploads were kept on file.
              <>
                <h2 className="text-lg font-semibold text-[#141B2E]">Please upload your resume again</h2>
                <p className="max-w-[440px] text-sm leading-[20px] text-[#4B5468]">
                  We have the name of your resume (&ldquo;{resume.fileName}&rdquo;) but not the file itself, so there&rsquo;s nothing for us
                  to review yet. Upload it again using the &ldquo;Upload your resume&rdquo; card and we&rsquo;ll take a look.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-[#141B2E]">Upload your resume to get started</h2>
                <p className="max-w-[440px] text-sm leading-[20px] text-[#4B5468]">
                  Add your resume using the &ldquo;Upload your resume&rdquo; card, and we&rsquo;ll give you friendly, practical tips to help it
                  stand out to employers.
                </p>
              </>
            )}
            <p className="text-xs text-[#9AA3B2]">PDF or Word (.docx), up to 10 MB.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {/* Phones/tablets: the review and the resume as two tabs. Desktop: side by side. */}
          <div className="flex w-full max-w-[280px] rounded-full bg-[#F1F4F8] p-[4px] lg:hidden" role="tablist">
            <button type="button" role="tab" aria-selected={mobileTab === "review"} onClick={() => setMobileTab("review")} className={segment(mobileTab === "review")}>
              Review
            </button>
            <button type="button" role="tab" aria-selected={mobileTab === "resume"} onClick={() => setMobileTab("resume")} className={segment(mobileTab === "resume")}>
              My resume
            </button>
          </div>

          <div className="grid grid-cols-1 items-start gap-[20px] lg:grid-cols-2">
            {/* Sticky here, on the grid item itself — inside a wrapper of its own height it would have nowhere to stick. */}
            <div className={`lg:sticky lg:top-[85px] ${mobileTab === "resume" ? "" : "hidden lg:block"}`}>
              <ResumeViewer
                fileName={resume.fileName}
                kind={resumeKind}
                version={resumeVersion}
                docxText={docxText}
                highlights={reviewing ? [] : highlights}
                active={activeSuggestion}
                onSelect={showSuggestion}
                onLocated={setLocatedIds}
              />
            </div>

            <div className={`flex min-w-0 flex-col gap-[14px] ${mobileTab === "review" ? "" : "hidden lg:flex"}`}>
              {error && !reviewing && (
                <p role="alert" className="rounded-[12px] bg-red-50 px-[14px] py-[10px] text-sm leading-[20px] text-red-600">
                  {error}
                </p>
              )}

              {reviewing ? (
                <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
                  <div className={`${card} flex flex-col items-center gap-[12px] py-[40px] text-center`} aria-live="polite">
                    <SiriOrb className="h-[36px] w-[36px]" active />
                    <p className="text-sm text-[#141B2E]">{REVIEWING_STEPS[step]}</p>
                    <p className="text-xs text-[#9AA3B2]">This usually takes 10–30 seconds.</p>
                  </div>
                </div>
              ) : current ? (
                <ReviewResult
                  review={current}
                  left={left}
                  active={activeSuggestion}
                  locatedIds={resumeKind === "pdf" ? locatedIds : []}
                  onShow={showOnResume}
                />
              ) : (
                <ReviewIntro
                  outdated={!!review && !review.forCurrentResume}
                  left={left}
                  button={reviewButton}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </JobseekerDashboardShell>
  );
}

/** A suggestion's quoted line, to highlight on the resume — `id` is the suggestion's position in the list. */
type Highlight = { id: number; quote: string };

const viewerBox =
  "h-[70vh] min-h-[480px] w-full rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] lg:h-auto lg:min-h-0 lg:flex-1";

/**
 * The PDF drawn page by page as images — the browser's own PDF viewer puts a
 * dark frame around the page that a website can't restyle, and looks
 * different in every browser. Falls back to that viewer if drawing fails, so
 * the resume always shows.
 */
function PdfPages({
  src,
  fileName,
  highlights,
  active,
  onSelect,
  onLocated,
}: {
  src: string;
  fileName: string;
  highlights: Highlight[];
  active: number | null;
  onSelect: (id: number) => void;
  onLocated: (ids: number[]) => void;
}) {
  const [pages, setPages] = useState<{ image: string; text: PdfPageText }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, { getDocumentProxy, renderPageAsImage }] = await Promise.all([
          fetch(src).then((res) => {
            if (!res.ok) throw new Error("couldn't load");
            return res.arrayBuffer();
          }),
          import("unpdf"),
        ]);
        const pdf = await getDocumentProxy(new Uint8Array(data));
        const loaded: { image: string; text: PdfPageText }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          loaded.push({
            // 2x for a sharp page on high-density screens.
            image: await renderPageAsImage(pdf, i, { scale: 2, toDataURL: true }),
            text: {
              width: viewport.width,
              height: viewport.height,
              // Where each run of text sits, so a quoted line can be highlighted.
              items: content.items.flatMap((item) =>
                "str" in item && item.str
                  ? [
                      {
                        str: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width,
                        fontSize: Math.hypot(item.transform[2], item.transform[3]),
                      },
                    ]
                  : [],
              ),
              toViewport: (x, y) => viewport.convertToViewportPoint(x, y) as [number, number],
            },
          });
        }
        if (!cancelled) setPages(loaded);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Each suggestion's quoted line, found on the page it's on.
  const located = useMemo(() => {
    if (!pages) return [];
    const texts = pages.map((p) => p.text);
    return highlights.flatMap((h) => {
      const found = locateQuote(texts, h.quote);
      return found ? [{ ...h, ...found }] : [];
    });
  }, [pages, highlights]);

  const locatedKey = located.map((l) => l.id).join(",");
  useEffect(() => {
    if (pages) onLocated(locatedKey ? locatedKey.split(",").map(Number) : []);
    // Only when what's found changes — onLocated is a fresh function every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, locatedKey]);

  // Bring the chosen suggestion's highlight into view inside the panel.
  useEffect(() => {
    if (active === null || !scroller.current) return;
    const mark = scroller.current.querySelector<HTMLElement>(`[data-highlight="${active}"]`);
    if (!mark) return;
    const box = scroller.current.getBoundingClientRect();
    const markBox = mark.getBoundingClientRect();
    scroller.current.scrollBy({ top: markBox.top - box.top - box.height / 3, behavior: "smooth" });
  }, [active, located]);

  if (failed) {
    return (
      <iframe
        // Hides the browser PDF viewer's thumbnail strip and toolbar, so the page fills the space.
        src={`${src}#toolbar=0&navpanes=0&view=FitH`}
        title={`Your resume: ${fileName}`}
        className={viewerBox}
      />
    );
  }
  return (
    <div ref={scroller} className={`${viewerBox} overflow-y-auto p-[12px]`} aria-busy={!pages}>
      {pages ? (
        <div className="flex flex-col gap-[12px]">
          {pages.map((page, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.image}
                alt={i === 0 ? `Your resume: ${fileName}` : `Page ${i + 1}`}
                className="w-full rounded-[6px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_30px_-20px_rgba(20,27,46,0.35)]"
              />
              {located
                .filter((l) => l.page === i)
                .map((l) => {
                  const color = highlightColor(l.id);
                  const isActive = active === l.id;
                  const first = l.boxes[0];
                  return (
                    <div key={l.id} data-highlight={l.id}>
                      {l.boxes.map((b, j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => onSelect(l.id)}
                          aria-label={`Suggestion ${l.id + 1}`}
                          className="absolute cursor-pointer rounded-[2px] mix-blend-multiply transition-[box-shadow]"
                          style={{
                            left: `${b.left}%`,
                            top: `${b.top}%`,
                            width: `${b.width}%`,
                            height: `${b.height}%`,
                            background: color.fill,
                            boxShadow: isActive ? `0 0 0 2px ${color.edge}` : undefined,
                          }}
                        />
                      ))}
                      {/* Its number, in the margin just left of the line. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute flex h-[16px] w-[16px] -translate-x-[120%] items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ left: `${first.left}%`, top: `${first.top}%`, background: color.edge }}
                      >
                        {l.id + 1}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-[#9AA3B2]">Loading your resume…</div>
      )}
    </div>
  );
}

/** Their resume as uploaded: the PDF itself, or for Word files the text we read from it. */
function ResumeViewer({
  fileName,
  kind,
  version,
  docxText,
  highlights,
  active,
  onSelect,
  onLocated,
}: {
  fileName: string;
  kind: "pdf" | "docx" | null;
  version: string | null;
  docxText: string | null;
  highlights: Highlight[];
  active: number | null;
  onSelect: (id: number) => void;
  onLocated: (ids: number[]) => void;
}) {
  const src = `/api/jobseeker/resume-review/file?v=${encodeURIComponent(version ?? "")}`;
  return (
    // Sized to the window (85px sticky top + 20px bottom) so its bottom edge is never cut off.
    <div className="flex min-w-0 flex-col gap-[12px]">
      <div className={`animate-fade-in-up flex flex-col lg:h-[calc(100vh-105px)] ${gradientFrameClass("gold")}`}>
        <div className="flex min-h-0 flex-1 flex-col gap-[12px] rounded-[19px] bg-white p-[14px] text-left">
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-gold-soft text-brand-gold-dark">
              <FileIcon className="h-[14px] w-[14px]" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-[#141B2E]">{fileName}</p>
            {kind === "pdf" && (
              <a href={src} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-brand-gold-dark hover:underline">
                Open in new tab
              </a>
            )}
          </div>
          {kind === "pdf" ? (
            <PdfPages
              key={src}
              src={src}
              fileName={fileName}
              highlights={highlights}
              active={active}
              onSelect={onSelect}
              onLocated={onLocated}
            />
          ) : (
            <>
              <p className="rounded-[10px] bg-[#F8FAFB] px-[12px] py-[8px] text-xs text-[#4B5468]">
                Word files can&rsquo;t be shown here as they look, so this is the text we read from it — the same text employers&rsquo; hiring
                software sees.
              </p>
              <div className="h-[70vh] min-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] text-xs leading-[18px] text-[#141B2E] lg:h-auto lg:min-h-0 lg:flex-1">
                {docxText?.trim() || "We couldn't read any text from this file."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewIntro({ outdated, left, button }: { outdated: boolean; left: number; button: React.ReactNode }) {
  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
      <div className={`${card} flex flex-col gap-[14px]`}>
        {outdated && (
          <p className="rounded-[10px] border border-[#FBE7B5] bg-[#FFFBF0] px-[12px] py-[8px] text-xs text-[#8A6A1F]">
            You&rsquo;ve uploaded a new resume since your last review — review it again to get fresh feedback.
          </p>
        )}
        <div>
          <h2 className="text-lg font-semibold text-[#141B2E]">Get friendly feedback on your resume</h2>
          <p className="mt-[4px] text-sm leading-[20px] text-[#4B5468]">
            We&rsquo;ll read your resume the way a recruiter would and suggest simple changes — with example wording you can use.
          </p>
        </div>
        <ul className="flex flex-col gap-[8px]">
          {[
            ["A score with what's behind it", "How clear it is, how well it shows your impact, your skills, and more."],
            ["What's already working", "So you know what to keep."],
            ["Easy wins, most important first", "Each with a suggested rewrite you can copy."],
            ["Skills employers are asking for", "Compared with live jobs on JobGiga that suit you."],
          ].map(([title, detail]) => (
            <li key={title} className="flex gap-[10px]">
              <span className="mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-brand-gold-dark">
                <CheckIcon className="h-[8px] w-[8px] text-white" />
              </span>
              <span className="text-sm text-[#141B2E]">
                {title}
                <span className="block text-xs text-[#4B5468]">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-[12px] border-t border-black/[0.06] pt-[14px]">
          {button}
          <span className="text-xs text-[#9AA3B2]">
            {left > 0
              ? `${left} of ${RESUME_REVIEW_DAILY_LIMIT} reviews left today`
              : "You've used today's reviews — come back tomorrow."}
          </span>
        </div>
        <p className="text-xs text-[#9AA3B2]">Only you can see your review — employers never do.</p>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const band = scoreBand(score);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="#EAEDF2" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{ stroke: BAND_COLOR[band.tone] }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold text-[#141B2E]">{score}</span>
        <span className="text-[10px] text-[#9AA3B2]">out of 100</span>
      </span>
    </div>
  );
}

function SectionCard({ title, subtitle, children, delay }: { title: string; subtitle?: string; children: React.ReactNode; delay?: number }) {
  return (
    <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <div className={card}>
        <h2 className="text-sm font-semibold text-[#141B2E]">{title}</h2>
        {subtitle && <p className="mt-[2px] text-xs text-[#9AA3B2]">{subtitle}</p>}
        <div className="mt-[12px]">{children}</div>
      </div>
    </div>
  );
}

function ReviewResult({
  review,
  left,
  active,
  locatedIds,
  onShow,
}: {
  review: Review;
  left: number;
  active: number | null;
  /** Suggestions whose line was found on the resume (and so have a highlight to show). */
  locatedIds: number[];
  onShow: (id: number) => void;
}) {
  const { result } = review;
  const band = scoreBand(result.overall);
  const passed = result.checks.filter((c) => c.ok).length;

  return (
    <>
      {/* Overall */}
      <div className={`animate-fade-in-up ${gradientFrameClass("gold")}`}>
        <div className={card}>
          <div className="flex items-center gap-[16px]">
            <ScoreRing score={result.overall} />
            <div className="min-w-0">
              <p className="text-lg font-semibold" style={{ color: BAND_COLOR[band.tone] }}>
                {band.label}
              </p>
              <p className="mt-[4px] text-sm leading-[20px] text-[#4B5468]">{result.summary}</p>
            </div>
          </div>
          <ul className="mt-[16px] flex flex-col gap-[10px] border-t border-black/[0.06] pt-[14px]">
            {result.scores.map((s) => (
              <li key={s.key}>
                <div className="flex items-baseline justify-between gap-[8px] text-xs">
                  <span className="text-[#141B2E]">{REVIEW_SCORE_LABEL[s.key]}</span>
                  <span className="text-[#4B5468]">{s.score}</span>
                </div>
                <div className="mt-[4px] h-[6px] overflow-hidden rounded-full bg-[#F1F4F8]">
                  <div className="h-full rounded-full bg-brand-gold-dark" style={{ width: `${Math.max(s.score, 3)}%` }} />
                </div>
                {s.note && <p className="mt-[3px] text-xs text-[#9AA3B2]">{s.note}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-[14px] text-xs text-[#9AA3B2]">
            Reviewed {formatReviewed(review.createdAt)} ·{" "}
            {left > 0 ? `${left} of ${RESUME_REVIEW_DAILY_LIMIT} reviews left today` : "no reviews left today"}
          </p>
        </div>
      </div>

      {result.strengths.length > 0 && (
        <SectionCard title="What's already working" subtitle="Keep these — they're helping you." delay={60}>
          <ul className="flex flex-col gap-[10px]">
            {result.strengths.map((s) => (
              <li key={s.title} className="flex gap-[10px]">
                <span className="mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#2F9E56]">
                  <CheckIcon className="h-[8px] w-[8px] text-white" />
                </span>
                <span className="text-sm text-[#141B2E]">
                  {s.title}
                  <span className="block text-xs leading-[17px] text-[#4B5468]">{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title="Ways to make it stronger"
        subtitle="Most important first. Swap anything in [brackets] for your real details."
        delay={120}
      >
        <ul className="flex flex-col gap-[10px]">
          {result.improvements.map((item, i) => (
            <Improvement
              key={i}
              id={i}
              item={item}
              active={active === i}
              onResume={locatedIds.includes(i)}
              onShow={() => onShow(i)}
            />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Quick checks" subtitle={`${passed} of ${result.checks.length} looking good`} delay={180}>
        <ul className="flex flex-col gap-[8px]">
          {result.checks.map((c) => (
            <li key={c.key} className="flex gap-[10px]">
              <span
                className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
                  c.ok ? "bg-[#2F9E56]" : "bg-[#C2600A]"
                }`}
              >
                {c.ok ? <CheckIcon className="h-[8px] w-[8px] text-white" /> : <span className="text-[10px] font-semibold text-white">!</span>}
              </span>
              <span className="text-sm text-[#141B2E]">
                {c.label}
                <span className="block text-xs leading-[17px] text-[#4B5468]">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Skills employers are asking for"
        subtitle={
          result.skillGaps.jobsLookedAt > 0
            ? `From ${result.skillGaps.jobsLookedAt} live job${result.skillGaps.jobsLookedAt === 1 ? "" : "s"} on JobGiga that suit you`
            : undefined
        }
        delay={240}
      >
        {result.skillGaps.jobsLookedAt === 0 ? (
          <p className="text-sm text-[#4B5468]">
            We&rsquo;ll show this once there are live jobs on JobGiga that match your profile.
          </p>
        ) : result.skillGaps.skills.length === 0 ? (
          <p className="text-sm text-[#4B5468]">
            Nice — your resume already mentions the skills these jobs ask for.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-[6px]">
              {result.skillGaps.skills.map((s) => (
                <li key={s.skill} className="rounded-full bg-brand-gold-soft px-[10px] py-[4px] text-xs text-[#141B2E]">
                  {s.skill}
                  <span className="text-brand-gold-dark"> · {s.jobs} job{s.jobs === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-[10px] text-xs text-[#9AA3B2]">
              If you have any of these skills, mention them — only add what&rsquo;s true for you.
            </p>
          </>
        )}
      </SectionCard>

      {result.profileNotes.length > 0 && (
        <SectionCard title="Your profile and your resume" subtitle="Small differences between the two" delay={300}>
          <ul className="flex flex-col gap-[8px]">
            {result.profileNotes.map((note) => (
              <li key={note} className="rounded-[12px] bg-[#F8FAFB] px-[12px] py-[10px] text-sm leading-[20px] text-[#4B5468]">
                {note}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}

function Improvement({
  id,
  item,
  active,
  onResume,
  onShow,
}: {
  id: number;
  item: ReviewImprovement;
  active: boolean;
  /** Its quoted line was found on the resume, so it has a highlight there. */
  onResume: boolean;
  onShow: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const priority = PRIORITY[item.priority];
  const color = highlightColor(id);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(item.suggestion);
      ok = true;
    } catch {
      // The Clipboard API can be blocked (no window focus, older browsers) —
      // fall back to copying from a hidden text box.
      const box = document.createElement("textarea");
      box.value = item.suggestion;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      ok = document.execCommand("copy");
      box.remove();
    }
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <li
      id={`suggestion-${id}`}
      className="flex scroll-mt-[100px] flex-col gap-[8px] rounded-[14px] border bg-[#F8FAFB] p-[12px] transition-colors"
      // Outlined in its highlight colour while it's the one picked on the resume.
      style={{ borderColor: active ? color.edge : "#EAEDF2" }}
    >
      <div className="flex flex-wrap items-center gap-[6px]">
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: color.edge }}
        >
          {id + 1}
        </span>
        <span className={`rounded-full px-[8px] py-[2px] text-xs ${priority.className}`}>{priority.label}</span>
        <span className="text-xs text-[#9AA3B2]">{item.section}</span>
        {onResume && (
          <button type="button" onClick={onShow} className="ml-auto text-xs hover:underline" style={{ color: color.edge }}>
            Show on resume
          </button>
        )}
      </div>
      {item.quote && (
        <p
          className="rounded-[4px] py-[2px] pl-[10px] pr-[6px] text-xs italic leading-[17px] text-[#4B5468]"
          style={{ borderLeft: `2px solid ${color.edge}`, background: onResume ? color.fill : undefined }}
        >
          &ldquo;{item.quote}&rdquo;
        </p>
      )}
      <p className="text-sm leading-[20px] text-[#141B2E]">{item.issue}</p>
      <div className="rounded-[10px] border border-[#FBE7B5] bg-[#FFFBF0] px-[12px] py-[9px]">
        <div className="flex items-start gap-[8px]">
          <p className="min-w-0 flex-1 text-xs leading-[18px] text-[#5C4A12]">
            <span className="font-semibold">Try: </span>
            {item.suggestion}
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy suggestion"
            className="flex h-[26px] shrink-0 items-center gap-[4px] rounded-full bg-white px-[9px] text-xs text-brand-gold-dark shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-brand-gold-soft"
          >
            {copied ? <CheckIcon className="h-[10px] w-[10px]" /> : <CopyIcon className="h-[10px] w-[10px]" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </li>
  );
}

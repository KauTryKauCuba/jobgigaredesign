"use client";

import { useMemo, useRef, useState } from "react";
import { gradientFrameClass } from "./formStyles";
import { BriefcaseIcon, CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "./icons";
import type { MapSeeker, MatchMap, PairDetail, PostingMatchDetail, SeekerMatchView } from "@/lib/match-map";

// Jobseekers are compact one-line rows; jobs are taller cards placed beside
// their own group of jobseekers (see the layout in SuperadminMatchingView).
const SEEKER_ROW = 30;
const JOB_ROW = 46;
const PAD = 12;
// The strongest this many connected jobseekers are drawn at first — past
// that the map gets too tall to read; "Show all" lifts it.
const MAP_SEEKERS_DEFAULT = 40;
const THRESHOLDS = [40, 50, 60, 70, 80, 90];
const EXPLORER_PAGE = 30;

function Avatar({ seeker, size = 24 }: { seeker: Pick<MapSeeker, "name" | "avatarUrl">; size?: number }) {
  const style = { width: size, height: size };
  return seeker.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={seeker.avatarUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-[11px] font-semibold text-brand-teal-dark"
    >
      {seeker.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function humanizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function SuperadminMatchingView({ map }: { map: MatchMap }) {
  const hasSample = map.jobs.some((j) => j.sample) || map.seekers.some((s) => s.sample);
  // Sample data starts hidden only when there are real jobs to look at instead.
  const [hideSample, setHideSample] = useState(() => map.jobs.some((j) => !j.sample));
  const hiddenSampleJobs = hideSample ? map.jobs.filter((j) => j.sample).length : 0;
  const pendingJobs = map.pendingJobs.filter((j) => !(hideSample && j.sample));
  const [minScore, setMinScore] = useState(map.alertMinScore);
  const [hover, setHover] = useState<{ kind: "job" | "seeker"; id: string } | null>(null);
  const [showAllSeekers, setShowAllSeekers] = useState(false);

  // The explorer looks at one job (every jobseeker for it) or one jobseeker
  // (every job for them); `expanded` is the open row on the other side.
  const [selected, setSelected] = useState<{ kind: "job" | "seeker"; id: string } | null>(null);
  const [jobDetail, setJobDetail] = useState<PostingMatchDetail | null>(null);
  const [seekerDetail, setSeekerDetail] = useState<SeekerMatchView | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const explorerRef = useRef<HTMLDivElement>(null);

  // ---- The map ----------------------------------------------------------
  const view = useMemo(() => {
    const visibleJobs = map.jobs.filter((j) => !(hideSample && j.sample));
    const seekerById = new Map(map.seekers.map((s) => [s.id, s]));
    const jobIds = new Set(visibleJobs.map((j) => j.id));
    const edges = map.edges.filter((e) => {
      const seeker = seekerById.get(e.seeker);
      return e.score >= minScore && jobIds.has(e.job) && seeker && !(hideSample && seeker.sample);
    });

    // Each jobseeker's strongest connection decides which job's group they sit in.
    const best = new Map<string, { job: string; score: number }>();
    for (const e of edges) {
      const b = best.get(e.seeker);
      if (!b || e.score > b.score) best.set(e.seeker, { job: e.job, score: e.score });
    }
    const connected = [...best.keys()].sort((a, b) => best.get(b)!.score - best.get(a)!.score);
    const shown = new Set(showAllSeekers ? connected : connected.slice(0, MAP_SEEKERS_DEFAULT));
    const shownEdges = edges.filter((e) => shown.has(e.seeker));

    // Jobs with the most connections first; jobseekers grouped under their
    // strongest job in that order, strongest first within each group.
    // Counts every connection (the number on each job card), not just the ones drawn.
    const jobEdgeCount = new Map<string, number>();
    for (const e of edges) jobEdgeCount.set(e.job, (jobEdgeCount.get(e.job) ?? 0) + 1);
    const jobs = [...visibleJobs].sort((a, b) => (jobEdgeCount.get(b.id) ?? 0) - (jobEdgeCount.get(a.id) ?? 0));
    const jobOrder = new Map(jobs.map((j, i) => [j.id, i]));
    const seekers = [...shown]
      .map((id) => seekerById.get(id)!)
      .sort(
        (a, b) =>
          jobOrder.get(best.get(a.id)!.job)! - jobOrder.get(best.get(b.id)!.job)! ||
          best.get(b.id)!.score - best.get(a.id)!.score,
      );
    const seekerY = new Map(seekers.map((s, i) => [s.id, PAD + i * SEEKER_ROW + SEEKER_ROW / 2]));

    // Each job sits level with the middle of its own group, nudged apart so
    // cards never overlap and kept inside the map.
    const height = Math.max(seekers.length * SEEKER_ROW, jobs.length * JOB_ROW) + PAD * 2;
    const groupY = new Map<string, number[]>();
    for (const s of seekers) {
      const job = best.get(s.id)!.job;
      groupY.set(job, [...(groupY.get(job) ?? []), seekerY.get(s.id)!]);
    }
    const minY = PAD + JOB_ROW / 2;
    const maxY = height - PAD - JOB_ROW / 2;
    const ys = jobs.map((j, i) => {
      const group = groupY.get(j.id);
      return group ? group.reduce((sum, y) => sum + y, 0) / group.length : minY + i * JOB_ROW;
    });
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i === 0 ? minY : ys[i - 1] + JOB_ROW);
    for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? maxY : ys[i + 1] - JOB_ROW);
    const jobY = new Map(jobs.map((j, i) => [j.id, ys[i]]));

    return {
      jobs,
      seekers,
      edges: shownEdges,
      height,
      jobY,
      seekerY,
      jobEdgeCount,
      connectedSeekers: connected.length,
      hiddenSeekers: connected.length - shown.size,
      totalSeekers: map.seekers.filter((s) => !(hideSample && s.sample)).length,
      // Counted over every connection, not just the ones drawn.
      totalEdges: edges.length,
      strong: edges.filter((e) => e.score >= map.alertMinScore).length,
    };
  }, [map, hideSample, minScore, showAllSeekers]);

  // What the map traces: the hovered node, else whatever is open in the explorer.
  const focus = useMemo(() => hover ?? selected, [hover, selected]);
  const isLit = (e: { job: string; seeker: string }) =>
    !focus || (focus.kind === "job" ? e.job === focus.id : e.seeker === focus.id);
  const litNodes = useMemo(() => {
    if (!focus) return null;
    const ids = new Set<string>([focus.id]);
    for (const e of view.edges) {
      if (focus.kind === "job" && e.job === focus.id) ids.add(e.seeker);
      if (focus.kind === "seeker" && e.seeker === focus.id) ids.add(e.job);
    }
    return ids;
  }, [focus, view.edges]);

  // ---- The explorer -----------------------------------------------------
  async function open(kind: "job" | "seeker", id: string, expandId: string | null = null) {
    setSelected({ kind, id });
    setExpanded(expandId);
    setDetailError(null);
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    // Every click supersedes any request still loading, so a late answer for
    // an earlier click can't replace what this one shows.
    const request = ++latestRequest.current;
    const loaded = kind === "job" ? jobDetail?.job.id === id : seekerDetail?.seeker.id === id;
    if (loaded) {
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    try {
      const res = await fetch(kind === "job" ? `/api/superadmin/matching/${id}` : `/api/superadmin/matching/seeker/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (request !== latestRequest.current) return;
      if (kind === "job") setJobDetail(data as PostingMatchDetail);
      else setSeekerDetail(data as SeekerMatchView);
    } catch {
      if (request !== latestRequest.current) return;
      setDetailError(kind === "job" ? "Couldn't load this job's matches. Try again." : "Couldn't load this jobseeker's matches. Try again.");
    } finally {
      if (request === latestRequest.current) setLoadingDetail(false);
    }
  }
  const openJob = (jobId: string, seekerId: string | null = null) => open("job", jobId, seekerId);
  const openSeeker = (seekerId: string, jobId: string | null = null) => open("seeker", seekerId, jobId);
  const closeExplorer = () => {
    setSelected(null);
    setExpanded(null);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Stats + controls */}
      <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div className="grid grid-cols-2 gap-[12px] lg:grid-cols-4">
            {[
              { label: "Live jobs", value: view.jobs.length },
              { label: "Jobseekers", value: view.totalSeekers },
              { label: `Connections at ${minScore}%+`, value: view.totalEdges },
              { label: `Strong (${map.alertMinScore}%+, alert-level)`, value: view.strong },
            ].map((tile) => (
              <div key={tile.label} className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                <span className="text-xl text-[#141B2E]">{tile.value}</span>
                <span className="text-xs text-[#4B5468]">{tile.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-[16px] flex flex-wrap items-center gap-[10px]">
            <span className="text-xs text-[#4B5468]">Show matches from</span>
            <div className="flex rounded-full bg-[#F1F4F8] p-[3px]">
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMinScore(t)}
                  className={`rounded-full px-[12px] py-[5px] text-xs transition-colors ${
                    t === minScore ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
                  }`}
                >
                  {t}%
                </button>
              ))}
            </div>
            {hasSample && (
              <label className="ml-auto flex cursor-pointer items-center gap-[6px] text-xs text-[#4B5468]">
                <input
                  type="checkbox"
                  checked={hideSample}
                  onChange={(e) => setHideSample(e.target.checked)}
                  className="accent-brand-teal-dark"
                />
                Hide sample data
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Connection map */}
      <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-[8px]">
            <p className="text-sm text-[#141B2E]">Connection map</p>
            <div className="flex items-center gap-[14px] text-xs text-[#4B5468]">
              <span className="flex items-center gap-[6px]">
                <span className="h-[3px] w-[18px] rounded-full bg-brand-teal-dark" /> {map.alertMinScore}%+
              </span>
              <span className="flex items-center gap-[6px]">
                <span className="h-[2px] w-[18px] rounded-full bg-brand-teal opacity-60" /> below {map.alertMinScore}%
              </span>
            </div>
          </div>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            Hover a job or jobseeker to trace their connections. Click (or tap) a job, a jobseeker or a line to see why they match.
          </p>

          {view.jobs.length === 0 ? (
            <div className="mt-[16px] flex flex-wrap items-center gap-[10px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-sm text-[#4B5468]">
              {hiddenSampleJobs > 0 ? (
                <>
                  <span>
                    No real live jobs yet — {hiddenSampleJobs} sample job{hiddenSampleJobs === 1 ? " is" : "s are"} hidden.
                  </span>
                  <button
                    type="button"
                    onClick={() => setHideSample(false)}
                    className="h-[34px] rounded-full bg-brand-teal-dark px-[16px] text-sm text-white hover:opacity-90"
                  >
                    Show sample data
                  </button>
                </>
              ) : (
                "No live jobs to match yet."
              )}
            </div>
          ) : (
            <div className="mt-[14px] overflow-x-auto">
              <div className="relative flex min-w-[640px]" style={{ height: view.height }} onMouseLeave={() => setHover(null)}>
                {/* Jobs */}
                <div className="relative w-[34%] shrink-0">
                  {view.jobs.map((job) => {
                    const dim = litNodes && !litNodes.has(job.id);
                    const count = view.jobEdgeCount.get(job.id) ?? 0;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onMouseEnter={() => setHover({ kind: "job", id: job.id })}
                        onClick={() => openJob(job.id)}
                        style={{ top: view.jobY.get(job.id)! - JOB_ROW / 2 + 4, height: JOB_ROW - 8 }}
                        className={`absolute inset-x-0 flex items-center gap-[8px] rounded-[10px] border px-[10px] text-left transition-opacity ${
                          selected?.kind === "job" && selected.id === job.id ? "border-brand-teal-dark bg-brand-teal-soft" : "border-[#EAEDF2] bg-[#F8FAFB] hover:border-brand-teal"
                        } ${dim ? "opacity-30" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-[#141B2E]">{job.title}</span>
                          <span className="block truncate text-[11px] text-[#9AA3B2]">
                            {job.companyName}
                            {job.sample ? " · sample" : ""}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-[7px] py-[1px] text-[11px] ${count ? "bg-white text-brand-teal-dark" : "text-[#9AA3B2]"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Lines */}
                <svg className="h-full flex-1" viewBox={`0 0 100 ${view.height}`} preserveAspectRatio="none" aria-hidden>
                  {view.edges
                    .slice()
                    // Lit lines last, so they draw over the faded ones.
                    .sort((a, b) => Number(isLit(a)) - Number(isLit(b)) || a.score - b.score)
                    .map((e) => {
                      const y1 = view.jobY.get(e.job)!;
                      const y2 = view.seekerY.get(e.seeker)!;
                      const strong = e.score >= map.alertMinScore;
                      const lit = isLit(e);
                      return (
                        <path
                          key={`${e.job}:${e.seeker}`}
                          d={`M0 ${y1} C50 ${y1}, 50 ${y2}, 100 ${y2}`}
                          fill="none"
                          vectorEffect="non-scaling-stroke"
                          style={{ stroke: strong ? "var(--color-brand-teal-dark)" : "var(--color-brand-teal)" }}
                          strokeWidth={strong ? 1 + (e.score - map.alertMinScore) / 10 : 1}
                          strokeOpacity={focus ? (lit ? 0.9 : 0.06) : strong ? 0.55 : 0.3}
                          className="cursor-pointer"
                          onMouseEnter={() => setHover({ kind: "job", id: e.job })}
                          onClick={() => openJob(e.job, e.seeker)}
                        >
                          <title>{`${e.score}% match`}</title>
                        </path>
                      );
                    })}
                </svg>

                {/* Jobseekers */}
                <div className="relative w-[30%] shrink-0">
                  {view.seekers.map((seeker) => {
                    const dim = litNodes && !litNodes.has(seeker.id);
                    return (
                      <button
                        key={seeker.id}
                        type="button"
                        title={`${seeker.name} · ${seeker.targetRole}`}
                        onMouseEnter={() => setHover({ kind: "seeker", id: seeker.id })}
                        onClick={() => openSeeker(seeker.id)}
                        style={{ top: view.seekerY.get(seeker.id)! - SEEKER_ROW / 2 + 2, height: SEEKER_ROW - 4 }}
                        className={`absolute inset-x-0 flex items-center gap-[6px] rounded-full border px-[4px] pr-[10px] text-left transition-opacity ${
                          selected?.kind === "seeker" && selected.id === seeker.id ? "border-brand-teal-dark bg-brand-teal-soft" : "border-[#EAEDF2] bg-white hover:border-brand-teal"
                        } ${dim ? "opacity-30" : ""}`}
                      >
                        <Avatar seeker={seeker} size={18} />
                        <span className="min-w-0 flex-1 truncate text-xs text-[#141B2E]">
                          {seeker.name}
                          <span className="text-[#9AA3B2]"> · {seeker.targetRole}</span>
                        </span>
                      </button>
                    );
                  })}
                  {view.seekers.length === 0 && (
                    <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-[#9AA3B2]">
                      No jobseeker matches at {minScore}%+.
                    </p>
                  )}
                </div>
              </div>
              {(view.hiddenSeekers > 0 || showAllSeekers) && view.connectedSeekers > MAP_SEEKERS_DEFAULT && (
                <div className="mt-[10px] flex flex-wrap items-center gap-[10px] text-xs text-[#9AA3B2]">
                  <span>
                    {showAllSeekers
                      ? `Showing all ${view.connectedSeekers} connected jobseekers.`
                      : `Showing the ${MAP_SEEKERS_DEFAULT} strongest of ${view.connectedSeekers} connected jobseekers.`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllSeekers((s) => !s)}
                    className="rounded-full border border-[#EAEDF2] px-[12px] py-[5px] text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
                  >
                    {showAllSeekers ? `Show strongest ${MAP_SEEKERS_DEFAULT}` : "Show all"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Explorer */}
      <div ref={explorerRef} className={`scroll-mt-[100px] animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          {!selected ? (
            <>
              <p className="text-sm text-[#141B2E]">Match explorer</p>
              <p className="mt-[2px] text-xs text-[#9AA3B2]">
                Pick a job to see every jobseeker ranked and why — or click a jobseeker on the map to see every job they match.
              </p>
              <p className="mt-[14px] text-xs text-[#4B5468]">Live jobs</p>
              <div className="mt-[6px] flex flex-wrap gap-[8px]">
                {view.jobs.map((job) => (
                  <button key={job.id} type="button" onClick={() => openJob(job.id)} className={jobChipClass}>
                    {job.title}
                  </button>
                ))}
                {view.jobs.length === 0 && <span className="text-xs text-[#9AA3B2]">No live jobs right now.</span>}
              </div>
              {pendingJobs.length > 0 && (
                <>
                  <p className="mt-[14px] text-xs text-[#4B5468]">
                    Pending review <span className="text-[#9AA3B2]">— preview who they&rsquo;d match before you approve them</span>
                  </p>
                  <div className="mt-[6px] flex flex-wrap gap-[8px]">
                    {pendingJobs.map((job) => (
                      <button key={job.id} type="button" onClick={() => openJob(job.id)} className={`${jobChipClass} border-dashed`}>
                        {job.title} <span className="text-[#9AA3B2]">· {job.companyName}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : loadingDetail ? (
            <p className="text-sm text-[#4B5468]">
              {selected.kind === "job" ? "Scoring every jobseeker for this job…" : "Scoring every live job for this jobseeker…"}
            </p>
          ) : detailError ? (
            <div className="flex flex-wrap items-center gap-[10px]">
              <p className="text-sm text-[#C0362C]">{detailError}</p>
              <button type="button" onClick={() => open(selected.kind, selected.id, expanded)} className={jobChipClass}>
                Try again
              </button>
              <button type="button" onClick={closeExplorer} className="text-sm text-[#9AA3B2] hover:text-[#141B2E]">
                Close
              </button>
            </div>
          ) : selected.kind === "job" && jobDetail?.job.id === selected.id ? (
            <Explorer
              key={jobDetail.job.id}
              detail={jobDetail}
              hideSample={hideSample}
              expanded={expanded}
              onExpand={setExpanded}
              onClose={closeExplorer}
              onOpenSeeker={(seekerId) => openSeeker(seekerId, jobDetail.job.id)}
            />
          ) : selected.kind === "seeker" && seekerDetail?.seeker.id === selected.id ? (
            <SeekerExplorer
              key={seekerDetail.seeker.id}
              detail={seekerDetail}
              hideSample={hideSample}
              expanded={expanded}
              onExpand={setExpanded}
              onClose={closeExplorer}
              onOpenJob={(jobId) => openJob(jobId, seekerDetail.seeker.id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Profile fields that are never compared with a job — listed so admins don't assume they are. */
const NOT_USED_FIELDS = "Location, expected salary, target role and notice period";

// Same segmented tabs as the employer Advertisement page, a size smaller on
// phones so both labels fit side by side.
const explorerTabClass = (active: boolean) =>
  `min-w-0 flex-1 whitespace-nowrap rounded-full px-[8px] py-[7px] text-xs transition-colors sm:px-[14px] sm:text-sm ${
    active ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
  }`;

const jobChipClass =
  "rounded-full border border-[#EAEDF2] px-[12px] py-[6px] text-xs text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark";

const crossLinkClass =
  "mt-[10px] rounded-full border border-[#EAEDF2] bg-white px-[12px] py-[5px] text-xs text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark";

function Explorer({
  detail,
  hideSample,
  expanded,
  onExpand,
  onClose,
  onOpenSeeker,
}: {
  detail: PostingMatchDetail;
  hideSample: boolean;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onClose: () => void;
  onOpenSeeker: (seekerId: string) => void;
}) {
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(EXPLORER_PAGE);
  const [tab, setTab] = useState<"jobseekers" | "parameters">("jobseekers");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return detail.rows.filter(
      (r) =>
        !(hideSample && r.seeker.sample) &&
        (!eligibleOnly || r.eligible) &&
        (!q || r.seeker.name.toLowerCase().includes(q) || r.seeker.targetRole.toLowerCase().includes(q)),
    );
  }, [detail.rows, hideSample, eligibleOnly, search]);

  // A row opened from the map is shown even if it's past the first page.
  const visible = rows.slice(0, shown);
  const linked = expanded ? rows.find((r) => r.seeker.id === expanded) : undefined;
  if (linked && !visible.includes(linked)) visible.push(linked);

  const { job } = detail;
  const live = job.status === "active";
  // Everyone (bar hidden sample data), not just the rows the search/filters leave showing.
  const alertCount = detail.rows.filter((r) => r.getsAlert && !(hideSample && r.seeker.sample)).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <p className="text-xs text-[#9AA3B2]">Match explorer</p>
          <h2 className="mt-[2px] flex flex-wrap items-center gap-[8px] text-xl font-semibold text-[#141B2E]">
            {job.title}
            {!live && (
              <span className="rounded-full bg-[#FFF3D6] px-[9px] py-[2px] text-xs font-normal text-[#9A6B00]">
                {job.status === "pending" ? "Pending review — not live yet" : humanizeStatus(job.status)}
              </span>
            )}
          </h2>
          <p className="text-sm text-[#4B5468]">
            {job.companyName}
            {job.sample ? " · sample" : ""} ·{" "}
            {live ? (
              <a href={`/jobseeker/jobs/${job.slug}`} target="_blank" rel="noreferrer" className="text-brand-teal-dark hover:underline">
                View job
              </a>
            ) : (
              <a href="/superadmin/job-postings" className="text-brand-teal-dark hover:underline">
                Review in Job Postings
              </a>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-[#9AA3B2] hover:text-[#141B2E]">
          Close
        </button>
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-[10px]">
        <div className="flex w-full max-w-[420px] rounded-full bg-[#F1F4F8] p-[4px]" role="tablist">
          {(
            [
              ["jobseekers", `Ranked jobseekers (${rows.length})`],
              ["parameters", "Matching parameters"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={explorerTabClass(tab === key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-brand-teal-soft px-[10px] py-[4px] text-xs text-brand-teal-dark">
          {live ? `${alertCount} would get a job alert` : `Approving it would send ${alertCount} job alert${alertCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div role="tabpanel" hidden={tab !== "parameters"}>
        <MatchingParameters job={job} />
      </div>

      <div role="tabpanel" hidden={tab !== "jobseekers"}>
        <div className="mt-[14px] flex flex-wrap items-center gap-[10px]">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-[12px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#9AA3B2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobseekers"
              className="h-[38px] w-full rounded-full border border-[#EAEDF2] pl-[34px] pr-[14px] text-sm text-[#141B2E] outline-none focus:border-brand-teal-dark"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-[6px] text-xs text-[#4B5468]">
            <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="accent-brand-teal-dark" />
            Eligible only
          </label>
        </div>

        <ul className="mt-[14px] flex flex-col gap-[8px]">
          {visible.map((row, i) => (
            <PairRow
              key={row.seeker.id}
              rank={rows.indexOf(row) + 1 || i + 1}
              row={row}
              title={row.seeker.name}
              subtitle={row.seeker.targetRole}
              avatar={<Avatar seeker={row.seeker} size={28} />}
              sample={row.seeker.sample}
              alertMinScore={detail.alertMinScore}
              open={expanded === row.seeker.id}
              onToggle={() => onExpand(expanded === row.seeker.id ? null : row.seeker.id)}
              footer={
                <button type="button" onClick={() => onOpenSeeker(row.seeker.id)} className={crossLinkClass}>
                  See every job {row.seeker.name} matches →
                </button>
              }
            />
          ))}
        </ul>
        {rows.length === 0 && <p className="mt-[10px] text-sm text-[#4B5468]">No jobseekers match these filters.</p>}
        {rows.length > shown && (
          <button
            type="button"
            onClick={() => setShown((s) => s + EXPLORER_PAGE)}
            className="mx-auto mt-[12px] flex h-[38px] items-center rounded-full border border-[#EAEDF2] px-[18px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark"
          >
            Show more ({rows.length - shown} left)
          </button>
        )}
      </div>
    </>
  );
}

/** One jobseeker against every live job, plus what of their profile matching reads (and ignores). */
function SeekerExplorer({
  detail,
  hideSample,
  expanded,
  onExpand,
  onClose,
  onOpenJob,
}: {
  detail: SeekerMatchView;
  hideSample: boolean;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onClose: () => void;
  onOpenJob: (jobId: string) => void;
}) {
  const [tab, setTab] = useState<"jobs" | "profile">("jobs");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const { seeker } = detail;
  const rows = detail.rows.filter((r) => !(hideSample && r.job.sample) && (!eligibleOnly || r.eligible));
  const strong = rows.filter((r) => r.eligible && r.score >= detail.alertMinScore).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-[10px]">
        <div className="flex min-w-0 items-center gap-[12px]">
          <Avatar seeker={seeker} size={40} />
          <div className="min-w-0">
            <p className="text-xs text-[#9AA3B2]">Jobseeker view</p>
            <h2 className="mt-[2px] text-xl font-semibold text-[#141B2E]">{seeker.name}</h2>
            <p className="text-sm text-[#4B5468]">
              {seeker.targetRole}
              {seeker.sample ? " · sample" : ""}
              {!seeker.alertsOn ? " · job alerts off" : ""}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-[#9AA3B2] hover:text-[#141B2E]">
          Close
        </button>
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-[10px]">
        <div className="flex w-full max-w-[420px] rounded-full bg-[#F1F4F8] p-[4px]" role="tablist">
          {(
            [
              ["jobs", `Matching jobs (${rows.length})`],
              ["profile", "Profile used for matching"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={explorerTabClass(tab === key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-brand-teal-soft px-[10px] py-[4px] text-xs text-brand-teal-dark">
          {strong} strong match{strong === 1 ? "" : "es"} ({detail.alertMinScore}%+)
        </span>
      </div>

      <div role="tabpanel" hidden={tab !== "profile"}>
        <SeekerProfileUsed seeker={seeker} />
      </div>

      <div role="tabpanel" hidden={tab !== "jobs"}>
        <label className="mt-[14px] flex cursor-pointer items-center gap-[6px] text-xs text-[#4B5468]">
          <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="accent-brand-teal-dark" />
          Eligible only
        </label>
        <ul className="mt-[12px] flex flex-col gap-[8px]">
          {rows.map((row, i) => (
            <PairRow
              key={row.job.id}
              rank={i + 1}
              row={row}
              title={row.job.title}
              subtitle={row.job.companyName}
              avatar={
                <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-brand-teal-dark">
                  <BriefcaseIcon className="h-[13px] w-[13px]" />
                </span>
              }
              sample={row.job.sample}
              alertMinScore={detail.alertMinScore}
              open={expanded === row.job.id}
              onToggle={() => onExpand(expanded === row.job.id ? null : row.job.id)}
              footer={
                <button type="button" onClick={() => onOpenJob(row.job.id)} className={crossLinkClass}>
                  Open {row.job.title} — every jobseeker for it →
                </button>
              }
            />
          ))}
        </ul>
        {rows.length === 0 && <p className="mt-[10px] text-sm text-[#4B5468]">No live jobs to show.</p>}
      </div>
    </>
  );
}

/** What matching reads from one jobseeker's profile, what it's compared with, and what's ignored. */
function SeekerProfileUsed({ seeker }: { seeker: SeekerMatchView["seeker"] }) {
  const { used } = seeker;
  const chips = (items: string[]) =>
    items.length ? (
      <span className="flex flex-wrap gap-[4px]">
        {items.map((v) => (
          <span key={v} className="rounded-full bg-[#F1F4F8] px-[7px] py-[1px] text-[#141B2E]">
            {v}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-[#9AA3B2]">None</span>
    );
  const rowsUsed: { label: string; value: React.ReactNode; against: string; weight: string }[] = [
    { label: "Work authorization", value: used.workAuthorization, against: "The job's accepted types", weight: "Must pass" },
    { label: "Driving licence", value: used.drivingLicense ?? "None", against: "The job's required licence", weight: "Must pass" },
    { label: "Skills", value: chips(used.skills), against: "Required, soft & nice-to-have skills", weight: "35% / 10% / 10%" },
    { label: "Soft skills", value: chips(used.softSkills), against: "The same three skill lists", weight: "—" },
    { label: "Other skills", value: chips(used.otherSkills), against: "The same three skill lists", weight: "—" },
    { label: "Years of experience", value: `${used.yearsExperience} years`, against: "The job's minimum years", weight: "15%" },
    { label: "Preferred industry", value: used.preferredIndustry, against: "The job's industry", weight: "10%" },
    { label: "Work arrangement", value: used.workArrangement, against: "The job's work arrangement", weight: "10%" },
    { label: "Employment type", value: used.employmentType, against: "The job's employment type", weight: "10%" },
  ];
  return (
    <div className="mt-[14px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
      <p className="text-xs text-[#9AA3B2]">
        What matching reads from this profile, and what on a job it&rsquo;s compared with. All three skill lists are pooled together.
      </p>
      <div className="mt-[10px] overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr className="text-[#9AA3B2]">
              <th className="pb-[6px] font-normal">Profile field</th>
              <th className="pb-[6px] font-normal">Their profile</th>
              <th className="pb-[6px] font-normal">Compared with</th>
              <th className="pb-[6px] text-right font-normal">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rowsUsed.map((r) => (
              <tr key={r.label} className="border-t border-[#EAEDF2] align-top">
                <td className="py-[7px] pr-[10px] text-[#141B2E]">{r.label}</td>
                <td className="py-[7px] pr-[10px] text-[#141B2E]">{r.value}</td>
                <td className="py-[7px] pr-[10px] text-[#4B5468]">{r.against}</td>
                <td className="py-[7px] text-right text-[#141B2E]">
                  {r.weight === "Must pass" ? (
                    <span className="rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[#C0362C]">Must pass</span>
                  ) : (
                    r.weight
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-[16px] border-t border-[#EAEDF2] pt-[14px]">
        <p className="text-sm text-[#141B2E]">On the profile, but not used for matching</p>
        <ul className="mt-[8px] grid grid-cols-1 gap-[6px] sm:grid-cols-2">
          {seeker.notUsed.map((f) => (
            <li key={f.label} className="rounded-[10px] border border-[#EAEDF2] bg-white px-[12px] py-[8px] text-xs">
              <span className="block text-[#9AA3B2]">{f.label}</span>
              <span className="text-[#4B5468]">{f.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** What this posting matches on: each job field, the jobseeker field it's compared with, and its weight. */
function MatchingParameters({ job }: { job: PostingMatchDetail["job"] }) {
  const { workAuthorizations, drivingLicense } = job.requirements;
  const chip = "rounded-full bg-[#F1F4F8] px-[7px] py-[1px] text-[#141B2E]";
  const hardFilters = [
    {
      label: "Work authorization",
      rule: "Pass or fail: theirs must be one of the accepted types",
      jobValue: workAuthorizations.length ? workAuthorizations.join(", ") : null,
      comparedWith: "Work authorization",
      companyOff: job.hardFiltersOff.workAuthorization,
    },
    {
      label: "Driving licence",
      rule: "Pass or fail: they must hold this licence",
      jobValue: drivingLicense,
      comparedWith: "Driving licence",
      companyOff: job.hardFiltersOff.drivingLicense,
    },
  ];
  const anyCompanyOff = hardFilters.some((f) => f.companyOff) || job.parameters.some((p) => p.companyOff);
  return (
    <div className="mt-[14px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
      <p className="text-xs text-[#9AA3B2]">
        What this job posting sets, and which part of a jobseeker&rsquo;s profile each one is compared with.
      </p>
      <div className="mt-[10px] overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead>
            <tr className="text-[#9AA3B2]">
              <th className="pb-[6px] font-normal">Part</th>
              <th className="pb-[6px] font-normal">Job posting sets</th>
              <th className="pb-[6px] font-normal">Compared with jobseeker&rsquo;s</th>
              <th className="pb-[6px] text-right font-normal">Weight</th>
              <th className="pb-[6px] text-right font-normal">Counts for</th>
            </tr>
          </thead>
          <tbody>
            {hardFilters.map((f) => (
              <tr key={f.label} className="border-t border-[#EAEDF2] align-top">
                <td className="py-[7px] pr-[10px] text-[#141B2E]">
                  <PartLabel label={f.label} rule={f.rule} companyOff={f.companyOff} />
                </td>
                <td className="py-[7px] pr-[10px] text-[#141B2E]">{f.jobValue ?? <span className="text-[#9AA3B2]">Any — not required</span>}</td>
                <td className="py-[7px] pr-[10px] text-[#4B5468]">{f.comparedWith}</td>
                <td className="py-[7px] text-right text-[#9AA3B2]">—</td>
                <td className="py-[7px] text-right">
                  {f.jobValue ? (
                    <span className="rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[#C0362C]">Must pass</span>
                  ) : (
                    <span className="text-[#9AA3B2]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {job.parameters.map((p) => (
              <tr key={p.key} className={`border-t border-[#EAEDF2] align-top ${p.jobValue === null ? "text-[#9AA3B2]" : ""}`}>
                <td className={`py-[7px] pr-[10px] ${p.jobValue === null ? "" : "text-[#141B2E]"}`}>
                  <PartLabel label={p.label} rule={p.rule} companyOff={p.companyOff} />
                </td>
                <td className="py-[7px] pr-[10px]">
                  {p.jobValue === null ? (
                    "Not set — skipped"
                  ) : Array.isArray(p.jobValue) ? (
                    <span className="flex flex-wrap gap-[4px]">
                      {p.jobValue.map((v) => (
                        <span key={v} className={chip}>
                          {v}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[#141B2E]">{p.jobValue}</span>
                  )}
                </td>
                <td className={`py-[7px] pr-[10px] ${p.jobValue === null ? "" : "text-[#4B5468]"}`}>{p.comparedWith}</td>
                <td className="py-[7px] text-right">{pct(p.weight * 100)}</td>
                <td className={`py-[7px] text-right ${p.effectiveWeight === null ? "" : "font-semibold text-[#141B2E]"}`}>
                  {/* One decimal when re-balanced (e.g. 11.8%), so the column visibly adds up to 100. */}
                  {p.effectiveWeight === null ? "—" : `${Number((p.effectiveWeight * 100).toFixed(1))}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-[8px] text-xs text-[#9AA3B2]">
        &ldquo;Counts for&rdquo; is each part&rsquo;s real share of the 100 points: parts this job doesn&rsquo;t set are skipped and the
        rest share their weight.
      </p>
      {anyCompanyOff && (
        <p className="mt-[6px] text-xs text-[#9A6B00]">
          &ldquo;Off for this company&rdquo;: {job.companyName} switched that criterion off, so it&rsquo;s ignored in their Top Matches. It
          still counts in the % jobseekers see on job pages and in job alerts.
        </p>
      )}
      <p className="mt-[6px] text-xs text-[#9AA3B2]">Never compared: {NOT_USED_FIELDS}.</p>

      <ScreeningRequirements screening={job.screening} />
    </div>
  );
}

/** A part's name, its scoring rule in plain words, and whether the company switched it off. */
function PartLabel({ label, rule, companyOff }: { label: string; rule: string; companyOff: boolean }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-[6px]">
        {label}
        {companyOff && (
          <span className="rounded-full bg-[#FFF3D6] px-[7px] py-[1px] text-[11px] text-[#9A6B00]">Off for this company</span>
        )}
      </span>
      <span className="mt-[2px] block max-w-[220px] text-[11px] leading-[15px] text-[#9AA3B2]">{rule}</span>
    </>
  );
}

/** The job's pre-screening questions — asked when applying, and only used for applicants (employer Top Matches). */
function ScreeningRequirements({ screening }: { screening: PostingMatchDetail["job"]["screening"] }) {
  const hasPreferred = screening.requirements.some((r) => r.preferred);
  return (
    <div className="mt-[16px] border-t border-[#EAEDF2] pt-[14px]">
      <p className="text-sm text-[#141B2E]">Pre-screening</p>
      {!screening.enabled ? (
        <p className="mt-[2px] text-xs text-[#9AA3B2]">Off for this job — applicants are judged on their profile only.</p>
      ) : (
        <>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            Asked when someone applies. Only affects applicants in the employer&rsquo;s Top Matches — not the % on job pages or job
            alerts. Their answers decide eligibility there instead of their profile.
          </p>
          {screening.requirements.length === 0 && screening.unscored.length === 0 ? (
            <p className="mt-[8px] text-xs text-[#4B5468]">On, but no requirements are set.</p>
          ) : (
            <ul className="mt-[10px] flex flex-col">
              {screening.requirements.map((r, i) => (
                <li key={`${i}-${r.label}`} className="flex items-start justify-between gap-[12px] border-t border-[#EAEDF2] py-[7px] text-xs first:border-t-0">
                  <span className="text-[#141B2E]">{r.label}</span>
                  {r.preferred ? (
                    <span className="shrink-0 rounded-full bg-brand-teal-soft px-[7px] py-[1px] text-brand-teal-dark">Preferred · adds points</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[#C0362C]">Must pass</span>
                  )}
                </li>
              ))}
              {screening.unscored.map((q, i) => (
                <li key={`u-${i}`} className="flex items-start justify-between gap-[12px] border-t border-[#EAEDF2] py-[7px] text-xs first:border-t-0">
                  <span className="text-[#4B5468]">{q}</span>
                  <span className="shrink-0 rounded-full bg-[#F1F4F8] px-[7px] py-[1px] text-[#9AA3B2]">Not scored · read by employer</span>
                </li>
              ))}
            </ul>
          )}
          {hasPreferred && (
            <p className="mt-[6px] text-xs text-[#9AA3B2]">
              Preferred ones never block anyone; meeting all of them adds up to {screening.preferredMaxBonus} points, shared between them.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** An applicant as the employer sees them in Top Matches: screening result, preferred bonus and final score. */
function ApplicantBlock({ applicant }: { applicant: NonNullable<PairDetail["applicant"]> }) {
  const { screening } = applicant;
  return (
    <div className="mt-[12px] rounded-[10px] border border-[#EAEDF2] bg-white p-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <p className="text-xs text-[#141B2E]">As an applicant — employer&rsquo;s Top Matches</p>
        <span className="text-sm font-semibold text-[#141B2E]">{pct(applicant.score)}</span>
      </div>
      <p className={`mt-[4px] text-xs ${applicant.eligible ? "text-[#1F7A3F]" : "text-[#C0362C]"}`}>
        {applicant.eligible ? "Eligible" : `Not eligible: ${applicant.reasons.join("; ")}`}
        {screening ? " (from their screening answers)" : " (from their profile — no screening on this job)"}
      </p>
      {screening && screening.items.length > 0 && (
        <ul className="mt-[8px] flex flex-col gap-[4px]">
          {screening.items.map((item, i) => (
            <li key={`${i}-${item.label}`} className="flex items-start gap-[8px] text-xs">
              <span
                className={`mt-[1px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ${
                  item.met ? "bg-[#1F7A3F]" : item.preferred ? "bg-[#C9CED6]" : "bg-[#C0362C]"
                }`}
              >
                {item.met ? <CheckIcon className="h-[8px] w-[8px] text-white" /> : <XIcon className="h-[7px] w-[7px] text-white" />}
              </span>
              <span className="min-w-0 flex-1 text-[#141B2E]">{item.label}</span>
              <span className="shrink-0 text-[#9AA3B2]">{item.preferred ? "Preferred" : "Must pass"}</span>
            </li>
          ))}
        </ul>
      )}
      {screening && screening.preferredTotal > 0 && (
        <p className="mt-[8px] text-xs text-[#4B5468]">
          Met {screening.preferredMet} of {screening.preferredTotal} preferred → +{screening.bonus} point{screening.bonus === 1 ? "" : "s"}
        </p>
      )}
      <p className="mt-[6px] text-[11px] text-[#9AA3B2]">
        Score uses the company&rsquo;s own matching switches{screening && screening.preferredTotal > 0 ? ", plus the preferred bonus" : ""}.
      </p>
    </div>
  );
}

/**
 * One job × one jobseeker: the score, badges, and on expand the part-by-part
 * breakdown. Used both ways round — a jobseeker in a job's list, or a job in
 * a jobseeker's list — so the header (`title`, `subtitle`, `avatar`) is passed in.
 */
function PairRow({
  rank,
  row,
  title,
  subtitle,
  avatar,
  sample,
  alertMinScore,
  open,
  onToggle,
  footer,
}: {
  rank: number;
  row: PairDetail;
  title: string;
  subtitle: string;
  avatar: React.ReactNode;
  sample: boolean;
  alertMinScore: number;
  open: boolean;
  onToggle: () => void;
  /** Extra actions under the breakdown (e.g. open the other side's view). */
  footer?: React.ReactNode;
}) {
  const barTone = !row.eligible ? "bg-[#C99089]" : row.fitScore >= alertMinScore ? "bg-brand-teal-dark" : "bg-brand-teal";
  return (
    <li className={`rounded-[14px] border ${open ? "border-brand-teal-dark" : "border-[#EAEDF2]"} bg-[#F8FAFB]`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-[10px] p-[12px] text-left">
        <span className="w-[22px] shrink-0 text-right text-xs text-[#9AA3B2]">{rank}</span>
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-[6px]">
            <span className="truncate text-sm text-[#141B2E]">{title}</span>
            {sample && <span className="rounded-full bg-[#F1F4F8] px-[7px] py-[1px] text-[11px] text-[#9AA3B2]">sample</span>}
            {row.applied && <span className="rounded-full bg-[#F1ECFB] px-[7px] py-[1px] text-[11px] text-[#7C5CD1]">Applied</span>}
            {row.applicant?.screening &&
              (row.applicant.eligible ? (
                <span className="rounded-full bg-[#E3F4EA] px-[7px] py-[1px] text-[11px] text-[#1F7A3F]">Passed screening</span>
              ) : (
                <span className="rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[11px] text-[#C0362C]">Failed screening</span>
              ))}
            {row.getsAlert && <span className="rounded-full bg-brand-teal-soft px-[7px] py-[1px] text-[11px] text-brand-teal-dark">Gets alert</span>}
            {!row.eligible && <span className="rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[11px] text-[#C0362C]">Not eligible</span>}
          </span>
          <span className="block truncate text-xs text-[#9AA3B2]">{subtitle}</span>
        </span>
        <span className="hidden w-[120px] shrink-0 sm:block">
          <span className="block h-[6px] overflow-hidden rounded-full bg-[#EAEDF2]">
            <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${row.fitScore}%` }} />
          </span>
        </span>
        <span className="w-[44px] shrink-0 text-right text-sm text-[#141B2E]">{pct(row.eligible ? row.score : row.fitScore)}</span>
        <ChevronDownIcon className={`h-[10px] w-[10px] shrink-0 text-[#9AA3B2] transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="border-t border-[#EAEDF2] px-[12px] pb-[14px] pt-[12px]">
          {!row.eligible && (
            <p className="mb-[10px] rounded-[10px] bg-[#FDE8E8] px-[12px] py-[8px] text-xs leading-[17px] text-[#C0362C]">
              Fails a hard filter, so the jobseeker sees 0% and gets no alert: {row.ineligibleReasons.join("; ")}. Their fit score
              below is what they&rsquo;d get otherwise.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-[#9AA3B2]">
                  <th className="pb-[6px] font-normal">Part</th>
                  <th className="pb-[6px] font-normal">Why</th>
                  <th className="pb-[6px] text-right font-normal">Match</th>
                  <th className="pb-[6px] text-right font-normal">Weight</th>
                  <th className="pb-[6px] text-right font-normal">Points</th>
                </tr>
              </thead>
              <tbody>
                {row.components.map((c) => (
                  <tr key={c.key} className={`border-t border-[#EAEDF2] align-top ${c.value === null ? "text-[#9AA3B2]" : "text-[#141B2E]"}`}>
                    <td className="py-[7px] pr-[10px]">
                      <PartLabel label={c.label} rule={c.rule} companyOff={c.companyOff} />
                    </td>
                    <td className="py-[7px] pr-[10px]">
                      {c.value === null ? (
                        "Not set on this job — skipped"
                      ) : c.detail?.kind === "skills" ? (
                        <span className="flex flex-wrap gap-[4px]">
                          {c.detail.matched.map((s) => (
                            <span
                              key={`m-${s.skill}`}
                              title={s.via ? `Matched their "${s.via}" as the same skill` : undefined}
                              className="rounded-full bg-[#E3F4EA] px-[7px] py-[1px] text-[#1F7A3F]"
                            >
                              {s.skill}
                              {s.via && <span className="text-[#1F7A3F]/70"> · as {s.via}</span>}
                            </span>
                          ))}
                          {c.detail.missing.map((s) => (
                            <span key={`x-${s}`} className="rounded-full bg-[#FDE8E8] px-[7px] py-[1px] text-[#C0362C] line-through decoration-[#C0362C]/40">
                              {s}
                            </span>
                          ))}
                        </span>
                      ) : c.detail?.kind === "compare" ? (
                        <span className="text-[#4B5468]">
                          Wants <span className="text-[#141B2E]">{c.detail.wanted}</span> · has{" "}
                          <span className="text-[#141B2E]">{c.detail.has}</span>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-[7px] text-right">{c.value === null ? "—" : pct(c.value * 100)}</td>
                    <td className="py-[7px] text-right">{pct(c.weight * 100)}</td>
                    <td className="py-[7px] text-right">{c.points === null ? "—" : c.points.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#EAEDF2] text-[#141B2E]">
                  <td className="pt-[8px]" colSpan={4}>
                    Fit score
                    <span className="ml-[6px] text-[#9AA3B2]">(points from the parts this job sets, re-balanced to 100)</span>
                  </td>
                  <td className="pt-[8px] text-right font-semibold">{pct(row.fitScore)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {row.components.some((c) => c.companyOff && c.value !== null) && (
            <p className="mt-[8px] text-xs text-[#9A6B00]">
              Parts marked &ldquo;Off for this company&rdquo; still count here, but are left out of the company&rsquo;s Top Matches score.
            </p>
          )}
          {row.applicant && <ApplicantBlock applicant={row.applicant} />}
          {!row.alertsOn && <p className="mt-[8px] text-xs text-[#9AA3B2]">Has job alerts turned off.</p>}
          {footer}
        </div>
      )}
    </li>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, TrendUpIcon, XIcon } from "./icons";
import MatchSettingsModal, { type CriteriaFlags } from "./MatchSettingsModal";

type MatchBreakdown = {
  skills: number | null;
  softSkills: number | null;
  niceToHaveSkills: number | null;
  experience: number | null;
  industry: number | null;
  workArrangement: number | null;
  employmentType: number | null;
};

type MatchResult = {
  applicationId: string;
  jobPostingId: string;
  jobPostingTitle: string;
  jobPostingLocation: string;
  jobPostingEmploymentType: string;
  applicantName: string;
  applicantAvatarUrl: string | null;
  score: number;
  eligible: boolean;
  ineligibleReasons: string[];
  breakdown: MatchBreakdown;
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const BREAKDOWN_LABELS: { key: keyof MatchBreakdown; label: string }[] = [
  { key: "skills", label: "Required skills" },
  { key: "softSkills", label: "Soft skills" },
  { key: "niceToHaveSkills", label: "Nice-to-have skills" },
  { key: "experience", label: "Experience" },
  { key: "industry", label: "Industry" },
  { key: "workArrangement", label: "Work arrangement" },
  { key: "employmentType", label: "Employment type" },
];

function matchBand(score: number): { label: string; bg: string; text: string } {
  if (score >= 80) return { label: "Strong match", bg: "bg-[#E7F6EC]", text: "text-[#2F9E56]" };
  if (score >= 60) return { label: "Good match", bg: "bg-[#E6F9FA]", text: "text-[#008990]" };
  return { label: "Possible match", bg: "bg-[#F1F4F8]", text: "text-[#4B5468]" };
}

export default function TopMatchesCard({
  initialEnabled,
  initialCriteria,
}: {
  initialEnabled: boolean;
  initialCriteria: CriteriaFlags;
}) {
  const [smartMatchOn, setSmartMatchOn] = useState(initialEnabled);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);

  useEffect(() => {
    if (!smartMatchOn || results !== null) return;
    let cancelled = false;
    fetch("/api/employer/applicants/matches")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load matches.");
        return res.json();
      })
      .then((data: { results: MatchResult[] }) => {
        if (cancelled) return;
        setResults(data.results);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load matches right now. Try again shortly.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [smartMatchOn, results]);

  function toggleSmartMatch() {
    setSmartMatchOn((prev) => {
      const next = !prev;
      fetch("/api/employer/smart-match-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      }).catch(() => {});
      return next;
    });
  }

  function handleCriteriaChange(next: CriteriaFlags) {
    setCriteria(next);
    setResults(null);
    setLoading(true);
  }

  const postings = useMemo(() => {
    const seen = new Map<
      string,
      {
        jobPostingId: string;
        jobPostingTitle: string;
        jobPostingLocation: string;
        jobPostingEmploymentType: string;
        applicantCount: number;
      }
    >();
    for (const r of results ?? []) {
      const existing = seen.get(r.jobPostingId);
      if (existing) existing.applicantCount += 1;
      else
        seen.set(r.jobPostingId, {
          jobPostingId: r.jobPostingId,
          jobPostingTitle: r.jobPostingTitle,
          jobPostingLocation: r.jobPostingLocation,
          jobPostingEmploymentType: r.jobPostingEmploymentType,
          applicantCount: 1,
        });
    }
    return Array.from(seen.values());
  }, [results]);

  // Skip the picker entirely when there's only one posting to choose from —
  // nothing to actually choose.
  const effectivePostingId = selectedPostingId ?? (postings.length === 1 ? postings[0].jobPostingId : null);

  const ranked = (results ?? [])
    .filter((r) => r.eligible && r.jobPostingId === effectivePostingId)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-start justify-between gap-[8px]">
        <div>
          <p className="text-sm text-[#141B2E]">Top Matches</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">
            {smartMatchOn
              ? "Ranked across every open role by skills and experience fit."
              : "Switch on to instantly surface your best-fit candidates."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={smartMatchOn}
          aria-label="Toggle Smart Match"
          onClick={toggleSmartMatch}
          className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
            smartMatchOn ? "bg-brand-teal-dark" : "bg-black/[0.15]"
          }`}
        >
          <span
            className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform ${
              smartMatchOn ? "translate-x-[16px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {!smartMatchOn ? (
        <div className="flex flex-col items-center gap-[8px] rounded-[14px] bg-[#F8FAFB] p-[20px] text-center">
          <TrendUpIcon className="h-[18px] w-[18px] text-[#9AA3B2]" />
          <p className="text-xs text-[#4B5468]">
            Smart Match is off. Flip it on and we&rsquo;ll rank every active applicant by how well they fit —
            no manual screening required.
          </p>
        </div>
      ) : loading ? (
        <p className="rounded-[14px] bg-[#F8FAFB] p-[16px] text-center text-xs text-[#9AA3B2]">
          Scoring your applicants&hellip;
        </p>
      ) : error ? (
        <p className="rounded-[14px] bg-[#FEF2F2] p-[16px] text-center text-xs text-red-600">{error}</p>
      ) : postings.length === 0 ? (
        <p className="rounded-[14px] bg-[#F8FAFB] p-[16px] text-center text-xs text-[#9AA3B2]">
          No active applicants to rank yet — once candidates apply, they&rsquo;ll show up here scored and sorted.
        </p>
      ) : effectivePostingId === null ? (
        <div className="flex flex-col gap-[8px]">
          <p className="text-xs text-[#141B2E]">Choose a job posting to see its top matches</p>
          {postings.map((posting) => (
            <button
              key={posting.jobPostingId}
              type="button"
              onClick={() => setSelectedPostingId(posting.jobPostingId)}
              className="flex items-center justify-between gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] text-left hover:border-brand-teal-dark"
            >
              <span>
                <span className="block text-xs text-[#141B2E]">{posting.jobPostingTitle}</span>
                <span className="mt-[2px] block text-xs text-[#9AA3B2]">
                  {posting.jobPostingLocation} ·{" "}
                  {EMPLOYMENT_TYPE_LABEL[posting.jobPostingEmploymentType] ?? posting.jobPostingEmploymentType}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-white px-[9px] py-[3px] text-xs text-[#4B5468] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                {posting.applicantCount} applicant{posting.applicantCount === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {postings.length > 1 && (
            <button
              type="button"
              onClick={() => setSelectedPostingId(null)}
              className="self-start text-left text-sm text-brand-teal-dark hover:underline"
            >
              ← Change job posting
            </button>
          )}

          <div className="flex items-center gap-[12px]">
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="text-left text-sm text-brand-teal-dark hover:underline"
            >
              {showBreakdown ? "Hide score breakdown" : "What counts toward the score?"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="text-left text-sm text-brand-teal-dark hover:underline"
            >
              {showSettings ? "Hide match settings" : "Match settings"}
            </button>
          </div>

          {showSettings && <MatchSettingsModal criteria={criteria} onChange={handleCriteriaChange} />}

          {showBreakdown && (
            <div className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] text-xs text-[#4B5468]">
              <p>
                Required skills 35% · Soft skills 10% · Experience 15% · Industry 10% · Work arrangement 10% ·
                Employment type 10% · Nice-to-have skills 10%
              </p>
              <p className="text-[#9AA3B2]">
                Missing signals (e.g. no minimum experience set on this posting) are left out and the rest
                reweighted, so a score is never unfairly dragged down by data that isn&rsquo;t there yet.
              </p>
            </div>
          )}

          {ranked.length === 0 ? (
            <p className="rounded-[14px] bg-[#F8FAFB] p-[16px] text-center text-xs text-[#9AA3B2]">
              No eligible applicants for this posting yet.
            </p>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {ranked.map((result, index) => {
                const band = matchBand(result.score);
                return (
                  <div
                    key={result.applicationId}
                    className="flex flex-col gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px]"
                  >
                    <div className="flex items-start gap-[8px]">
                      <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-white text-xs text-[#4B5468] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-[18px] text-[#141B2E]">
                          {result.applicantName}
                        </p>
                        <p className="mt-[1px] text-xs leading-[15px] text-[#9AA3B2]">
                          Applied for {result.jobPostingTitle}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`self-start rounded-full px-[9px] py-[3px] text-xs ${band.bg} ${band.text}`}
                    >
                      {result.score}% · {band.label}
                    </span>

                    {showBreakdown && (
                      <div className="flex flex-wrap items-center gap-[8px] text-xs text-[#4B5468]">
                        {BREAKDOWN_LABELS.map(({ key, label }) => {
                          const value = result.breakdown[key];
                          if (value === null) return null;
                          const pass = value >= 0.5;
                          return (
                            <span key={key} className="flex items-center gap-[3px]">
                              {pass ? (
                                <CheckIcon className="h-[9px] w-[9px] text-[#2F9E56]" />
                              ) : (
                                <XIcon className="h-[9px] w-[9px] text-red-400" />
                              )}
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

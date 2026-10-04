"use client";

import { useRef, useState } from "react";
import type { ApplicantVideoPitch } from "./VideoPitchBadge";

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Top of the employer's applicant view: the jobseeker's own one-line intro
 * and strengths first (skimmable), then the video behind a deliberate
 * "Watch" tap. The first play records a watch for this company — which
 * marks it "Watched" here and notifies the jobseeker.
 */
export default function VideoPitchPanel({
  pitch,
  onWatched,
}: {
  pitch: ApplicantVideoPitch;
  onWatched?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(pitch.watchedByMyCompany);
  const reported = useRef(pitch.watchedByMyCompany);

  function handlePlay() {
    if (reported.current) return;
    reported.current = true;
    setWatched(true);
    onWatched?.();
    fetch(`/api/video-pitches/${pitch.id}/view`, { method: "POST" }).catch(() => {
      // Best-effort — failing to log a watch must never interrupt playback.
    });
  }

  return (
    <div className="rounded-[14px] border border-[#FBE7B5] bg-[#FFFBF0] p-[14px]">
      <div className="flex items-center justify-between gap-[8px]">
        <p className="text-xs text-[#141B2E]">🎥 In their own words</p>
        {watched && <span className="text-xs text-[#9AA3B2]">Watched by your team</span>}
      </div>
      {pitch.intro && <p className="mt-[8px] text-sm leading-[20px] text-[#141B2E]">&ldquo;{pitch.intro}&rdquo;</p>}
      {pitch.strengths.length > 0 && (
        <div className="mt-[8px] flex flex-wrap gap-[6px]">
          {pitch.strengths.map((s) => (
            <span key={s} className="rounded-full bg-[#FFE9A6] px-[10px] py-[3px] text-xs text-[#141B2E]">
              {s}
            </span>
          ))}
        </div>
      )}
      {open ? (
        <video
          src={`/api/video-pitches/${pitch.id}/stream`}
          controls
          autoPlay
          playsInline
          onPlay={handlePlay}
          className="mt-[10px] max-h-[360px] w-full rounded-[12px] bg-black object-contain"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-[10px] flex h-[34px] items-center gap-[8px] rounded-full bg-brand-teal-dark px-[16px] text-sm text-white hover:opacity-90"
        >
          ▶ Watch video ({formatDuration(pitch.durationSeconds)})
        </button>
      )}
    </div>
  );
}

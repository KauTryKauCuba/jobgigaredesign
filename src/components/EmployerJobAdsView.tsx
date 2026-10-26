"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdSlotCalendar from "./AdSlotCalendar";
import Dropdown from "./Dropdown";
import JobAdCard, { type JobAdCardData } from "./JobAdCard";
import { EMPLOYMENT_TYPE_LABEL } from "./JobPostingDetails";
import Modal from "./Modal";
import { gradientFrameClass } from "./formStyles";
import { BriefcaseIcon, CalendarIcon, ImageIcon } from "./icons";
import {
  AD_BOOK_AHEAD_MONTHS,
  AD_MAX_ACTIVE_PER_COMPANY,
  AD_RUN_DAYS,
  AD_SLOTS,
  addDays,
  checkStartFromCounts,
  daysBetween,
  formatAdDate,
  formatAdRun,
  nextFreeStartFromCounts,
  runEndDate,
  type AdPhase,
  type SlotBooking,
} from "@/lib/ad-slots";

const AD_VIDEO_MAX_SECONDS = 30;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export type AdvertisableJob = { id: string; title: string; location: string; employmentType: string };

export type JobAdBooking = {
  id: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  phase: AdPhase;
  rejectionReason: string | null;
  startDate: string;
  endDate: string;
  jobPostingId: string;
  jobTitle: string;
  jobLocation: string;
  jobEmploymentType: string;
  // Only an active posting is featured — a closed one's ad stays booked but hidden.
  jobOpen: boolean;
};

type Company = { name: string; logoUrl: string | null; verified: boolean };

// Edit = change a waiting/scheduled/rejected booking (back to review);
// again = a new booking reusing a past one's artwork and job.
type FormMode = { kind: "new" } | { kind: "edit"; booking: JobAdBooking } | { kind: "again"; booking: JobAdBooking };

const PHASE = {
  pending: { label: "Waiting for review", className: "bg-brand-gold-soft text-brand-gold-dark" },
  scheduled: { label: "Scheduled", className: "bg-[#F1ECFB] text-[#7C5CD1]" },
  live: { label: "Live now", className: "bg-brand-teal-soft text-brand-teal-dark" },
  ended: { label: "Ended", className: "bg-[#F1F4F8] text-[#9AA3B2]" },
  rejected: { label: "Needs changes", className: "bg-[#FDE8E8] text-[#C0362C]" },
} as const;

function videoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => resolve(null);
    video.src = url;
  });
}

function bookingNote(b: JobAdBooking, today: string) {
  const lastDay = addDays(b.endDate, -1);
  switch (b.phase) {
    case "pending":
      return `Your slot for ${formatAdRun(b.startDate, b.endDate)} is held while we review your ad.`;
    case "scheduled":
      return `Approved — featured from ${formatAdDate(b.startDate)} until ${formatAdDate(lastDay)}.`;
    case "live": {
      const left = daysBetween(today, b.endDate);
      return `Featured on the jobs page until ${formatAdDate(lastDay)} · ${left} day${left === 1 ? "" : "s"} left.`;
    }
    case "ended":
      return `Ran ${formatAdRun(b.startDate, b.endDate)}.`;
    case "rejected":
      return b.rejectionReason ? `Not approved: ${b.rejectionReason}` : "Not approved — edit it and submit again.";
  }
}

const jobTypeLabel = (type: string) => EMPLOYMENT_TYPE_LABEL[type] ?? type;

/**
 * The Advertisement page's "Job posting advertisement" tab: book a 30-day
 * featured spot above the jobseeker page's job search for one live job
 * posting, with the employer's own square artwork. Same booking flow and
 * rules as the company ad tab (EmployerAdvertisementView), with its own slots.
 */
export default function EmployerJobAdsView({
  company,
  jobs,
  today,
  counts,
  ownBookings,
  active,
  past,
}: {
  company: Company;
  // The company's live job postings — the ones that can be featured.
  jobs: AdvertisableJob[];
  today: string;
  // Slot-holding job ads per day (src/lib/company-ads.ts dailySlotCounts).
  counts: Record<string, number>;
  // This company's slot-holding bookings — so the calendar can stop overlaps.
  ownBookings: SlotBooking[];
  active: JobAdBooking[];
  past: JobAdBooking[];
}) {
  const router = useRouter();
  const canBookNew = ownBookings.length < AD_MAX_ACTIVE_PER_COMPANY;
  const [mode, setMode] = useState<FormMode | null>(canBookNew && jobs.length > 0 ? { kind: "new" } : null);
  const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].id : "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [startChoice, setStartChoice] = useState<"asap" | "date">("asap");
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<JobAdBooking | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [cardPreview, setCardPreview] = useState<JobAdCardData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const editingId = mode?.kind === "edit" ? mode.booking.id : undefined;
  const asapDate = nextFreeStartFromCounts(today, counts, ownBookings, editingId);
  const startDate = startChoice === "asap" ? asapDate : pickedDate;
  const usedToday = counts[today] ?? 0;
  const nextFreeToday = nextFreeStartFromCounts(today, counts, []);
  const selectedJob = jobs.find((j) => j.id === jobId) ?? null;

  function openForm(next: FormMode) {
    setMode(next);
    setError(null);
    setSavedMessage(null);
    setFile(null);
    setPreviewUrl(null);
    if (next.kind === "new") {
      setJobId(jobs.length === 1 ? jobs[0].id : "");
      setStartChoice("asap");
      setPickedDate(null);
    } else {
      // The booking's job, if it's still live; otherwise pick again.
      setJobId(jobs.some((j) => j.id === next.booking.jobPostingId) ? next.booking.jobPostingId : "");
      // Editing keeps its date when it's still bookable; otherwise ASAP.
      const keep =
        next.kind === "edit" &&
        checkStartFromCounts(next.booking.startDate, today, counts, ownBookings, next.booking.id).ok;
      setStartChoice(keep ? "date" : "asap");
      setPickedDate(keep ? next.booking.startDate : null);
    }
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function pickFile(files: FileList | null) {
    const picked = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!picked) return;
    setError(null);
    const isImage = /^image\/(jpeg|png|webp)$/.test(picked.type);
    const isVideo = picked.type.startsWith("video/");
    if (!isImage && !isVideo) return setError("Choose a JPG, PNG or WebP image, or a video.");
    if (isImage && picked.size > IMAGE_MAX_BYTES) return setError("That image is too large (max 10 MB).");
    if (isVideo && picked.size > VIDEO_MAX_BYTES) return setError("That video is too large (max 100 MB).");
    const url = URL.createObjectURL(picked);
    if (isVideo) {
      const seconds = await videoDuration(url);
      if (seconds !== null && seconds > AD_VIDEO_MAX_SECONDS + 1) {
        URL.revokeObjectURL(url);
        return setError(`Videos can be up to ${AD_VIDEO_MAX_SECONDS} seconds — this one is ${Math.round(seconds)}s.`);
      }
    }
    setFile(picked);
    setPreviewUrl(url);
  }

  const existingMedia = mode && mode.kind !== "new" ? mode.booking : null;
  const hasMedia = !!file || !!existingMedia;
  const canSubmit = progress === null && !!mode && !!selectedJob && hasMedia && !!startDate;

  // XHR rather than fetch, for upload progress on big videos.
  function submit() {
    if (!canSubmit || !mode || !startDate || !selectedJob) return;
    setError(null);
    const form = new FormData();
    form.set("jobPostingId", selectedJob.id);
    form.set("startDate", startChoice === "asap" ? "asap" : startDate);
    if (file) form.set("media", file);
    if (mode.kind === "edit") form.set("bookingId", mode.booking.id);
    if (mode.kind === "again" && !file) form.set("reuseFromId", mode.booking.id);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/employer/job-ads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let data: { booking?: { startDate: string; endDate: string }; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.booking) {
        setSavedMessage(
          `Booked for ${formatAdRun(data.booking.startDate, data.booking.endDate)}. We'll review it before it's featured — your slot is held meanwhile.`,
        );
        setMode(null);
        setFile(null);
        setPreviewUrl(null);
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't book your job ad. Please try again.");
        // Slots (or the job's status) may have changed since the page loaded.
        router.refresh();
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Upload failed — check your connection and try again.");
    };
    setProgress(0);
    xhr.send(form);
  }

  async function remove(booking: JobAdBooking) {
    setConfirmRemove(null);
    const res = await fetch(`/api/employer/job-ads?id=${booking.id}`, { method: "DELETE" });
    if (!res.ok) return setError("Couldn't remove that booking. Please try again.");
    if (mode && mode.kind !== "new" && mode.booking.id === booking.id) setMode(null);
    router.refresh();
  }

  const previewMedia =
    file && previewUrl
      ? { mediaType: file.type.startsWith("video/") ? ("video" as const) : ("image" as const), mediaUrl: previewUrl }
      : existingMedia
        ? { mediaType: existingMedia.mediaType, mediaUrl: existingMedia.mediaUrl }
        : null;
  const uploading = progress !== null;
  const bookings = [...active, ...past];

  const cardFor = (media: { mediaType: "image" | "video"; mediaUrl: string }, job: { title: string; location: string; employmentType: string } | null): JobAdCardData => ({
    ...media,
    jobTitle: job?.title ?? "Your job title",
    companyName: company.name,
    companyLogoUrl: company.logoUrl,
    companyVerified: company.verified,
    location: job ? job.location || "Not specified" : "Location",
    jobType: job ? jobTypeLabel(job.employmentType) : "Job type",
  });

  const removeCopy = (b: JobAdBooking) =>
    b.phase === "live"
      ? { title: "Take your job ad down?", body: "It stops being featured right away, and its slot is freed for others.", action: "Take down" }
      : b.phase === "ended" || b.phase === "rejected"
        ? { title: "Remove from your list?", body: "This only removes it from your bookings history.", action: "Remove" }
        : { title: "Cancel this booking?", body: `Your slot for ${formatAdRun(b.startDate, b.endDate)} is freed for others.`, action: "Cancel booking" };

  const step = (n: number) => (
    <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-xs font-semibold text-brand-teal-dark">
      {n}
    </span>
  );

  return (
    <div className="flex flex-col gap-[20px] xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-col gap-[20px] xl:flex-[3]">
        {/* Slots at a glance */}
        <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`}>
          <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
            <div className="flex flex-wrap items-end justify-between gap-[12px]">
              <div>
                <p className="text-xs text-[#9AA3B2]">Featured job slots on the jobs page today</p>
                <p className="mt-[2px] text-xl font-semibold text-[#141B2E]">
                  {usedToday} of {AD_SLOTS} in use
                </p>
              </div>
              <p className="text-sm text-[#4B5468]">
                {usedToday < AD_SLOTS ? (
                  <>A slot is free now.</>
                ) : nextFreeToday ? (
                  <>
                    Next free start: <span className="font-medium text-brand-teal-dark">{formatAdDate(nextFreeToday)}</span>
                  </>
                ) : (
                  <>No free slot in the next {AD_BOOK_AHEAD_MONTHS} months.</>
                )}
              </p>
            </div>
            <div className="mt-[12px] grid grid-cols-10 gap-[4px]" aria-hidden>
              {Array.from({ length: AD_SLOTS }, (_, i) => (
                <span key={i} className={`h-[8px] rounded-full ${i < usedToday ? "bg-brand-teal-dark" : "bg-brand-teal-soft"}`} />
              ))}
            </div>
            <div className="mt-[14px] flex flex-wrap gap-[6px] text-xs text-[#4B5468]">
              <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px]">Each ad runs {AD_RUN_DAYS} days</span>
              <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px]">Book up to {AD_BOOK_AHEAD_MONTHS} months ahead</span>
              <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px]">Reviewed before it goes live</span>
              <span className="rounded-full bg-[#F1F4F8] px-[10px] py-[4px]">Free · first come, first served</span>
            </div>
          </div>
        </div>

        {savedMessage && (
          <p className="animate-fade-in-up rounded-[14px] border border-[#BFEDEF] bg-brand-teal-soft p-[14px] text-sm leading-[20px] text-[#0B5F63]">
            {savedMessage}
          </p>
        )}

        {/* Your bookings */}
        {bookings.length > 0 && (
          <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
            <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
              <div className="flex flex-wrap items-center justify-between gap-[8px]">
                <h2 className="text-xl font-semibold text-[#141B2E]">Your job ad bookings</h2>
                <span className="text-xs text-[#9AA3B2]">
                  {ownBookings.length} of {AD_MAX_ACTIVE_PER_COMPANY} active
                </span>
              </div>
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-col gap-[12px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[12px] sm:flex-row sm:items-center">
                    <div className="relative aspect-square w-[96px] shrink-0 overflow-hidden rounded-[10px] bg-[#E9EEF2]">
                      {b.mediaType === "video" ? (
                        <video src={b.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.mediaUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[8px]">
                        <span className={`rounded-full px-[9px] py-[3px] text-xs ${PHASE[b.phase].className}`}>{PHASE[b.phase].label}</span>
                        <span className="flex items-center gap-[5px] text-xs text-[#4B5468]">
                          <CalendarIcon className="h-[11px] w-[11px] text-[#9AA3B2]" />
                          {formatAdRun(b.startDate, b.endDate)}
                        </span>
                      </div>
                      <p className="mt-[6px] flex items-center gap-[6px] text-sm font-medium text-[#141B2E]">
                        <BriefcaseIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
                        <span className="truncate">{b.jobTitle}</span>
                      </p>
                      <p className={`mt-[2px] text-xs leading-[17px] ${b.phase === "rejected" ? "text-[#C0362C]" : "text-[#4B5468]"}`}>
                        {bookingNote(b, today)}
                      </p>
                      {!b.jobOpen && (b.phase === "pending" || b.phase === "scheduled" || b.phase === "live") && (
                        <p className="mt-[4px] text-xs leading-[17px] text-brand-gold-dark">
                          This job isn&rsquo;t open right now, so the ad is hidden. It shows again once the job is live.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-[6px] sm:flex-col sm:items-stretch">
                      {(b.phase === "pending" || b.phase === "scheduled" || b.phase === "rejected") && (
                        <button
                          type="button"
                          onClick={() => openForm({ kind: "edit", booking: b })}
                          className="rounded-full bg-brand-teal-dark px-[14px] py-[6px] text-xs text-white hover:opacity-90"
                        >
                          {b.phase === "rejected" ? "Edit & resubmit" : "Edit"}
                        </button>
                      )}
                      {b.phase === "ended" && canBookNew && jobs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openForm({ kind: "again", booking: b })}
                          className="rounded-full bg-brand-teal-dark px-[14px] py-[6px] text-xs text-white hover:opacity-90"
                        >
                          Book again
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCardPreview(
                            cardFor(b, { title: b.jobTitle, location: b.jobLocation, employmentType: b.jobEmploymentType }),
                          )
                        }
                        className="rounded-full border border-brand-teal-dark/40 bg-white px-[14px] py-[6px] text-xs text-brand-teal-dark hover:bg-brand-teal-soft"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(b)}
                        className="rounded-full border border-black/[0.1] bg-white px-[14px] py-[6px] text-xs text-[#4B5468] hover:text-[#141B2E]"
                      >
                        {removeCopy(b).action}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Book / edit */}
        <div ref={formRef} className={`animate-fade-in-up scroll-mt-[100px] ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
          <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
            {!mode ? (
              <div className="flex flex-col items-start gap-[10px]">
                <h2 className="text-xl font-semibold text-[#141B2E]">Feature a job</h2>
                {jobs.length === 0 ? (
                  <>
                    <p className="text-sm leading-[20px] text-[#4B5468]">
                      You need a live job posting to feature. Once one is approved and open, you can book it here.
                    </p>
                    <Link
                      href="/employer/jobs/postajob"
                      className="flex h-[40px] items-center justify-center rounded-full bg-brand-teal-dark px-[20px] text-sm text-white hover:opacity-90"
                    >
                      Post a job
                    </Link>
                  </>
                ) : canBookNew ? (
                  <>
                    <p className="text-sm leading-[20px] text-[#4B5468]">
                      Put one of your jobs in front of every jobseeker, above the job search, for a month.
                    </p>
                    <button
                      type="button"
                      onClick={() => openForm({ kind: "new" })}
                      className="flex h-[40px] items-center justify-center rounded-full bg-brand-teal-dark px-[20px] text-sm text-white hover:opacity-90"
                    >
                      Book a job ad
                    </button>
                  </>
                ) : (
                  <p className="text-sm leading-[20px] text-[#4B5468]">
                    You have {AD_MAX_ACTIVE_PER_COMPANY} job ad bookings — the most at once (one running, one booked next). You
                    can book again once one of them ends.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-[8px]">
                  <h2 className="text-xl font-semibold text-[#141B2E]">
                    {mode.kind === "edit" ? "Edit booking" : mode.kind === "again" ? "Book again" : "Feature a job"}
                  </h2>
                  {(mode.kind !== "new" || bookings.length > 0) && !uploading && (
                    <button type="button" onClick={() => setMode(null)} className="text-sm text-[#9AA3B2] hover:text-[#141B2E]">
                      Cancel
                    </button>
                  )}
                </div>
                <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">
                  {mode.kind === "edit"
                    ? "Changes go back to review before they show."
                    : "Three quick steps — we'll review your ad before it's featured."}
                </p>

                {/* 1. Job */}
                <div className="mt-[18px] flex gap-[12px]">
                  {step(1)}
                  <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <p className="text-sm text-[#141B2E]">
                      Job to feature <span className="text-[#E5484D]">*</span>
                    </p>
                    {jobs.length === 0 ? (
                      <p className="rounded-[12px] bg-brand-gold-soft px-[12px] py-[10px] text-xs leading-[17px] text-brand-gold-dark">
                        None of your jobs are live right now — a job ad needs an open job posting.
                      </p>
                    ) : (
                      <Dropdown
                        label="Job to feature"
                        value={jobId}
                        disabled={uploading}
                        options={[
                          { value: "", label: "Choose a live job posting" },
                          ...jobs.map((j) => ({ value: j.id, label: j.title })),
                        ]}
                        onChange={setJobId}
                      />
                    )}
                    {mode.kind !== "new" && !jobs.some((j) => j.id === mode.booking.jobPostingId) && jobs.length > 0 && (
                      <p className="text-xs text-brand-gold-dark">
                        {mode.booking.jobTitle} isn&rsquo;t open anymore — choose another live job.
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Artwork */}
                <div className="mt-[16px] flex gap-[12px]">
                  {step(2)}
                  <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <p className="text-sm text-[#141B2E]">
                      Artwork <span className="text-[#E5484D]">*</span>
                    </p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/*"
                      className="hidden"
                      onChange={(e) => pickFile(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => inputRef.current?.click()}
                      className="flex min-h-[84px] w-full flex-col items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-black/[0.15] px-[16px] py-[12px] text-sm text-[#4B5468] hover:border-brand-teal-dark hover:text-brand-teal-dark disabled:opacity-60"
                    >
                      <ImageIcon className="h-[20px] w-[20px]" />
                      {file ? `Selected: ${file.name}` : existingMedia ? "Using your current artwork — click to replace" : "Upload image or video"}
                    </button>
                    <p className="text-xs text-[#9AA3B2]">
                      A square (1:1) design works best — e.g. 1080 × 1080. JPG, PNG or WebP up to 10 MB, or a video up to{" "}
                      {AD_VIDEO_MAX_SECONDS} seconds (100 MB).
                    </p>
                  </div>
                </div>

                {/* 3. Start date */}
                <div className="mt-[16px] flex gap-[12px]">
                  {step(3)}
                  <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
                    <p className="text-sm text-[#141B2E]">When should it start?</p>
                    <div className="grid gap-[8px] sm:grid-cols-2" role="radiogroup">
                      {(
                        [
                          {
                            key: "asap" as const,
                            title: "As soon as possible",
                            detail: asapDate ? `Starts ${formatAdDate(asapDate)}` : "No free slot in the next 3 months",
                          },
                          {
                            key: "date" as const,
                            title: "Pick a date",
                            detail: pickedDate ? `Starts ${formatAdDate(pickedDate)}` : `Up to ${AD_BOOK_AHEAD_MONTHS} months ahead`,
                          },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          role="radio"
                          aria-checked={startChoice === opt.key}
                          disabled={uploading}
                          onClick={() => setStartChoice(opt.key)}
                          className={`flex items-start gap-[10px] rounded-[14px] border p-[12px] text-left transition-colors ${
                            startChoice === opt.key
                              ? "border-brand-teal-dark bg-[#F2FBFB]"
                              : "border-[#EAEDF2] bg-white hover:border-black/[0.15]"
                          }`}
                        >
                          <span
                            className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border ${
                              startChoice === opt.key ? "border-brand-teal-dark" : "border-black/[0.2]"
                            }`}
                          >
                            {startChoice === opt.key && <span className="h-[8px] w-[8px] rounded-full bg-brand-teal-dark" />}
                          </span>
                          <span>
                            <span className="block text-sm text-[#141B2E]">{opt.title}</span>
                            <span className="block text-xs text-[#4B5468]">{opt.detail}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {startChoice === "date" && (
                      <AdSlotCalendar
                        today={today}
                        value={pickedDate}
                        onChange={setPickedDate}
                        counts={counts}
                        ownBookings={ownBookings}
                        excludeId={editingId}
                      />
                    )}

                    {startDate && (
                      <div className="flex items-start gap-[10px] rounded-[14px] bg-[#F8FAFB] p-[12px]">
                        <CalendarIcon className="mt-[2px] h-[14px] w-[14px] shrink-0 text-brand-teal-dark" />
                        <p className="text-sm leading-[20px] text-[#4B5468]">
                          Runs <span className="font-medium text-[#141B2E]">{formatAdRun(startDate, runEndDate(startDate))}</span> ·{" "}
                          {AD_RUN_DAYS} days. Your slot is held while we review your ad.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {error && <p className="mt-[12px] text-sm text-red-500">{error}</p>}

                {uploading && (
                  <div className="mt-[12px]">
                    <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#EAEDF2]">
                      <div className="h-full bg-brand-teal-dark transition-[width]" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-[6px] text-xs text-[#4B5468]">
                      {progress! < 100 ? `Uploading… ${progress}%` : file?.type.startsWith("video/") ? "Processing video…" : "Saving…"}
                    </p>
                  </div>
                )}

                <div className="mt-[16px] flex flex-wrap items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="flex h-[40px] items-center justify-center rounded-full bg-brand-teal-dark px-[20px] text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {mode.kind === "edit" ? "Save & resubmit for review" : "Book & submit for review"}
                  </button>
                  {!canSubmit && !uploading && (
                    <p className="text-xs text-[#9AA3B2]">
                      {!selectedJob ? "Choose a job" : !hasMedia ? "Add your artwork" : !startDate ? "Choose a start date" : ""}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview + how it works */}
      <div className="flex min-w-0 flex-col gap-[20px] xl:sticky xl:top-[22px] xl:flex-[2]">
        <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "60ms" }}>
          <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
            <p className="text-sm text-[#141B2E]">Preview</p>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">How your job appears in Featured jobs, above the job search.</p>
            <div className="mt-[14px] rounded-[16px] bg-brand-gold-page p-[16px]">
              <div className="mx-auto w-full max-w-[260px]">
                {previewMedia ? (
                  <JobAdCard ad={cardFor(previewMedia, selectedJob)} />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-[20px] border border-dashed border-black/[0.12] bg-white px-[20px] text-center text-xs text-[#9AA3B2]">
                    Upload your artwork to see your job ad here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`animate-fade-in-up ${gradientFrameClass("teal")}`} style={{ animationDelay: "120ms" }}>
          <div className="rounded-[19px] bg-white p-[16px] text-left sm:p-[22px]">
            <p className="text-sm text-[#141B2E]">How it works</p>
            <ol className="mt-[10px] flex flex-col gap-[10px]">
              {[
                ["Pick a job and add artwork", "Choose one of your live jobs and upload a square image or short video."],
                ["We review your ad", "Your slot is held meanwhile. If it isn't reviewed in time, it moves to the next free date."],
                ["It's featured for a month", `Shown above the job search for ${AD_RUN_DAYS} days, while the job stays open.`],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-[10px]">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-teal-soft text-xs font-semibold text-brand-teal-dark">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-sm text-[#141B2E]">{title}</span>
                    <span className="block text-xs leading-[17px] text-[#4B5468]">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-[12px] border-t border-black/[0.06] pt-[10px] text-xs leading-[17px] text-[#9AA3B2]">
              {AD_SLOTS} featured job slots in total · up to {AD_MAX_ACTIVE_PER_COMPANY} bookings per company, never overlapping.
            </p>
          </div>
        </div>
      </div>

      {cardPreview && (
        <Modal onClose={() => setCardPreview(null)} ariaLabel="Job ad preview">
          <p className="text-sm font-semibold text-[#141B2E]">Featured job preview</p>
          <p className="mt-[2px] text-xs text-[#9AA3B2]">As jobseekers see it above the job search.</p>
          <div className="mt-[14px] rounded-[16px] bg-brand-gold-page p-[16px]">
            <div className="mx-auto w-full max-w-[260px]">
              <JobAdCard ad={cardPreview} />
            </div>
          </div>
        </Modal>
      )}

      {confirmRemove && (
        <Modal onClose={() => setConfirmRemove(null)} ariaLabel={removeCopy(confirmRemove).title}>
          <p className="text-sm font-semibold text-[#141B2E]">{removeCopy(confirmRemove).title}</p>
          <p className="mt-[6px] text-sm leading-[20px] text-[#4B5468]">{removeCopy(confirmRemove).body}</p>
          <div className="mt-[18px] flex gap-[8px]">
            <button
              type="button"
              onClick={() => setConfirmRemove(null)}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full border border-black/[0.1] text-sm text-[#141B2E] hover:bg-black/[0.03]"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => remove(confirmRemove)}
              className="flex h-[40px] flex-1 items-center justify-center rounded-full bg-[#E5484D] text-sm text-white hover:opacity-90"
            >
              {removeCopy(confirmRemove).action}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

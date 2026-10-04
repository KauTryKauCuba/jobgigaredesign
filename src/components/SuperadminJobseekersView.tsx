"use client";

import { useMemo, useState } from "react";
import Dropdown from "./Dropdown";
import Modal from "./Modal";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { SearchIcon, UserIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

type JobseekerRow = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
  location: string;
  targetRole: string;
  jobAlertsEnabled: boolean;
  createdAt: string;
  applicationCount: number;
  savedJobCount: number;
  coverLetterCount: number;
  videoPitch: {
    id: string;
    durationSeconds: number;
    visible: boolean;
    intro: string | null;
    updatedAt: string;
  } | null;
};

type FilterKey = "all" | "pitch" | "noApplications";
const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "All jobseekers" },
  { value: "pitch", label: "With a video pitch" },
  { value: "noApplications", label: "Haven't applied yet" },
];

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Avatar({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#F1ECFB] text-[#7C5CD1]">
        <UserIcon className="h-[16px] w-[16px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />;
}

const pill = "rounded-full px-[9px] py-[3px] text-xs";

export default function SuperadminJobseekersView({
  authUser,
  jobseekers,
}: {
  authUser: AuthUser;
  jobseekers: JobseekerRow[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [watching, setWatching] = useState<JobseekerRow | null>(null);
  const searchTerm = search.trim().toLowerCase();

  const visible = useMemo(
    () =>
      jobseekers.filter((j) => {
        if (filter === "pitch" && !j.videoPitch) return false;
        if (filter === "noApplications" && j.applicationCount > 0) return false;
        if (!searchTerm) return true;
        return [j.fullName, j.email, j.phone, j.location, j.targetRole]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(searchTerm));
      }),
    [jobseekers, filter, searchTerm],
  );

  const pitchCount = jobseekers.filter((j) => j.videoPitch).length;

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="jobseekers"
      heading="Jobseekers"
      subheading="Every jobseeker account on the platform — and which features they're using."
    >
      <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
        <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <p className="text-sm text-[#141B2E]">All jobseekers</p>
            <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">{jobseekers.length}</span>
            {pitchCount > 0 && (
              <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-[#A67C00]">
                🎥 {pitchCount} with a video pitch
              </span>
            )}
          </div>

          <div className="mt-[14px] flex flex-col gap-[8px] sm:flex-row">
            <div className="flex flex-1 items-center gap-[8px] rounded-[12px] border border-black/[0.1] px-[12px] focus-within:border-brand-teal-dark">
              <SearchIcon className="h-[13px] w-[13px] shrink-0 text-[#9AA3B2]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, role or location..."
                aria-label="Search jobseekers"
                className="h-[38px] w-full bg-transparent text-sm text-[#141B2E] outline-none placeholder:text-[#9AA3B2]"
              />
            </div>
            <div className="sm:w-[220px]">
              <Dropdown label="Show" value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
            </div>
          </div>

          {jobseekers.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">No jobseekers have signed up yet.</p>
          ) : visible.length === 0 ? (
            <p className="mt-[14px] text-sm text-[#9AA3B2]">No jobseekers match these filters.</p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {visible.map((jobseeker) => (
                <div
                  key={jobseeker.id}
                  className="flex flex-col gap-[10px] rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-[10px]">
                    <Avatar url={jobseeker.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#141B2E]">{jobseeker.fullName}</p>
                      <p className="mt-[1px] truncate text-xs text-[#4B5468]">
                        {jobseeker.targetRole || "No target role set"} · {jobseeker.location || "Location not set"}
                      </p>
                      <p className="mt-[1px] truncate text-xs text-[#9AA3B2]">
                        {jobseeker.email}
                        {jobseeker.phone ? ` · ${jobseeker.phone}` : ""}
                      </p>
                      <div className="mt-[6px] flex flex-wrap gap-[6px]">
                        {jobseeker.videoPitch && (
                          <button
                            type="button"
                            onClick={() => setWatching(jobseeker)}
                            className={`${pill} bg-[#FFF3D6] text-[#A67C00] hover:opacity-80`}
                          >
                            ▶ Video pitch ({formatDuration(jobseeker.videoPitch.durationSeconds)})
                            {!jobseeker.videoPitch.visible && " · hidden"}
                          </button>
                        )}
                        {jobseeker.savedJobCount > 0 && (
                          <span className={`${pill} bg-[#FCE7EF] text-[#C2416B]`}>
                            ♥ {jobseeker.savedJobCount} saved
                          </span>
                        )}
                        {jobseeker.coverLetterCount > 0 && (
                          <span className={`${pill} bg-[#E6F9FA] text-brand-teal-dark`}>
                            {jobseeker.coverLetterCount} cover letter{jobseeker.coverLetterCount === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className={`${pill} ${jobseeker.jobAlertsEnabled ? "bg-[#E7F6EC] text-[#2F7D4F]" : "bg-[#F1F4F8] text-[#9AA3B2]"}`}>
                          Job alerts {jobseeker.jobAlertsEnabled ? "on" : "off"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[10px] text-xs text-[#9AA3B2] sm:flex-col sm:items-end sm:gap-[4px]">
                    <span className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark">
                      {jobseeker.applicationCount} application{jobseeker.applicationCount === 1 ? "" : "s"}
                    </span>
                    <span>Joined {new Date(jobseeker.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {watching?.videoPitch && (
        <Modal ariaLabel={`${watching.fullName}'s video pitch`} onClose={() => setWatching(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">{watching.fullName}&rsquo;s video pitch</h2>
          <p className="mt-[4px] text-xs text-[#9AA3B2]">
            Moderation view — watching here is never shown to the jobseeker or counted as an employer view.
            {!watching.videoPitch.visible && " This pitch is currently hidden from employers."}
          </p>
          {watching.videoPitch.intro && (
            <p className="mt-[10px] text-sm text-[#141B2E]">&ldquo;{watching.videoPitch.intro}&rdquo;</p>
          )}
          <video
            key={watching.videoPitch.id}
            src={`/api/video-pitches/${watching.videoPitch.id}/stream?v=${encodeURIComponent(watching.videoPitch.updatedAt)}`}
            controls
            autoPlay
            playsInline
            className="mt-[12px] max-h-[60vh] w-full rounded-[12px] bg-black object-contain"
          />
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}

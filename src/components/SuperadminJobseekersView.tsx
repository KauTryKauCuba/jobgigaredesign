"use client";

import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { UserIcon } from "./icons";
import type { AuthUser } from "./AuthModal";

type JobseekerRow = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
  phone: string | null;
  location: string;
  targetRole: string;
  createdAt: string;
  applicationCount: number;
};

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

export default function SuperadminJobseekersView({
  authUser,
  jobseekers,
}: {
  authUser: AuthUser;
  jobseekers: JobseekerRow[];
}) {
  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="jobseekers"
      heading="Jobseekers"
      subheading="Every jobseeker account registered on the platform."
    >
      <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
        <div className="rounded-[19px] bg-white p-[22px]">
          <div className="flex items-center gap-[8px]">
            <p className="text-sm text-[#141B2E]">All jobseekers</p>
            <span className="rounded-full bg-[#F1ECFB] px-[10px] py-[3px] text-xs text-[#7C5CD1]">
              {jobseekers.length}
            </span>
          </div>

          {jobseekers.length === 0 ? (
            <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
              No jobseekers have signed up yet.
            </p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {jobseekers.map((jobseeker) => (
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
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-[10px] text-xs text-[#9AA3B2] sm:flex-col sm:items-end sm:gap-[2px]">
                    <span className="rounded-full bg-[#E6F9FA] px-[10px] py-[3px] text-xs text-brand-teal-dark">
                      {jobseeker.applicationCount} application{jobseeker.applicationCount === 1 ? "" : "s"}
                    </span>
                    <span>Joined {new Date(jobseeker.createdAt).toLocaleDateString("en-US")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperadminDashboardShell>
  );
}

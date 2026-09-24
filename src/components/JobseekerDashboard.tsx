import Link from "next/link";
import JobseekerDashboardShell from "./JobseekerDashboardShell";
import { gradientFrameClass } from "./formStyles";
import { APPLICATION_STATUS_COLOR, APPLICATION_STATUS_LABEL, relativeTimeAgo } from "@/lib/applicationStatus";
import type { AuthUser } from "./AuthModal";

type ActivePostingRow = {
  posting: {
    id: string;
    slug: string;
    title: string;
    industry: string | null;
    employmentType: string;
    workArrangement: string;
    location: string;
    salaryMin: number | null;
    salaryMax: number | null;
    skills: string[];
  };
  companyName: string;
};

type ApplicationRow = {
  application: {
    id: string;
    status: string;
    appliedAt: string;
  };
  posting: {
    id: string;
    title: string;
    location: string;
  };
  companyName: string;
};

const DASHBOARD_APPLICATION_PREVIEW_COUNT = 3;

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};
const WORK_ARRANGEMENT_LABEL: Record<string, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

export default function JobseekerDashboard({
  authUser,
  resume,
  activePostings,
  applications,
}: {
  authUser: AuthUser;
  resume: { fileName: string; fileSize: number | null } | null;
  activePostings: ActivePostingRow[];
  applications: ApplicationRow[];
}) {
  const firstName = authUser.name?.split(" ")[0] ?? "there";

  return (
    <JobseekerDashboardShell
      authUser={authUser}
      active="overview"
      heading={`Welcome back, ${firstName}`}
      subheading="Keep your profile fresh so employers see your best fit."
      resume={resume}
    >
      <div className="flex flex-col gap-[20px]">
        <div className={gradientFrameClass("gold")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <div className="flex items-center justify-between gap-[8px]">
              <div className="flex items-center gap-[8px]">
                <p className="text-sm text-[#141B2E]">My applications</p>
                <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-brand-gold-dark">
                  {applications.length}
                </span>
              </div>
              {applications.length > 0 && (
                <Link
                  href="/jobseeker/applications"
                  className="text-sm text-brand-gold-dark hover:underline"
                >
                  View all
                </Link>
              )}
            </div>

            {applications.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                You haven&rsquo;t applied to anything yet — jobs you apply to will show up here.
              </p>
            ) : (
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {applications.slice(0, DASHBOARD_APPLICATION_PREVIEW_COUNT).map(({ application, posting, companyName }) => {
                  const color = APPLICATION_STATUS_COLOR[application.status] ?? APPLICATION_STATUS_COLOR.applied;
                  return (
                    <div
                      key={application.id}
                      className="flex flex-col gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#141B2E]">{posting.title}</p>
                        <p className="mt-[2px] text-xs text-[#4B5468]">
                          {companyName} · {posting.location || "Location not set"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-[10px]">
                        <span className="text-xs text-[#9AA3B2]">
                          Applied {relativeTimeAgo(application.appliedAt)}
                        </span>
                        <span
                          className={`rounded-full px-[10px] py-[3px] text-xs ${color.bg} ${color.text}`}
                        >
                          {APPLICATION_STATUS_LABEL[application.status] ?? application.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={gradientFrameClass("gold")}>
          <div className="rounded-[19px] bg-white p-[22px]">
            <div className="flex items-center gap-[8px]">
              <p className="text-sm text-[#141B2E]">Jobs hiring now</p>
              <span className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-brand-gold-dark">
                {activePostings.length}
              </span>
            </div>

            {activePostings.length === 0 ? (
              <p className="mt-[14px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">
                No active postings yet — check back soon.
              </p>
            ) : (
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {activePostings.map(({ posting, companyName }) => (
                  <Link
                    key={posting.id}
                    href={`/jobseeker/jobs/${posting.slug}`}
                    className="flex flex-col gap-[8px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px] transition-colors hover:bg-[#F1F4F8] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#141B2E]">{posting.title}</p>
                      <p className="mt-[2px] text-xs text-[#4B5468]">{companyName}</p>
                      <div className="mt-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-xs text-[#4B5468]">
                        <span>{posting.location || "Location not set"}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{EMPLOYMENT_TYPE_LABEL[posting.employmentType] ?? posting.employmentType}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>{WORK_ARRANGEMENT_LABEL[posting.workArrangement] ?? posting.workArrangement}</span>
                        <span className="text-[#C7CDD7]">·</span>
                        <span>
                          {posting.salaryMin && posting.salaryMax
                            ? `RM${posting.salaryMin.toLocaleString()}–${posting.salaryMax.toLocaleString()}`
                            : "Salary not disclosed"}
                        </span>
                      </div>
                      {posting.skills.length > 0 && (
                        <div className="mt-[8px] flex flex-wrap gap-[6px]">
                          {posting.skills.slice(0, 5).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-[#FFF3D6] px-[10px] py-[3px] text-xs text-brand-gold-dark"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </JobseekerDashboardShell>
  );
}

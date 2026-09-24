import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import SuperadminDashboardShell from "@/components/SuperadminDashboardShell";
import { getAuthUser } from "@/lib/auth-user";
import { db } from "@/lib/db";
import { employerProfiles, jobPostings, jobseekerProfiles } from "@/lib/db/schema";
import { isSuperadminEmail } from "@/lib/superadmin";

async function countJobPostingsByStatus(status: "pending" | "active" | "flagged" | "rejected") {
  const [row] = await db
    .select({ value: count() })
    .from(jobPostings)
    .where(eq(jobPostings.status, status));
  return row?.value ?? 0;
}

export default async function SuperadminDashboardPage() {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const [pending, active, flagged, rejected, employerCount, jobseekerCount] = await Promise.all([
    countJobPostingsByStatus("pending"),
    countJobPostingsByStatus("active"),
    countJobPostingsByStatus("flagged"),
    countJobPostingsByStatus("rejected"),
    db.select({ value: count() }).from(employerProfiles).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(jobseekerProfiles).then((r) => r[0]?.value ?? 0),
  ]);

  const tiles = [
    { label: "Pending review", value: pending, urgent: pending > 0 },
    { label: "Active postings", value: active, urgent: false },
    { label: "Flagged postings", value: flagged, urgent: flagged > 0 },
    { label: "Rejected postings", value: rejected, urgent: false },
    { label: "Employers", value: employerCount, urgent: false },
    { label: "Jobseekers", value: jobseekerCount, urgent: false },
  ];

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="overview"
      heading="Superadmin"
      subheading="Platform-wide overview — job posting review queue and account counts."
    >
      <div className="rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]">
        <div className="rounded-[19px] bg-white p-[22px]">
          <p className="mb-[12px] text-sm text-[#141B2E]">Platform at a glance</p>
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className={`flex flex-col gap-[4px] rounded-[14px] border p-[14px] ${
                  tile.urgent ? "border-[#FBE7B3] bg-[#FFF3D6]" : "border-[#EAEDF2] bg-[#F8FAFB]"
                }`}
              >
                <span className="text-xl text-[#141B2E]">{tile.value}</span>
                <span className={`text-xs ${tile.urgent ? "text-[#A67C00]" : "text-[#4B5468]"}`}>
                  {tile.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SuperadminDashboardShell>
  );
}

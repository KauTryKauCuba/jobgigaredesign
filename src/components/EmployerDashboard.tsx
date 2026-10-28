"use client";

import { useRouter } from "next/navigation";
import EmployerDashboardShell from "./EmployerDashboardShell";
import EmployerDashboardOverview, { type DashboardData } from "./EmployerDashboardOverview";
import type { CriteriaFlags } from "./MatchSettingsModal";
import type { AuthUser } from "./AuthModal";
import { hasFullAccess } from "@/lib/team-roles";

export default function EmployerDashboard({
  authUser,
  dashboardData,
  loadError,
  initialSmartMatchEnabled,
  initialCriteria,
}: {
  authUser: AuthUser;
  dashboardData: DashboardData | null;
  loadError?: boolean;
  initialSmartMatchEnabled: boolean;
  initialCriteria: CriteriaFlags;
}) {
  const router = useRouter();
  // A Hiring manager's dashboard covers only their assigned jobs.
  const canManage = hasFullAccess(authUser.teamRole ?? "owner");
  const firstName = authUser.name?.split(" ")[0] ?? "there";

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="overview"
      heading={`Welcome back, ${firstName}`}
      headerAction={
        <div className="flex flex-wrap items-center gap-[8px]">
          {canManage && (
            <button
              type="button"
              onClick={() => router.push("/employer/jobs/postajob")}
              className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark px-[22px] text-sm text-white transition-opacity hover:opacity-90"
            >
              Post a job
            </button>
          )}
        </div>
      }
      subheading={
        canManage
          ? "Manage your company profile and keep your hiring details up to date."
          : "Applicants and interviews for the jobs you're the hiring manager for."
      }
    >
      {loadError || !dashboardData ? (
        <div className="rounded-[14px] border border-[#EAD9D6] bg-[#FBF3F1] p-[16px] text-center text-sm text-[#A66A61]">
          Couldn&rsquo;t load your dashboard right now. Try refreshing the page.
        </div>
      ) : (
        <EmployerDashboardOverview
          data={dashboardData}
          initialSmartMatchEnabled={initialSmartMatchEnabled}
          initialCriteria={initialCriteria}
          canManage={canManage}
        />
      )}
    </EmployerDashboardShell>
  );
}

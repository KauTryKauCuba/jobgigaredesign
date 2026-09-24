"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EmployerDashboardShell from "./EmployerDashboardShell";
import EmployerDashboardOverview, { type DashboardData } from "./EmployerDashboardOverview";
import type { CriteriaFlags } from "./MatchSettingsModal";
import type { AuthUser } from "./AuthModal";

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
  const [refreshing, setRefreshing] = useState(false);
  const firstName = authUser.name?.split(" ")[0] ?? "there";

  function refresh() {
    setRefreshing(true);
    router.refresh();
    // router.refresh() doesn't return a promise we can await — this is just
    // enough to give the button a brief pressed/disabled state so a click
    // registers as having done something.
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <EmployerDashboardShell
      authUser={authUser}
      active="overview"
      heading={`Welcome back, ${firstName}`}
      headerAction={
        <div className="flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            disabled={refreshing}
            onClick={refresh}
            className="flex h-[38px] items-center justify-center rounded-full border border-black/[0.1] px-[16px] text-sm text-[#141B2E] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/employer/jobs/postajob")}
            className="flex h-[38px] items-center justify-center rounded-full bg-brand-teal-dark px-[22px] text-sm text-white transition-opacity hover:opacity-90"
          >
            Post a job
          </button>
        </div>
      }
      subheading="Manage your company profile and keep your hiring details up to date."
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
        />
      )}
    </EmployerDashboardShell>
  );
}

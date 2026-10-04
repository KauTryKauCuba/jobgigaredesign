import Link from "next/link";
import { redirect } from "next/navigation";
import SuperadminDashboardShell from "@/components/SuperadminDashboardShell";
import { getPlatformAiUsage } from "@/lib/ai-usage";
import { getAuthUser } from "@/lib/auth-user";
import { isSuperadminEmail } from "@/lib/superadmin";

const RANGES = [7, 30, 90] as const;

function usd(value: number) {
  if (value === 0) return "$0.00";
  return value < 0.01 ? "<$0.01" : `$${value.toFixed(2)}`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const frame =
  "rounded-[20px] bg-gradient-to-br from-brand-teal via-white to-brand-teal p-px shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(20,27,46,0.2)]";

export default async function SuperadminAiUsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || !isSuperadminEmail(authUser.email)) redirect("/");

  const requested = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const usage = await getPlatformAiUsage(days);
  const maxDailyCost = Math.max(...usage.series.map((d) => d.costUsd), 0.000001);
  const maxDailyCalls = Math.max(...usage.series.map((d) => d.calls), 1);
  const chartByCost = usage.totals.costUsd > 0;

  const tiles = [
    { label: `Estimated cost · last ${days} days`, value: usd(usage.totals.costUsd) },
    { label: `AI calls · last ${days} days`, value: compact(usage.totals.calls) },
    { label: `Tokens · last ${days} days`, value: compact(usage.totals.tokens) },
    { label: "Today", value: `${usage.today.calls} calls · ${usd(usage.today.costUsd)}` },
  ];

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="ai-usage"
      heading="AI Usage"
      subheading="Every AI call across the platform — what it's used for, who uses it most, and roughly what it costs."
      headerAction={
        <div className="flex rounded-full bg-[#F1F4F8] p-[3px]">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/superadmin/ai-usage?days=${r}`}
              className={`rounded-full px-[14px] py-[6px] text-xs transition-colors ${
                r === days ? "bg-white text-[#141B2E] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#4B5468] hover:text-[#141B2E]"
              }`}
            >
              {r} days
            </Link>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-[20px]">
        <div className={frame}>
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div className="grid grid-cols-2 gap-[12px] lg:grid-cols-4">
              {tiles.map((tile) => (
                <div key={tile.label} className="flex flex-col gap-[4px] rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                  <span className="text-xl text-[#141B2E]">{tile.value}</span>
                  <span className="text-xs text-[#4B5468]">{tile.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-[22px]">
              <p className="text-sm text-[#141B2E]">
                {chartByCost ? "Estimated cost per day" : "AI calls per day"}
              </p>
              <div className="mt-[12px] flex h-[140px] items-end gap-[2px] border-b border-[#EAEDF2]">
                {usage.series.map((d) => {
                  const ratio = chartByCost ? d.costUsd / maxDailyCost : d.calls / maxDailyCalls;
                  return (
                    <div key={d.day} className="group relative flex h-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-[3px] bg-brand-teal-dark/70 transition-colors group-hover:bg-brand-teal-dark"
                        style={{ height: `${Math.max(ratio * 100, d.calls > 0 ? 3 : 0)}%` }}
                      />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-[6px] hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#141B2E] px-[8px] py-[4px] text-[11px] text-white group-hover:block">
                        {new Date(`${d.day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·{" "}
                        {d.calls} calls · {usd(d.costUsd)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-[4px] flex justify-between text-[11px] text-[#9AA3B2]">
                <span>{new Date(`${usage.series[0].day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[20px] xl:grid-cols-2">
          <div className={frame}>
            <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
              <p className="text-sm text-[#141B2E]">By feature</p>
              {usage.features.length === 0 ? (
                <p className="mt-[12px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">No AI calls in this period.</p>
              ) : (
                <div className="mt-[12px] flex flex-col gap-[10px]">
                  {usage.features.map((f) => {
                    const share = usage.totals.calls > 0 ? f.calls / usage.totals.calls : 0;
                    return (
                      <div key={f.feature}>
                        <div className="flex items-baseline justify-between gap-[8px] text-xs">
                          <span className="text-[#141B2E]">{f.label}</span>
                          <span className="whitespace-nowrap text-[#4B5468]">
                            {f.calls} calls · {usd(f.costUsd)}
                          </span>
                        </div>
                        <div className="mt-[4px] h-[6px] overflow-hidden rounded-full bg-[#F1F4F8]">
                          <div className="h-full rounded-full bg-brand-teal-dark/70" style={{ width: `${Math.max(share * 100, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={frame}>
            <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
              <p className="text-sm text-[#141B2E]">Top users</p>
              {usage.topUsers.length === 0 ? (
                <p className="mt-[12px] rounded-[14px] bg-[#F8FAFB] p-[16px] text-xs text-[#9AA3B2]">No AI calls in this period.</p>
              ) : (
                <div className="mt-[12px] flex flex-col gap-[6px]">
                  {usage.topUsers.map((u, i) => (
                    <div key={u.userId} className="flex items-center gap-[10px] rounded-[12px] bg-[#F8FAFB] px-[12px] py-[8px]">
                      <span className="w-[18px] shrink-0 text-xs text-[#9AA3B2]">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#141B2E]">{u.name || u.email || "Deleted account"}</p>
                        <p className="truncate text-xs text-[#9AA3B2]">
                          {u.email}
                          {u.role ? ` · ${u.role}` : ""}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-[#4B5468]">
                        {u.calls} calls · {usd(u.costUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs leading-[18px] text-[#9AA3B2]">
          Costs are estimates from published list prices (MiMo&rsquo;s rate is unverified) — check each provider&rsquo;s own
          dashboard for real spend. Each cover letter or resume parse races two providers, so one request can log two calls.
        </p>
      </div>
    </SuperadminDashboardShell>
  );
}

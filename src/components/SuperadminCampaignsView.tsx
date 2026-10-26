"use client";

import Link from "next/link";
import { gradientFrameClass } from "./formStyles";
import SuperadminDashboardShell from "./SuperadminDashboardShell";
import { periodText, PhasePill, primaryBtn, sideStyle } from "./SuperadminCampaignParts";
import { PlusIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import { CAMPAIGN_AUDIENCES, LOW_STOCK_THRESHOLD, SIDE_LABEL, type Campaign } from "@/lib/campaigns-shared";

function SideSummary({ campaign, audience }: { campaign: Campaign; audience: (typeof CAMPAIGN_AUDIENCES)[number] }) {
  const reward = campaign.rewards[audience];
  const stats = campaign.stats[audience];
  const gold = audience === "jobseeker";
  if (!reward.enabled && stats.claims === 0) {
    return (
      <div className="rounded-[12px] border border-[#EAEDF2] bg-[#F8FAFB] p-[10px]">
        <p className="text-xs text-[#9AA3B2]">{SIDE_LABEL[audience]}</p>
        <p className="mt-[2px] text-sm text-[#9AA3B2]">No reward</p>
      </div>
    );
  }
  const lowStock = reward.type === "voucher" && campaign.phase !== "finished" && campaign.phase !== "draft" && stats.codesAvailable < LOW_STOCK_THRESHOLD;
  return (
    <div
      style={sideStyle(audience)}
      className={`rounded-[12px] border p-[10px] ${gold ? "border-brand-gold-soft bg-brand-gold-page" : "border-brand-teal-soft bg-brand-teal-page"}`}
    >
      <p className={`text-xs ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>
        {SIDE_LABEL[audience]} · {reward.type === "voucher" ? "🎟️ Voucher" : "🎁 Lucky draw"}
      </p>
      <p className="mt-[2px] truncate text-sm text-[#141B2E]">{reward.title || "Not set up yet"}</p>
      {campaign.phase !== "draft" && (
        <p className="mt-[4px] text-xs text-[#4B5468]">
          {reward.type === "voucher"
            ? `${stats.approved} given · ${stats.codesAvailable} codes left`
            : `${stats.claims} entr${stats.claims === 1 ? "y" : "ies"}`}
        </p>
      )}
      {lowStock && <p className="mt-[4px] text-xs text-[#A67C00]">⚠ {stats.codesAvailable === 0 ? "Out of codes" : "Running low on codes"}</p>}
    </div>
  );
}

export default function SuperadminCampaignsView({ authUser, initialCampaigns }: { authUser: AuthUser; initialCampaigns: Campaign[] }) {
  const campaigns = initialCampaigns;

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="campaigns"
      heading="Campaigns"
      headerAction={
        campaigns.length > 0 ? (
          <Link href="/superadmin/campaigns/new" className={primaryBtn}>
            <PlusIcon className="h-[12px] w-[12px]" />
            New campaign
          </Link>
        ) : undefined
      }
      subheading="Reward employers and jobseekers for verifying their phone number — with a voucher code or a lucky draw entry."
    >
      {campaigns.length === 0 ? (
        <div className={gradientFrameClass("teal")}>
          <div className="rounded-[19px] bg-white p-[20px] sm:p-[28px]">
            <h2 className="text-lg font-semibold text-[#141B2E]">Run your first campaign</h2>
            <p className="mt-[4px] text-sm text-[#4B5468]">Give people a reason to verify their phone number. It takes a few minutes:</p>
            <ol className="mt-[18px] grid grid-cols-1 gap-[12px] md:grid-cols-3">
              {[
                ["1", "Set it up", "Name it, then choose what employers and jobseekers get: a voucher code or a lucky draw entry."],
                ["2", "Go live", "Everyone who verifies their phone gets the reward — including people who verified before."],
                ["3", "Follow “What to do next”", "The campaign page tells you when to approve vouchers, add codes or pick winners."],
              ].map(([n, title, text]) => (
                <li key={n} className="rounded-[14px] border border-[#EAEDF2] bg-[#F8FAFB] p-[14px]">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand-teal-dark text-xs text-white">{n}</span>
                  <p className="mt-[10px] text-sm text-[#141B2E]">{title}</p>
                  <p className="mt-[4px] text-xs leading-[18px] text-[#4B5468]">{text}</p>
                </li>
              ))}
            </ol>
            <Link href="/superadmin/campaigns/new" className={`${primaryBtn} mt-[20px] inline-flex`}>
              <PlusIcon className="h-[12px] w-[12px]" />
              Create a campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {campaigns.map((c) => {
            const waiting = CAMPAIGN_AUDIENCES.reduce((n, a) => n + c.stats[a].pending, 0);
            const toPick = CAMPAIGN_AUDIENCES.some(
              (a) => c.phase === "finished" && c.rewards[a].type === "draw" && c.stats[a].claims > 0 && !c.rewards[a].announcedAt,
            );
            return (
              <Link
                key={c.id}
                href={`/superadmin/campaigns/${c.id}`}
                className="block rounded-[20px] border border-[#EAEDF2] bg-white p-[16px] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,27,46,0.25)] sm:p-[20px]"
              >
                <div className="flex flex-wrap items-start justify-between gap-[10px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-[8px]">
                      <h2 className="truncate text-base font-semibold text-[#141B2E]">{c.name}</h2>
                      <PhasePill phase={c.phase} />
                      {waiting > 0 && <span className="rounded-full bg-brand-teal-dark px-[9px] py-[2px] text-xs text-white">{waiting} waiting for approval</span>}
                      {toPick && <span className="rounded-full bg-brand-teal-dark px-[9px] py-[2px] text-xs text-white">Pick winners</span>}
                    </div>
                    <p className="mt-[4px] text-xs text-[#9AA3B2]">{periodText(c)}</p>
                  </div>
                  <span className="text-sm text-brand-teal-dark">{c.phase === "draft" ? "Continue setup →" : "Open →"}</span>
                </div>
                <div className="mt-[14px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                  {CAMPAIGN_AUDIENCES.map((a) => (
                    <SideSummary key={a} campaign={c} audience={a} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SuperadminDashboardShell>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CodeList, CodeUploader } from "./CampaignCodes";
import CampaignPeople, { type PeopleFilter } from "./CampaignPeople";
import CampaignWizard, { firstOpenStep } from "./CampaignWizard";
import { gradientFrameClass } from "./formStyles";
import Modal from "./Modal";
import SuperadminDashboardShell, { setPendingRewardCount } from "./SuperadminDashboardShell";
import { btnFor, call, dangerBtn, jsonInit, periodText, PhasePill, primaryBtn, secondaryBtn, sideStyle, Stat } from "./SuperadminCampaignParts";
import { ChevronDownIcon } from "./icons";
import type { AuthUser } from "./AuthModal";
import {
  CAMPAIGN_AUDIENCES,
  formatDay,
  formatMytDateTime,
  formatRm,
  LOW_STOCK_THRESHOLD,
  SIDE_LABEL,
  type Campaign,
  type CampaignAudience,
  type CampaignClaimRow,
} from "@/lib/campaigns-shared";

type StatusAction = "live" | "pause" | "end" | "delete";
type DrawAction = { audience: CampaignAudience; action: "pick" | "announce" };
type Task = { key: string; tone: "todo" | "warn" | "info" | "done"; icon: string; text: React.ReactNode; action?: { label: string; onClick: () => void; audience?: CampaignAudience } };

const TASK_TONE: Record<Task["tone"], string> = {
  todo: "border-brand-teal-soft bg-brand-teal-page",
  warn: "border-[#FBE7B3] bg-[#FFF8E6]",
  info: "border-[#EAEDF2] bg-[#F8FAFB]",
  done: "border-[#CDEBD7] bg-[#E7F6EC]",
};

function statusLine(c: Campaign): string {
  switch (c.phase) {
    case "draft":
      return "Draft — nobody sees it yet.";
    case "scheduled":
      return `Starts by itself on ${formatDay(c.startsOn as string)}.`;
    case "running":
      return c.endsOn ? `Running until the end of ${formatDay(c.endsOn)}.` : "Running until you end it.";
    case "paused":
      return "Paused — nobody gets a reward right now.";
    case "finished":
      return `Ended ${c.endedAt ? formatMytDateTime(c.endedAt) : formatDay(c.endsOn as string)}.`;
  }
}

/** The "More" menu next to the main buttons. */
function MoreMenu({ items }: { items: { label: string; onClick?: () => void; href?: string; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={secondaryBtn}>
        More <ChevronDownIcon className="h-[9px] w-[9px]" />
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+8px)] right-0 z-30 w-[230px] rounded-[14px] border border-black/[0.06] bg-white py-[6px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          {items.map((item) => {
            const cls = `block w-full px-[16px] py-[9px] text-left text-sm hover:bg-black/[0.03] ${item.danger ? "text-red-500" : "text-[#141B2E]"}`;
            return item.href ? (
              <a key={item.label} role="menuitem" href={item.href} download onClick={() => setOpen(false)} className={cls}>
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cls}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Picked lucky draw winners, before anyone is told. */
function WinnersPanel({
  campaign,
  audience,
  claims,
  busy,
  onSwap,
  onAnnounce,
}: {
  campaign: Campaign;
  audience: CampaignAudience;
  claims: CampaignClaimRow[];
  busy: string | null;
  onSwap: (claimId: string) => void;
  onAnnounce: () => void;
}) {
  const reward = campaign.rewards[audience];
  const picked = claims.filter((c) => c.audience === audience && c.status === "selected");
  const gold = audience === "jobseeker";
  return (
    <div style={sideStyle(audience)} className={`rounded-[14px] border p-[14px] ${gold ? "border-brand-gold-soft bg-brand-gold-page" : "border-brand-teal-soft bg-brand-teal-page"}`}>
      <p className="text-sm text-[#141B2E]">
        🎁 <span className="font-semibold">Winners picked for {SIDE_LABEL[audience].toLowerCase()}</span> — {reward.title}
      </p>
      <p className="mt-[2px] text-xs text-[#4B5468]">Nobody has been told yet. Not happy with someone? Pick someone else. Then confirm.</p>
      <ul className="mt-[10px] flex flex-col gap-[6px]">
        {picked.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-[10px] rounded-[12px] bg-white p-[10px]">
            <span className="text-base" aria-hidden>
              🏆
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#141B2E]">{c.userName || c.userEmail}</p>
              <p className="truncate text-xs text-[#4B5468]">
                {c.userEmail} · {c.phone}
                {c.companyName ? ` · ${c.companyName}` : ""}
              </p>
            </div>
            <button type="button" disabled={busy !== null} onClick={() => onSwap(c.id)} className={`${secondaryBtn} h-[32px]`}>
              {busy === `swap-${c.id}` ? "Picking…" : "Pick someone else"}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={busy !== null || picked.length === 0} onClick={onAnnounce} className={`${btnFor(audience)} mt-[12px]`}>
        Confirm &amp; announce
      </button>
    </div>
  );
}

export default function SuperadminCampaignView({
  authUser,
  initialCampaign,
  initialClaims,
}: {
  authUser: AuthUser;
  initialCampaign: Campaign | null;
  initialClaims: CampaignClaimRow[];
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [claims, setClaims] = useState(initialClaims);
  const [editing, setEditing] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("waiting");
  const [confirm, setConfirm] = useState<StatusAction | null>(null);
  const [drawConfirm, setDrawConfirm] = useState<DrawAction | null>(null);
  const [codesSide, setCodesSide] = useState<CampaignAudience | null>(null);
  const [codesReload, setCodesReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function refreshPendingCount() {
    fetch("/api/superadmin/campaigns/pending-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => typeof data?.count === "number" && setPendingRewardCount(data.count))
      .catch(() => {});
  }

  function update(next: Campaign, nextClaims?: CampaignClaimRow[]) {
    setCampaign(next);
    if (nextClaims) setClaims(nextClaims);
    refreshPendingCount();
  }

  // ---- Setting up (new or draft) and editing: the step-by-step guide. ----
  if (!campaign || campaign.status === "draft" || editing) {
    const creating = !editing;
    return (
      <SuperadminDashboardShell
        authUser={authUser}
        active="campaigns"
        heading={creating ? (campaign?.name ? `Set up “${campaign.name}”` : "New campaign") : "Edit campaign"}
        headerAction={
          <Link href="/superadmin/campaigns" className={secondaryBtn}>
            ← All campaigns
          </Link>
        }
        subheading={
          creating
            ? "A few quick steps. Nobody sees anything until you go live — and your progress is saved as you go."
            : "Change anything below, then save on the last step."
        }
      >
        <CampaignWizard
          campaign={campaign}
          mode={creating ? "create" : "edit"}
          startAt={creating && campaign ? firstOpenStep(campaign) : "basics"}
          onCampaign={(c) => setCampaign(c)}
          onFinish={(c) => {
            if (c.status === "draft") {
              router.push("/superadmin/campaigns");
              return;
            }
            setCampaign(c);
            setEditing(false);
            setNote(creating ? (c.phase === "scheduled" ? "Scheduled! It starts by itself on the start date." : "🚀 It's live!") : "Changes saved.");
            window.scrollTo({ top: 0 });
          }}
          onCancel={() => (editing ? setEditing(false) : router.push("/superadmin/campaigns"))}
        />
      </SuperadminDashboardShell>
    );
  }

  // ---- A campaign that has gone live: what needs doing. ----
  const c = campaign;
  const stats = CAMPAIGN_AUDIENCES.map((a) => c.stats[a]);
  const waiting = stats.reduce((n, s) => n + s.pending, 0);
  const given = stats.reduce((n, s) => n + s.approved + s.won, 0);
  const voucherSides = CAMPAIGN_AUDIENCES.filter((a) => c.rewards[a].type === "voucher" && (c.rewards[a].enabled || c.stats[a].claims > 0));
  const drawSides = CAMPAIGN_AUDIENCES.filter((a) => c.rewards[a].type === "draw" && (c.rewards[a].enabled || c.stats[a].claims > 0));
  const codesLeft = voucherSides.reduce((n, a) => n + c.stats[a].codesAvailable, 0);
  const entries = drawSides.reduce((n, a) => n + c.stats[a].claims, 0);
  const spent = voucherSides.reduce((n, a) => n + (c.rewards[a].valueRm ?? 0) * c.stats[a].approved, 0);
  const ended = c.phase === "finished";
  const totalClaims = stats.reduce((n, s) => n + s.claims, 0);

  const reviewNow = () => {
    setPeopleFilter("waiting");
    document.getElementById("campaign-people")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tasks: Task[] = [];
  if (c.phase === "scheduled") tasks.push({ key: "scheduled", tone: "info", icon: "🗓️", text: `Starts by itself on ${formatDay(c.startsOn as string)}. Nothing to do until then.` });
  if (c.phase === "paused") {
    tasks.push({ key: "paused", tone: "warn", icon: "⏸️", text: "Paused — nobody gets a reward right now.", action: { label: "Resume", onClick: () => setConfirm("live") } });
  }
  if (waiting > 0) {
    tasks.push({
      key: "waiting",
      tone: "todo",
      icon: "🟡",
      text: (
        <>
          <span className="font-semibold">
            {waiting} {waiting === 1 ? "person is" : "people are"} waiting for their voucher
          </span>{" "}
          — check and approve.
        </>
      ),
      action: { label: "Review now", onClick: reviewNow },
    });
  }
  if (!ended) {
    for (const a of voucherSides.filter((s) => c.rewards[s].enabled)) {
      const left = c.stats[a].codesAvailable;
      if (left < LOW_STOCK_THRESHOLD) {
        tasks.push({
          key: `codes-${a}`,
          tone: "warn",
          icon: "🟠",
          text:
            left === 0 ? (
              <>
                <span className="font-semibold">No codes left for {SIDE_LABEL[a].toLowerCase()}</span> — new people get nothing until you add more.
              </>
            ) : (
              <>
                <span className="font-semibold">
                  Only {left} code{left === 1 ? "" : "s"} left for {SIDE_LABEL[a].toLowerCase()}
                </span>{" "}
                — add more soon.
              </>
            ),
          action: { label: "Add codes", onClick: () => setCodesSide(a), audience: a },
        });
      }
    }
  }
  for (const a of drawSides) {
    const r = c.rewards[a];
    const n = c.stats[a].claims;
    const side = SIDE_LABEL[a].toLowerCase();
    if (!ended) {
      tasks.push({
        key: `draw-${a}`,
        tone: "info",
        icon: "🎁",
        text: `Lucky draw for ${side}: ${n} entr${n === 1 ? "y" : "ies"} so far. You'll pick ${r.winnerCount} winner${r.winnerCount === 1 ? "" : "s"} after the campaign ends.`,
      });
    } else if (!r.drawnAt) {
      tasks.push(
        n > 0
          ? {
              key: `draw-${a}`,
              tone: "todo",
              icon: "🎁",
              text: (
                <>
                  <span className="font-semibold">Ready to pick the {side} lucky draw winners</span> — {n} entr{n === 1 ? "y" : "ies"}.
                </>
              ),
              action: { label: "Pick winners", onClick: () => setDrawConfirm({ audience: a, action: "pick" }), audience: a },
            }
          : { key: `draw-${a}`, tone: "info", icon: "🎁", text: `Nobody entered the ${side} lucky draw.` },
      );
    } else if (r.announcedAt) {
      const winners = claims.filter((x) => x.audience === a && x.status === "won").map((x) => x.userName || x.userEmail);
      tasks.push({ key: `draw-${a}`, tone: "done", icon: "🏆", text: `${SIDE_LABEL[a]} lucky draw announced${winners.length ? ` — won by ${winners.join(", ")}` : ""}. Download the list to arrange the prizes.` });
    }
  }
  const needsYou = tasks.some((t) => t.tone === "todo" || t.tone === "warn") || drawSides.some((a) => c.rewards[a].drawnAt && !c.rewards[a].announcedAt);
  if (!needsYou) {
    tasks.unshift({
      key: "ok",
      tone: "done",
      icon: "✅",
      text: ended ? "All done — this campaign is finished." : "All good — nothing needs you right now. Rewards are going out by themselves.",
    });
  }

  async function runStatus(action: StatusAction) {
    setBusy("status");
    setError(null);
    try {
      if (action === "delete") {
        await call(`/api/superadmin/campaigns/${c.id}`, { method: "DELETE" });
        router.push("/superadmin/campaigns");
        router.refresh();
        return;
      }
      const data = await call<{ campaign: Campaign }>(`/api/superadmin/campaigns/${c.id}/status`, jsonInit("POST", { action }));
      update(data.campaign);
      setConfirm(null);
      setNote(action === "live" ? "Resumed — rewards are going out again." : action === "pause" ? "Paused." : "Campaign ended.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function runDraw(body: { audience?: CampaignAudience; action: "pick" | "announce" | "swap"; claimId?: string }) {
    setBusy(body.action === "swap" ? `swap-${body.claimId}` : "draw");
    setError(null);
    setNote(null);
    try {
      const data = await call<{ campaign: Campaign; claims: CampaignClaimRow[]; replaced?: boolean }>(`/api/superadmin/campaigns/${c.id}/draw`, jsonInit("POST", body));
      update(data.campaign, data.claims);
      setDrawConfirm(null);
      if (body.action === "swap") setNote(data.replaced ? "Picked someone else at random." : "Removed — there was nobody left to pick instead.");
      if (body.action === "announce") setNote("🎉 Results announced — winners and everyone else have been told.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDrawConfirm(null);
    } finally {
      setBusy(null);
    }
  }

  const menu: { label: string; onClick?: () => void; href?: string; danger?: boolean }[] = [];
  if (!ended) menu.push({ label: "Edit settings", onClick: () => setEditing(true) });
  for (const a of voucherSides) menu.push({ label: `Voucher codes · ${SIDE_LABEL[a]}`, onClick: () => setCodesSide(a) });
  if (c.phase === "running" || c.phase === "scheduled") menu.push({ label: "Pause campaign", onClick: () => setConfirm("pause") });
  if (totalClaims > 0) menu.push({ label: "Download list (CSV)", href: `/api/superadmin/campaigns/${c.id}/claims/export` });
  if (totalClaims === 0 && c.phase !== "running" && c.phase !== "scheduled") menu.push({ label: "Delete campaign", onClick: () => setConfirm("delete"), danger: true });

  const confirmCopy: Record<StatusAction, { title: string; body: string; button: string }> = {
    live: { title: "Resume the campaign?", body: "Rewards start going out again straight away.", button: "Resume" },
    pause: { title: "Pause the campaign?", body: "Nobody gets a reward while it's paused. People keep what they already have, and you can resume any time.", button: "Pause" },
    end: {
      title: "End the campaign?",
      body: "Nobody new gets a reward after this, and it can't be restarted. You can still approve people who are waiting and pick lucky draw winners.",
      button: "End campaign",
    },
    delete: { title: "Delete this campaign?", body: "It and its voucher codes are removed for good. Nobody has a reward from it yet.", button: "Delete" },
  };

  return (
    <SuperadminDashboardShell
      authUser={authUser}
      active="campaigns"
      heading={c.name}
      headerAction={
        <Link href="/superadmin/campaigns" className={secondaryBtn}>
          ← All campaigns
        </Link>
      }
      subheading={`Rewards people who verify their phone number · ${periodText(c)}`}
    >
      <div className="flex flex-col gap-[16px]">
        {note && <p className="rounded-[12px] border border-[#CDEBD7] bg-[#E7F6EC] p-[12px] text-sm text-[#2F7D4F]">{note}</p>}
        {error && !confirm && <p className="rounded-[12px] border border-red-200 bg-red-50 p-[12px] text-sm text-red-600">{error}</p>}

        {/* Where it stands, the main button and the numbers. */}
        <div className={gradientFrameClass("teal")}>
          <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-[12px]">
              <div className="flex min-w-0 flex-wrap items-center gap-[10px]">
                <PhasePill phase={c.phase} />
                <p className="text-sm text-[#4B5468]">{statusLine(c)}</p>
              </div>
              <div className="flex flex-wrap gap-[8px]">
                {c.phase === "paused" && (
                  <button type="button" onClick={() => setConfirm("live")} className={primaryBtn}>
                    Resume
                  </button>
                )}
                {!ended && (
                  <button type="button" onClick={() => setConfirm("end")} className={secondaryBtn}>
                    End campaign
                  </button>
                )}
                <MoreMenu items={menu} />
              </div>
            </div>
            <div className={`grid grid-cols-2 gap-[10px] ${voucherSides.length && drawSides.length ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              <Stat label="Waiting for approval" value={waiting} hint={waiting ? "Review them ↓" : undefined} onClick={waiting ? reviewNow : undefined} />
              <Stat label="Rewards given" value={given} hint={spent ? `${formatRm(spent)} so far` : undefined} />
              {voucherSides.length > 0 && <Stat label="Voucher codes left" value={codesLeft} onClick={() => setCodesSide(voucherSides[0])} hint="Manage →" />}
              {drawSides.length > 0 && <Stat label="Lucky draw entries" value={entries} />}
            </div>
          </div>
        </div>

        {/* What to do next */}
        <div className={gradientFrameClass("teal")}>
          <div className="rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <h2 className="text-base font-semibold text-[#141B2E]">What to do next</h2>
            <ul className="mt-[12px] flex flex-col gap-[8px]">
              {tasks.map((t) => (
                <li key={t.key} className={`flex flex-wrap items-center gap-[10px] rounded-[14px] border p-[12px] ${TASK_TONE[t.tone]}`}>
                  <span className="text-base" aria-hidden>
                    {t.icon}
                  </span>
                  <p className="min-w-0 flex-1 text-sm text-[#141B2E]">{t.text}</p>
                  {t.action && (
                    <button
                      type="button"
                      onClick={t.action.onClick}
                      style={t.action.audience ? sideStyle(t.action.audience) : undefined}
                      className={t.action.audience ? btnFor(t.action.audience) : primaryBtn}
                    >
                      {t.action.label}
                    </button>
                  )}
                </li>
              ))}
              {drawSides
                .filter((a) => c.rewards[a].drawnAt && !c.rewards[a].announcedAt)
                .map((a) => (
                  <li key={`winners-${a}`}>
                    <WinnersPanel
                      campaign={c}
                      audience={a}
                      claims={claims}
                      busy={busy}
                      onSwap={(claimId) => runDraw({ action: "swap", claimId })}
                      onAnnounce={() => setDrawConfirm({ audience: a, action: "announce" })}
                    />
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div id="campaign-people" className="scroll-mt-[96px]">
          <CampaignPeople campaign={c} claims={claims} filter={peopleFilter} onFilter={setPeopleFilter} onUpdate={update} />
        </div>
      </div>

      {confirm && (
        <Modal ariaLabel={confirmCopy[confirm].title} onClose={() => busy === null && setConfirm(null)}>
          <h2 className="text-lg font-semibold text-[#141B2E]">{confirmCopy[confirm].title}</h2>
          <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">{confirmCopy[confirm].body}</p>
          {error && <p className="mt-[10px] text-sm text-red-500">{error}</p>}
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runStatus(confirm)}
              className={confirm === "end" || confirm === "delete" ? dangerBtn : primaryBtn}
            >
              {busy ? "Working…" : confirmCopy[confirm].button}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(null);
                setError(null);
              }}
              className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {drawConfirm && (
        <Modal ariaLabel={drawConfirm.action === "pick" ? "Pick winners" : "Confirm and announce"} onClose={() => busy === null && setDrawConfirm(null)}>
          {drawConfirm.action === "pick" ? (
            <>
              <h2 className="text-lg font-semibold text-[#141B2E]">Pick the winners?</h2>
              <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
                Picks {Math.min(c.rewards[drawConfirm.audience].winnerCount, c.stats[drawConfirm.audience].claims)} at random from{" "}
                {c.stats[drawConfirm.audience].claims} entries — everyone has the same chance. Nobody is told yet: you can swap anyone before you confirm.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#141B2E]">Confirm &amp; announce?</h2>
              <p className="mt-[10px] text-sm leading-[20px] text-[#4B5468]">
                Winners are told in the app and by email; everyone else who entered is told in the app. This can&rsquo;t be undone.
              </p>
            </>
          )}
          <div className="mt-[18px] flex flex-col gap-[8px]">
            <button type="button" disabled={busy !== null} onClick={() => runDraw(drawConfirm)} style={sideStyle(drawConfirm.audience)} className={btnFor(drawConfirm.audience)}>
              {busy ? "Working…" : drawConfirm.action === "pick" ? "Pick winners" : "Confirm & announce"}
            </button>
            <button type="button" onClick={() => setDrawConfirm(null)} className="flex h-[38px] items-center justify-center text-sm text-[#9AA3B2] hover:text-[#141B2E]">
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {codesSide && (
        <Modal ariaLabel={`Voucher codes for ${SIDE_LABEL[codesSide].toLowerCase()}`} onClose={() => setCodesSide(null)} large>
          <div style={sideStyle(codesSide)}>
            <div className="flex items-start justify-between gap-[10px]">
              <div>
                <h2 className={`text-lg font-semibold ${codesSide === "jobseeker" ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>
                  Voucher codes for {SIDE_LABEL[codesSide].toLowerCase()}
                </h2>
                <p className="mt-[2px] text-sm text-[#4B5468]">
                  {c.stats[codesSide].codesAvailable} ready · {c.stats[codesSide].pending} waiting for approval · {c.stats[codesSide].approved} given
                </p>
              </div>
              <button type="button" onClick={() => setCodesSide(null)} className={`${secondaryBtn} h-[32px]`}>
                Done
              </button>
            </div>
            {voucherSides.length > 1 && (
              <div className="mt-[12px] flex gap-[6px]">
                {voucherSides.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setCodesSide(a)}
                    aria-pressed={a === codesSide}
                    style={sideStyle(a)}
                    className={`rounded-full border px-[12px] py-[6px] text-xs ${
                      a === codesSide
                        ? a === "jobseeker"
                          ? "border-brand-gold-dark bg-brand-gold-soft text-brand-gold-dark"
                          : "border-brand-teal-dark bg-brand-teal-soft text-brand-teal-dark"
                        : "border-black/[0.1] text-[#4B5468]"
                    }`}
                  >
                    {SIDE_LABEL[a]}
                  </button>
                ))}
              </div>
            )}
            {!ended && (
              <div className="mt-[16px]">
                <p className="mb-[8px] text-sm text-[#141B2E]">Add more codes</p>
                <CodeUploader key={codesSide} campaign={c} audience={codesSide} onCampaign={(next) => update(next)} onAdded={() => setCodesReload((n) => n + 1)} />
              </div>
            )}
            <div className="mt-[20px]">
              <CodeList key={codesSide} campaign={c} audience={codesSide} onCampaign={(next) => update(next)} reloadKey={codesReload} />
            </div>
          </div>
        </Modal>
      )}
    </SuperadminDashboardShell>
  );
}

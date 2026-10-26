"use client";

import { useState } from "react";
import { CodeUploader } from "./CampaignCodes";
import DatePicker from "./DatePicker";
import { gradientFrameClass, inputClass, textareaClass } from "./formStyles";
import { call, jsonInit, Notice, primaryBtn, secondaryBtn, sideStyle } from "./SuperadminCampaignParts";
import Switch from "./Switch";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_TERMS_MAX,
  formatDay,
  REWARD_DETAILS_MAX,
  REWARD_TITLE_MAX,
  SIDE_LABEL,
  termsTemplate,
  todayInMalaysia,
  verifyBarRewardText,
  type Campaign,
  type CampaignAudience,
  type CampaignRewardType,
} from "@/lib/campaigns-shared";

// Setting up a campaign, one step at a time:
//   1. Name & dates  2. Who gets what  3. Voucher codes (only if a side uses
//   vouchers)  4. Review & go live.
// The same steps edit a campaign later ("Edit settings"), ending in "Save".
// Every "Next" saves, so a half-finished setup stays as a draft.

type RewardDraft = { enabled: boolean; type: CampaignRewardType; title: string; details: string; valueRm: string; winnerCount: string };
type Draft = {
  name: string;
  needsApproval: boolean;
  startsOn: string;
  endsOn: string;
  terms: string;
  rewards: Record<CampaignAudience, RewardDraft>;
};
type StepKey = "basics" | "rewards" | "codes" | "review";

const blankReward = (): RewardDraft => ({ enabled: true, type: "voucher", title: "", details: "", valueRm: "", winnerCount: "1" });

const toDraft = (c: Campaign | null): Draft =>
  c
    ? {
        name: c.name,
        needsApproval: c.needsApproval,
        startsOn: c.startsOn ?? "",
        endsOn: c.endsOn ?? "",
        terms: c.terms,
        rewards: Object.fromEntries(
          CAMPAIGN_AUDIENCES.map((a) => {
            const r = c.rewards[a];
            return [
              a,
              { enabled: r.enabled, type: r.type, title: r.title, details: r.details, valueRm: r.valueRm === null ? "" : String(r.valueRm), winnerCount: String(r.winnerCount) },
            ];
          }),
        ) as Draft["rewards"],
      }
    : { name: "", needsApproval: true, startsOn: "", endsOn: "", terms: termsTemplate(), rewards: { employer: blankReward(), jobseeker: blankReward() } };

const toPayload = (d: Draft) => ({
  ...d,
  startsOn: d.startsOn || null,
  endsOn: d.endsOn || null,
  rewards: Object.fromEntries(
    CAMPAIGN_AUDIENCES.map((a) => {
      const r = d.rewards[a];
      return [a, { ...r, valueRm: r.valueRm.trim() === "" ? null : Number(r.valueRm), winnerCount: Number(r.winnerCount) || 1 }];
    }),
  ),
});

/** The first step that still needs something — where a draft picks up again. */
export function firstOpenStep(c: Campaign): StepKey {
  if (!c.name) return "basics";
  const enabled = CAMPAIGN_AUDIENCES.filter((a) => c.rewards[a].enabled);
  if (enabled.length === 0 || enabled.some((a) => !c.rewards[a].title)) return "rewards";
  if (enabled.some((a) => c.rewards[a].type === "voucher" && c.stats[a].codesAvailable === 0)) return "codes";
  return "review";
}

function MoreOptions({ label = "More options", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-sm text-brand-teal-dark hover:underline">
        {open ? "▾" : "▸"} {label}
      </button>
      {open && <div className="mt-[12px] flex flex-col gap-[16px]">{children}</div>}
    </div>
  );
}

function ChoiceCard({
  selected,
  disabled,
  title,
  hint,
  accent,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: React.ReactNode;
  hint: string;
  accent: "teal" | "gold";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-[14px] border p-[12px] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? (accent === "gold" ? "border-brand-gold-dark bg-brand-gold-page" : "border-brand-teal-dark bg-brand-teal-page") : "border-black/[0.1] hover:bg-black/[0.02]"
      }`}
    >
      <span className="text-sm text-[#141B2E]">{title}</span>
      <span className="mt-[2px] block text-xs leading-[17px] text-[#4B5468]">{hint}</span>
    </button>
  );
}

function VerifyBarPreview({ audience, reward }: { audience: CampaignAudience; reward: RewardDraft }) {
  const gold = audience === "jobseeker";
  const placeholder = reward.type === "voucher" ? "voucher" : "prize";
  return (
    <div style={sideStyle(audience)} className={`flex items-center gap-[10px] rounded-[12px] px-[12px] py-[9px] text-white ${gold ? "bg-brand-gold-dark" : "bg-brand-teal-bar"}`}>
      <p className="min-w-0 flex-1 text-sm font-semibold">{verifyBarRewardText(reward.type, reward.title.trim() || placeholder)}</p>
      <span className={`shrink-0 rounded-full bg-white px-[12px] py-[5px] text-xs ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>Verify my phone</span>
    </div>
  );
}

function RewardCard({
  audience,
  reward,
  locked,
  winnersLocked,
  onChange,
}: {
  audience: CampaignAudience;
  reward: RewardDraft;
  locked: boolean;
  winnersLocked: boolean;
  onChange: (patch: Partial<RewardDraft>) => void;
}) {
  const gold = audience === "jobseeker";
  const accent = gold ? "gold" : "teal";
  const voucher = reward.type === "voucher";
  const side = SIDE_LABEL[audience].toLowerCase();
  return (
    <div style={sideStyle(audience)} className={gradientFrameClass(accent)}>
      <div className="flex flex-col gap-[16px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h2 className={`text-base font-semibold ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>{SIDE_LABEL[audience]}</h2>
            <p className="mt-[2px] text-xs text-[#9AA3B2]">
              {audience === "employer" ? "Company owners who verify their phone number." : "Jobseekers who verify their phone number."}
            </p>
          </div>
          <Switch on={reward.enabled} accent={accent} label={`Give ${side} a reward`} onChange={() => onChange({ enabled: !reward.enabled })} />
        </div>

        {!reward.enabled ? (
          <p className="rounded-[12px] bg-[#F8FAFB] p-[12px] text-sm text-[#9AA3B2]">No reward for {side}. Switch it on to give them one.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
              <ChoiceCard
                accent={accent}
                selected={voucher}
                disabled={locked && !voucher}
                onClick={() => onChange({ type: "voucher" })}
                title={<>🎟️ Voucher code</>}
                hint="Everyone gets a code, e.g. RM5 Touch 'n Go."
              />
              <ChoiceCard
                accent={accent}
                selected={!voucher}
                disabled={locked && voucher}
                onClick={() => onChange({ type: "draw" })}
                title={<>🎁 Lucky draw</>}
                hint="Everyone gets an entry. Winners picked at the end."
              />
            </div>
            {locked && <p className="-mt-[8px] text-xs text-[#9AA3B2]">People already have this reward, so its type can&rsquo;t change.</p>}

            <div>
              <label htmlFor={`${audience}-title`} className="block text-sm text-[#141B2E]">
                {voucher ? "What do they get?" : "What's the prize?"}
              </label>
              <input
                id={`${audience}-title`}
                value={reward.title}
                maxLength={REWARD_TITLE_MAX}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder={voucher ? "e.g. RM5 Touch 'n Go eWallet voucher" : "e.g. iPhone 16 (128GB)"}
                className={`${inputClass(accent)} mt-[6px]`}
              />
            </div>

            {!voucher && (
              <div>
                <label htmlFor={`${audience}-winners`} className="block text-sm text-[#141B2E]">
                  How many winners?
                </label>
                <input
                  id={`${audience}-winners`}
                  inputMode="numeric"
                  value={reward.winnerCount}
                  disabled={winnersLocked}
                  onChange={(e) => onChange({ winnerCount: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  className={`${inputClass(accent).replace("w-full ", "")} mt-[6px] w-[120px] disabled:bg-[#F1F4F8]`}
                />
              </div>
            )}

            <MoreOptions>
              <div>
                <label htmlFor={`${audience}-details`} className="block text-sm text-[#141B2E]">
                  {voucher ? "How to use the voucher" : "About the prize"}
                </label>
                <textarea
                  id={`${audience}-details`}
                  rows={3}
                  value={reward.details}
                  maxLength={REWARD_DETAILS_MAX}
                  onChange={(e) => onChange({ details: e.target.value })}
                  placeholder={voucher ? "e.g. Open the TNG eWallet app → Reload → Reload PIN, then enter the code." : "e.g. Delivered to the winner's door."}
                  className={`${textareaClass(accent)} mt-[6px]`}
                />
              </div>
              {voucher && (
                <div>
                  <label htmlFor={`${audience}-value`} className="block text-sm text-[#141B2E]">
                    Value of one voucher, for your budget
                  </label>
                  <div className="mt-[6px] flex items-center gap-[8px]">
                    <span className="text-sm text-[#4B5468]">RM</span>
                    <input
                      id={`${audience}-value`}
                      inputMode="decimal"
                      value={reward.valueRm}
                      onChange={(e) => onChange({ valueRm: e.target.value.replace(/[^\d.]/g, "") })}
                      placeholder="5"
                      className={`${inputClass(accent).replace("w-full ", "")} w-[120px]`}
                    />
                  </div>
                  <p className="mt-[4px] text-xs text-[#9AA3B2]">Only you see this.</p>
                </div>
              )}
            </MoreOptions>
          </>
        )}
      </div>
    </div>
  );
}

export default function CampaignWizard({
  campaign,
  mode,
  startAt,
  onCampaign,
  onFinish,
  onCancel,
}: {
  campaign: Campaign | null;
  mode: "create" | "edit";
  startAt?: StepKey;
  onCampaign: (c: Campaign) => void;
  onFinish: (c: Campaign) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(campaign));
  const [step, setStep] = useState<StepKey>(startAt ?? "basics");
  const [busy, setBusy] = useState<"next" | "live" | "save" | null>(null);
  // A server error, as it came back.
  const [error, setError] = useState<string | null>(null);
  // After a "Next" that wasn't ready: show what's missing, worked out live,
  // so the message goes away as soon as it's fixed.
  const [checking, setChecking] = useState(false);

  const voucherSides = CAMPAIGN_AUDIENCES.filter((a) => draft.rewards[a].enabled && draft.rewards[a].type === "voucher");
  const steps: { key: StepKey; label: string }[] = [
    { key: "basics", label: "Name & dates" },
    { key: "rewards", label: "Who gets what" },
    ...(voucherSides.length ? [{ key: "codes" as const, label: "Voucher codes" }] : []),
    { key: "review", label: mode === "create" ? "Review & go live" : "Review & save" },
  ];
  const index = Math.max(0, steps.findIndex((s) => s.key === step));
  const current = steps[index].key;
  const today = todayInMalaysia();
  const setReward = (a: CampaignAudience, patch: Partial<RewardDraft>) =>
    setDraft((d) => ({ ...d, rewards: { ...d.rewards, [a]: { ...d.rewards[a], ...patch } } }));

  /** What stops this step being finished, in plain words. */
  function problem(key: StepKey): string | null {
    if (key === "basics") {
      if (!draft.name.trim()) return "Give the campaign a name.";
      if (draft.endsOn && draft.endsOn < today && draft.endsOn !== campaign?.endsOn) return "The end date has already passed.";
      if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) return "The end date is before the start date.";
    }
    if (key === "rewards") {
      const enabled = CAMPAIGN_AUDIENCES.filter((a) => draft.rewards[a].enabled);
      if (enabled.length === 0) return "Switch on a reward for employers, jobseekers or both.";
      for (const a of enabled) {
        const r = draft.rewards[a];
        if (!r.title.trim()) return `Say what ${SIDE_LABEL[a].toLowerCase()} get.`;
        if (r.type === "draw" && !(Number(r.winnerCount) >= 1)) return `Enter how many ${SIDE_LABEL[a].toLowerCase()} win.`;
      }
    }
    // Only when setting up: a live campaign that has run out can still be edited.
    if (key === "codes" && campaign && mode === "create") {
      const empty = voucherSides.find((a) => campaign.stats[a].codesAvailable === 0);
      if (empty && campaign.phase !== "finished") return `Add at least one voucher code for ${SIDE_LABEL[empty].toLowerCase()}.`;
    }
    return null;
  }

  /** Saves everything so far (creating the campaign the first time). */
  async function persist(): Promise<Campaign> {
    let saved = campaign;
    if (!saved) {
      const created = await call<{ campaign: Campaign }>("/api/superadmin/campaigns", jsonInit("POST", { name: draft.name }));
      saved = created.campaign;
      // The address becomes the campaign's own, without reloading the page.
      window.history.replaceState(null, "", `/superadmin/campaigns/${saved.id}`);
    }
    const data = await call<{ campaign: Campaign }>(`/api/superadmin/campaigns/${saved.id}`, jsonInit("PATCH", toPayload(draft)));
    onCampaign(data.campaign);
    return data.campaign;
  }

  async function next() {
    setError(null);
    if (problem(current)) return setChecking(true);
    setBusy("next");
    try {
      // The codes step only adds codes (saved as they're added) — nothing else to save.
      if (current !== "codes") await persist();
      setChecking(false);
      setStep(steps[index + 1].key);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function finish(goLive: boolean) {
    setError(null);
    const open = steps.find((s) => problem(s.key));
    if (open) {
      setStep(open.key);
      return setChecking(true);
    }
    setBusy(goLive ? "live" : "save");
    try {
      let saved = await persist();
      if (goLive) {
        const data = await call<{ campaign: Campaign }>(`/api/superadmin/campaigns/${saved.id}/status`, jsonInit("POST", { action: "live" }));
        saved = data.campaign;
      }
      onFinish(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function back() {
    setError(null);
    setChecking(false);
    if (index === 0) onCancel();
    else setStep(steps[index - 1].key);
  }

  const claimsFor = (a: CampaignAudience) => campaign?.stats[a].claims ?? 0;
  const enabledSides = CAMPAIGN_AUDIENCES.filter((a) => draft.rewards[a].enabled);
  const startsLater = !!draft.startsOn && draft.startsOn > today;

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Steps */}
      <ol className="flex flex-wrap items-center gap-x-[8px] gap-y-[8px]">
        {steps.map((s, i) => {
          const done = i < index;
          const here = i === index;
          return (
            <li key={s.key} className="flex items-center gap-[8px]">
              <button
                type="button"
                disabled={i > index || busy !== null}
                onClick={() => {
                  setError(null);
                  setChecking(false);
                  setStep(s.key);
                }}
                className="flex items-center gap-[8px] disabled:cursor-default"
              >
                <span
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs ${
                    here ? "bg-brand-teal-dark text-white" : done ? "bg-brand-teal-soft text-brand-teal-dark" : "bg-[#F1F4F8] text-[#9AA3B2]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${here ? "text-[#141B2E]" : done ? "text-[#4B5468]" : "text-[#9AA3B2]"}`}>{s.label}</span>
              </button>
              {i < steps.length - 1 && <span className="h-px w-[18px] bg-[#D7DCE4]" />}
            </li>
          );
        })}
      </ol>

      {current === "basics" && (
        <div className={gradientFrameClass("teal")}>
          <div className="flex flex-col gap-[20px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div>
              <label htmlFor="campaign-name" className="block text-sm font-semibold text-[#141B2E]">
                Campaign name
              </label>
              <input
                id="campaign-name"
                autoFocus={mode === "create"}
                value={draft.name}
                maxLength={CAMPAIGN_NAME_MAX}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Verify & Get Rewarded"
                className={`${inputClass("teal")} mt-[8px]`}
              />
              <p className="mt-[6px] text-xs text-[#9AA3B2]">People see this name on their reward.</p>
            </div>

            <div className="rounded-[12px] bg-[#F8FAFB] p-[12px]">
              <p className="text-sm text-[#141B2E]">📱 Rewards people who verify their phone number</p>
              <p className="mt-[4px] text-xs leading-[18px] text-[#4B5468]">
                Including people who verified before — they get theirs the next time they open JobGiga. One reward per person.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#141B2E]">When does it end?</p>
              <div className="mt-[8px] grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                <ChoiceCard
                  accent="teal"
                  selected={!draft.endsOn}
                  disabled={!!campaign?.rewards.employer.drawnAt || !!campaign?.rewards.jobseeker.drawnAt}
                  onClick={() => setDraft({ ...draft, endsOn: "" })}
                  title="When I end it"
                  hint="Runs until you click End campaign."
                />
                <ChoiceCard
                  accent="teal"
                  selected={!!draft.endsOn}
                  disabled={!!campaign?.rewards.employer.drawnAt || !!campaign?.rewards.jobseeker.drawnAt}
                  onClick={() => !draft.endsOn && setDraft({ ...draft, endsOn: draft.startsOn > today ? draft.startsOn : today })}
                  title="On a date"
                  hint="Ends by itself at the end of that day."
                />
              </div>
              {!!draft.endsOn && (
                <div className="mt-[10px] max-w-[260px]">
                  <DatePicker
                    id="campaign-end"
                    value={draft.endsOn}
                    onChange={(v) => setDraft({ ...draft, endsOn: v })}
                    min={draft.startsOn && draft.startsOn > today ? draft.startsOn : today}
                  />
                  <p className="mt-[4px] text-xs text-[#9AA3B2]">Malaysia time.</p>
                </div>
              )}
            </div>

            <MoreOptions label="Start on a later date">
              <div className="max-w-[260px]">
                <label htmlFor="campaign-start" className="block text-sm text-[#141B2E]">
                  Start date
                </label>
                <div className="mt-[6px]">
                  <DatePicker id="campaign-start" value={draft.startsOn} onChange={(v) => setDraft({ ...draft, startsOn: v })} min={today} max={draft.endsOn || undefined} />
                </div>
                <p className="mt-[4px] text-xs text-[#9AA3B2]">
                  {draft.startsOn ? (
                    <>
                      Starts by itself on {formatDay(draft.startsOn)}.{" "}
                      <button type="button" onClick={() => setDraft({ ...draft, startsOn: "" })} className="text-brand-teal-dark hover:underline">
                        Start straight away instead
                      </button>
                    </>
                  ) : (
                    "Leave empty to start as soon as you go live."
                  )}
                </p>
              </div>
            </MoreOptions>
          </div>
        </div>
      )}

      {current === "rewards" && (
        <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-2">
          {CAMPAIGN_AUDIENCES.map((a) => (
            <RewardCard
              key={a}
              audience={a}
              reward={draft.rewards[a]}
              locked={claimsFor(a) > 0}
              winnersLocked={!!campaign?.rewards[a].drawnAt}
              onChange={(patch) => setReward(a, patch)}
            />
          ))}
        </div>
      )}

      {current === "codes" && campaign && (
        <div className="flex flex-col gap-[16px]">
          {voucherSides.map((a) => {
            const gold = a === "jobseeker";
            const ready = campaign.stats[a].codesAvailable;
            return (
              <div key={a} style={sideStyle(a)} className={gradientFrameClass(gold ? "gold" : "teal")}>
                <div className="flex flex-col gap-[14px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
                  <div className="flex flex-wrap items-start justify-between gap-[10px]">
                    <div>
                      <h2 className={`text-base font-semibold ${gold ? "text-brand-gold-dark" : "text-brand-teal-dark"}`}>
                        Voucher codes for {SIDE_LABEL[a].toLowerCase()}
                      </h2>
                      <p className="mt-[2px] text-xs text-[#9AA3B2]">{draft.rewards[a].title}</p>
                    </div>
                    <span className={`rounded-full px-[10px] py-[3px] text-xs ${ready ? "bg-[#E7F6EC] text-[#2F7D4F]" : "bg-[#F1F4F8] text-[#9AA3B2]"}`}>
                      {ready ? `✓ ${ready} code${ready === 1 ? "" : "s"} ready` : "No codes yet"}
                    </span>
                  </div>
                  <p className="text-sm text-[#4B5468]">
                    Each person gets one code. When the codes run out, nobody else gets a voucher until you add more — so add enough.
                  </p>
                  <CodeUploader campaign={campaign} audience={a} onCampaign={onCampaign} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {current === "review" && (
        <div className={gradientFrameClass("teal")}>
          <div className="flex flex-col gap-[20px] rounded-[19px] bg-white p-[16px] sm:p-[22px]">
            <div>
              <h2 className="text-base font-semibold text-[#141B2E]">{draft.name}</h2>
              <p className="mt-[2px] text-sm text-[#4B5468]">
                {startsLater ? `Starts ${formatDay(draft.startsOn)}` : "Starts as soon as you go live"} ·{" "}
                {draft.endsOn ? `ends after ${formatDay(draft.endsOn)}` : "runs until you end it"}
              </p>
            </div>

            <div className="flex flex-col gap-[14px]">
              {CAMPAIGN_AUDIENCES.map((a) => {
                const r = draft.rewards[a];
                return (
                  <div key={a}>
                    <p className="text-sm text-[#141B2E]">
                      <span className="font-semibold">{SIDE_LABEL[a]}:</span>{" "}
                      {!r.enabled
                        ? "no reward"
                        : r.type === "voucher"
                          ? `🎟️ ${r.title} — ${campaign?.stats[a].codesAvailable ?? 0} codes ready`
                          : `🎁 Lucky draw for ${r.title} — ${r.winnerCount} winner${r.winnerCount === "1" ? "" : "s"}`}
                    </p>
                    {r.enabled && (
                      <div className="mt-[6px]">
                        <VerifyBarPreview audience={a} reward={r} />
                      </div>
                    )}
                  </div>
                );
              })}
              {enabledSides.length > 0 && (
                <p className="text-xs text-[#9AA3B2]">This is what the &ldquo;Verify your phone&rdquo; bar will say. After verifying, they get a 🎉 popup and the reward is saved in My Rewards.</p>
              )}
            </div>

            <MoreOptions>
              {voucherSides.length > 0 && (
                <div className="flex items-start justify-between gap-[12px]">
                  <div>
                    <p className="text-sm text-[#141B2E]">Check each voucher before it&rsquo;s given</p>
                    <p className="mt-[2px] text-xs leading-[18px] text-[#9AA3B2]">
                      Recommended. People are told you&rsquo;ll review it within 3 working days. Turn off to give codes instantly.
                    </p>
                  </div>
                  <Switch on={draft.needsApproval} accent="teal" label="Check each voucher before it's given" onChange={() => setDraft({ ...draft, needsApproval: !draft.needsApproval })} />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-[8px]">
                  <label htmlFor="campaign-terms" className="text-sm text-[#141B2E]">
                    Terms &amp; conditions
                  </label>
                  <button type="button" onClick={() => setDraft({ ...draft, terms: termsTemplate() })} className="text-xs text-brand-teal-dark hover:underline">
                    Use the starter terms
                  </button>
                </div>
                <textarea
                  id="campaign-terms"
                  rows={8}
                  value={draft.terms}
                  maxLength={CAMPAIGN_TERMS_MAX}
                  onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
                  className={`${textareaClass("teal")} mt-[6px] text-xs leading-[18px]`}
                />
                <p className="mt-[4px] text-xs text-[#9AA3B2]">Shown with every reward. The starter terms cover one reward per person and personal data (PDPA).</p>
              </div>
            </MoreOptions>
          </div>
        </div>
      )}

      {(error || (checking && problem(current))) && <Notice tone="error">{error ?? problem(current)}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <button type="button" onClick={back} disabled={busy !== null} className={secondaryBtn}>
          {index === 0 ? "Cancel" : "← Back"}
        </button>
        {current !== "review" ? (
          <button type="button" onClick={next} disabled={busy !== null} className={primaryBtn}>
            {busy === "next" ? "Saving…" : "Next →"}
          </button>
        ) : mode === "create" ? (
          <div className="flex flex-wrap gap-[8px]">
            <button type="button" onClick={() => finish(false)} disabled={busy !== null} className={secondaryBtn}>
              {busy === "save" ? "Saving…" : "Save as draft"}
            </button>
            <button type="button" onClick={() => finish(true)} disabled={busy !== null} className={primaryBtn}>
              {busy === "live" ? "Going live…" : startsLater ? `Schedule to start ${formatDay(draft.startsOn)}` : "🚀 Go live"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => finish(false)} disabled={busy !== null} className={primaryBtn}>
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}

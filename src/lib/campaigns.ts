import "server-only";
import { randomInt } from "crypto";
import { cache } from "react";
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  campaignClaims,
  campaignRewards,
  campaigns,
  campaignVoucherCodes,
  employerProfiles,
  jobseekerProfiles,
  users,
  verifiedPhones,
} from "./db/schema";
import { DUMMY_APPLICANT_EMAIL_DOMAIN } from "./dummy-applicants";
import { DUMMY_TEAM_EMAIL_DOMAIN } from "./dummy-team";
import { sendCampaignRewardEmail } from "./email";
import { getEmployerAccess } from "./employer-profile";
import { notify } from "./notifications";
import { toMalaysianMobileE164 } from "./phone";
import { isSuperadminEmail } from "./superadmin";
import { isUuid } from "./uuid";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_TERMS_MAX,
  campaignPhase,
  CLAIM_STATUS_LABEL,
  CODES_PER_UPLOAD_MAX,
  formatMytDateTime,
  isIsoDate,
  mytDate,
  mytEndOfDay,
  mytLastDay,
  mytStartOfDay,
  parseVoucherCodes,
  REJECT_REASON_MAX,
  REWARD_DETAILS_MAX,
  REWARD_TITLE_MAX,
  SIDE_LABEL,
  termsTemplate,
  todayInMalaysia,
  verifyBarRewardText,
  WINNER_COUNT_MAX,
  type Campaign,
  type CampaignAudience,
  type CampaignClaimRow,
  type CampaignClaimStatus,
  type CampaignReward,
  type CampaignRewardType,
  type RewardHints,
  type RewardStats,
  type UserReward,
  type UserRewardState,
} from "./campaigns-shared";

// Reward campaigns: a superadmin offers employers and/or jobseekers a reward
// for doing one thing (for now: verifying their phone number). Each side's
// reward is either a voucher code from an uploaded stock, or an entry into a
// lucky draw. Rules that keep it fair:
//  • one reward per person AND per phone number per campaign — across both
//    sides, and kept after an account is deleted;
//  • only one live campaign per side at a time;
//  • codes are handed out under a per-campaign lock, so the last code can't
//    go to two people;
//  • superadmins, dummy/sample accounts and employer teammates never qualify;
//  • people who verified before the campaign started qualify too — they get
//    it the next time they open JobGiga while it runs.

export class CampaignError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type CampaignRow = typeof campaigns.$inferSelect;
type RewardRow = typeof campaignRewards.$inferSelect;

const emptyStats = (): RewardStats => ({
  claims: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  entered: 0,
  selected: 0,
  won: 0,
  codesTotal: 0,
  codesAvailable: 0,
  codesExpired: 0,
});

function toReward(r: RewardRow): CampaignReward {
  return {
    id: r.id,
    audience: r.audience,
    enabled: r.enabled,
    type: r.type,
    title: r.title,
    details: r.details,
    valueRm: r.valueRm,
    winnerCount: r.winnerCount,
    drawnAt: r.drawnAt?.toISOString() ?? null,
    announcedAt: r.announcedAt?.toISOString() ?? null,
  };
}

async function statsFor(rewardIds: string[]): Promise<Map<string, RewardStats>> {
  const out = new Map(rewardIds.map((id) => [id, emptyStats()]));
  if (rewardIds.length === 0) return out;
  const today = todayInMalaysia();
  const [claimRows, codeRows] = await Promise.all([
    db
      .select({ rewardId: campaignClaims.rewardId, status: campaignClaims.status, n: count() })
      .from(campaignClaims)
      .where(inArray(campaignClaims.rewardId, rewardIds))
      .groupBy(campaignClaims.rewardId, campaignClaims.status),
    db
      .select({
        rewardId: campaignVoucherCodes.rewardId,
        total: count(),
        available: sql<number>`count(*) filter (where ${campaignVoucherCodes.claimId} is null and (${campaignVoucherCodes.expiresOn} is null or ${campaignVoucherCodes.expiresOn} >= ${today}))`.mapWith(Number),
        expired: sql<number>`count(*) filter (where ${campaignVoucherCodes.claimId} is null and ${campaignVoucherCodes.expiresOn} < ${today})`.mapWith(Number),
      })
      .from(campaignVoucherCodes)
      .where(inArray(campaignVoucherCodes.rewardId, rewardIds))
      .groupBy(campaignVoucherCodes.rewardId),
  ]);
  for (const row of claimRows) {
    const s = out.get(row.rewardId);
    if (!s) continue;
    s.claims += row.n;
    if (row.status !== "not_selected") s[row.status] += row.n;
  }
  for (const row of codeRows) {
    const s = out.get(row.rewardId);
    if (!s) continue;
    s.codesTotal = row.total;
    s.codesAvailable = row.available;
    s.codesExpired = row.expired;
  }
  return out;
}

function toCampaign(row: CampaignRow, rewardRows: RewardRow[], stats: Map<string, RewardStats>): Campaign {
  const byAudience = Object.fromEntries(rewardRows.map((r) => [r.audience, r])) as Partial<Record<CampaignAudience, RewardRow>>;
  const rewards = {} as Campaign["rewards"];
  const sideStats = {} as Campaign["stats"];
  for (const audience of CAMPAIGN_AUDIENCES) {
    const r = byAudience[audience];
    rewards[audience] = r
      ? toReward(r)
      : { id: "", audience, enabled: false, type: "voucher", title: "", details: "", valueRm: null, winnerCount: 1, drawnAt: null, announcedAt: null };
    sideStats[audience] = (r && stats.get(r.id)) || emptyStats();
  }
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    status: row.status,
    phase: campaignPhase(row.status, row.startsAt, row.endsAt),
    needsApproval: row.needsApproval,
    startsOn: row.startsAt ? mytDate(row.startsAt) : null,
    endsOn: row.endsAt ? mytLastDay(row.endsAt) : null,
    terms: row.terms,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    rewards,
    stats: sideStats,
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  if (rows.length === 0) return [];
  const rewardRows = await db
    .select()
    .from(campaignRewards)
    .where(inArray(campaignRewards.campaignId, rows.map((r) => r.id)));
  const stats = await statsFor(rewardRows.map((r) => r.id));
  const order: Record<Campaign["phase"], number> = { running: 0, scheduled: 1, paused: 2, draft: 3, finished: 4 };
  return rows
    .map((row) => toCampaign(row, rewardRows.filter((r) => r.campaignId === row.id), stats))
    .sort((a, b) => order[a.phase] - order[b.phase]);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!row) return null;
  const rewardRows = await db.select().from(campaignRewards).where(eq(campaignRewards.campaignId, id));
  return toCampaign(row, rewardRows, await statsFor(rewardRows.map((r) => r.id)));
}

async function requireCampaign(id: string): Promise<Campaign> {
  const campaign = await getCampaign(id);
  if (!campaign) throw new CampaignError("That campaign no longer exists.", 404);
  return campaign;
}

export async function createCampaign(name: unknown, userId: string): Promise<Campaign> {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean) throw new CampaignError("Give the campaign a name.");
  if (clean.length > CAMPAIGN_NAME_MAX) throw new CampaignError(`Keep the name under ${CAMPAIGN_NAME_MAX} characters.`);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(campaigns)
      .values({ name: clean, terms: termsTemplate(), createdByUserId: userId })
      .returning({ id: campaigns.id });
    await tx.insert(campaignRewards).values(CAMPAIGN_AUDIENCES.map((audience) => ({ campaignId: row.id, audience, enabled: true })));
    return row.id;
  });
  return requireCampaign(id);
}

// ───────────────────────── Editing ─────────────────────────

type RewardInput = {
  enabled: boolean;
  type: CampaignRewardType;
  title: string;
  details: string;
  valueRm: number | null;
  winnerCount: number;
};

type CampaignInput = {
  name: string;
  needsApproval: boolean;
  startsOn: string | null;
  endsOn: string | null;
  terms: string;
  rewards: Record<CampaignAudience, RewardInput>;
};

function parseRewardInput(audience: CampaignAudience, raw: unknown): RewardInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const side = SIDE_LABEL[audience].toLowerCase();
  const type = r.type === "draw" ? "draw" : r.type === "voucher" ? "voucher" : null;
  if (!type) throw new CampaignError(`Choose a reward type for ${side}.`);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (title.length > REWARD_TITLE_MAX) throw new CampaignError(`Keep the ${side} reward name under ${REWARD_TITLE_MAX} characters.`);
  const details = typeof r.details === "string" ? r.details.trim() : "";
  if (details.length > REWARD_DETAILS_MAX) throw new CampaignError(`Keep the ${side} details under ${REWARD_DETAILS_MAX} characters.`);
  let valueRm: number | null = null;
  if (r.valueRm !== null && r.valueRm !== undefined && r.valueRm !== "") {
    const n = Number(r.valueRm);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) throw new CampaignError(`Enter the ${side} voucher value in RM (or leave it empty).`);
    valueRm = Math.round(n * 100) / 100;
  }
  const winnerCount = Number(r.winnerCount ?? 1);
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > WINNER_COUNT_MAX) {
    throw new CampaignError(`The number of ${side} winners must be between 1 and ${WINNER_COUNT_MAX}.`);
  }
  return { enabled: r.enabled === true, type, title, details, valueRm, winnerCount };
}

function parseCampaignInput(raw: unknown): CampaignInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) throw new CampaignError("Give the campaign a name.");
  if (name.length > CAMPAIGN_NAME_MAX) throw new CampaignError(`Keep the name under ${CAMPAIGN_NAME_MAX} characters.`);
  const startsOn = b.startsOn === null || b.startsOn === "" || b.startsOn === undefined ? null : b.startsOn;
  const endsOn = b.endsOn === null || b.endsOn === "" || b.endsOn === undefined ? null : b.endsOn;
  if (startsOn !== null && !isIsoDate(startsOn)) throw new CampaignError("The start date isn't a real date.");
  if (endsOn !== null && !isIsoDate(endsOn)) throw new CampaignError("The end date isn't a real date.");
  if (startsOn && endsOn && endsOn < startsOn) throw new CampaignError("The end date is before the start date.");
  const terms = typeof b.terms === "string" ? b.terms.trim() : "";
  if (terms.length > CAMPAIGN_TERMS_MAX) throw new CampaignError(`Keep the terms under ${CAMPAIGN_TERMS_MAX} characters.`);
  const rewards = (b.rewards ?? {}) as Record<string, unknown>;
  return {
    name,
    needsApproval: b.needsApproval !== false,
    startsOn: startsOn as string | null,
    endsOn: endsOn as string | null,
    terms,
    rewards: {
      employer: parseRewardInput("employer", rewards.employer),
      jobseeker: parseRewardInput("jobseeker", rewards.jobseeker),
    },
  };
}

/** Problems that stop a campaign going (or staying) live. */
// Saving a live campaign skips the stock and date checks: running out of
// codes mid-campaign is normal, and must not stop the name being fixed.
function liveProblems(input: Pick<CampaignInput, "rewards" | "endsOn">, stats: Campaign["stats"], opts: { saving?: boolean } = {}): string[] {
  const problems: string[] = [];
  const enabled = CAMPAIGN_AUDIENCES.filter((a) => input.rewards[a].enabled);
  if (enabled.length === 0) problems.push("Turn on the reward for employers, jobseekers or both.");
  for (const a of enabled) {
    const reward = input.rewards[a];
    const side = SIDE_LABEL[a].toLowerCase();
    if (!reward.title) problems.push(`Say what ${side} get (the reward name).`);
    if (!opts.saving && reward.type === "voucher" && stats[a].codesAvailable === 0) {
      problems.push(`Add voucher codes for ${side} on the Voucher codes tab — there are none to give yet.`);
    }
  }
  if (!opts.saving && input.endsOn && input.endsOn < todayInMalaysia()) problems.push("The end date has already passed — move it later.");
  return problems;
}

/** Another campaign already live for one of these sides? (Call inside the lock.) */
async function liveConflict(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  campaignId: string,
  audiences: CampaignAudience[],
): Promise<string | null> {
  if (audiences.length === 0) return null;
  const rows = await tx
    .select({ name: campaigns.name, audience: campaignRewards.audience })
    .from(campaigns)
    .innerJoin(campaignRewards, eq(campaignRewards.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "live"),
        sql`${campaigns.id} <> ${campaignId}`,
        or(isNull(campaigns.endsAt), gt(campaigns.endsAt, new Date())),
        eq(campaignRewards.enabled, true),
        inArray(campaignRewards.audience, audiences),
      ),
    )
    .limit(1);
  const hit = rows[0];
  return hit ? `“${hit.name}” is already live for ${SIDE_LABEL[hit.audience].toLowerCase()}. Pause or end it first — only one campaign can run per side.` : null;
}

const LIVE_LOCK = sql`select pg_advisory_xact_lock(hashtext('campaigns:live'))`;

export async function updateCampaign(id: string, raw: unknown): Promise<Campaign> {
  const current = await requireCampaign(id);
  const input = parseCampaignInput(raw);
  const ended = current.phase === "finished";
  const drawn = CAMPAIGN_AUDIENCES.some((a) => current.rewards[a].drawnAt);

  if (current.status === "ended" && (input.startsOn !== current.startsOn || input.endsOn !== current.endsOn)) {
    throw new CampaignError("This campaign has ended, so its dates can't change.");
  }
  if (drawn && input.endsOn !== current.endsOn) throw new CampaignError("Winners have been picked, so the end date can't change.");
  if (input.endsOn && input.endsOn !== current.endsOn && input.endsOn < todayInMalaysia()) {
    throw new CampaignError("The end date can't be in the past.");
  }
  for (const a of CAMPAIGN_AUDIENCES) {
    const before = current.rewards[a];
    const next = input.rewards[a];
    const side = SIDE_LABEL[a].toLowerCase();
    if (next.type !== before.type && current.stats[a].claims > 0) {
      throw new CampaignError(`People have already claimed the ${side} reward, so its type can't change.`);
    }
    if (before.drawnAt && next.winnerCount !== before.winnerCount) {
      throw new CampaignError(`Winners have been picked for ${side}, so the number of winners can't change.`);
    }
    if (ended && next.enabled !== before.enabled) throw new CampaignError("This campaign has ended — sides can't be turned on or off.");
  }
  const staysLive = current.status === "live" && current.phase !== "finished";
  if (staysLive) {
    const problems = liveProblems(input, current.stats, { saving: true });
    if (problems.length) throw new CampaignError(`This campaign is live — ${problems[0].charAt(0).toLowerCase()}${problems[0].slice(1)}`);
  }

  await db.transaction(async (tx) => {
    if (staysLive) {
      await tx.execute(LIVE_LOCK);
      const turnedOn = CAMPAIGN_AUDIENCES.filter((a) => input.rewards[a].enabled && !current.rewards[a].enabled);
      const conflict = await liveConflict(tx, id, turnedOn);
      if (conflict) throw new CampaignError(conflict, 409);
    }
    await tx
      .update(campaigns)
      .set({
        name: input.name,
        needsApproval: input.needsApproval,
        startsAt: input.startsOn ? mytStartOfDay(input.startsOn) : null,
        endsAt: input.endsOn ? mytEndOfDay(input.endsOn) : null,
        terms: input.terms,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));
    for (const a of CAMPAIGN_AUDIENCES) {
      const r = input.rewards[a];
      await tx
        .update(campaignRewards)
        .set({ enabled: r.enabled, type: r.type, title: r.title, details: r.details, valueRm: r.valueRm, winnerCount: r.winnerCount, updatedAt: new Date() })
        .where(eq(campaignRewards.id, current.rewards[a].id));
    }
  });
  return requireCampaign(id);
}

export async function setCampaignStatus(id: string, action: unknown): Promise<Campaign> {
  const current = await requireCampaign(id);
  if (action === "live") {
    if (current.status === "ended" || current.phase === "finished") throw new CampaignError("This campaign has ended. Start a new one instead.");
    if (current.status === "live") return current;
    const problems = liveProblems({ rewards: current.rewards, endsOn: current.endsOn }, current.stats);
    if (problems.length) throw new CampaignError(problems[0]);
    await db.transaction(async (tx) => {
      await tx.execute(LIVE_LOCK);
      const conflict = await liveConflict(tx, id, CAMPAIGN_AUDIENCES.filter((a) => current.rewards[a].enabled));
      if (conflict) throw new CampaignError(conflict, 409);
      await tx.update(campaigns).set({ status: "live", updatedAt: new Date() }).where(eq(campaigns.id, id));
    });
  } else if (action === "pause") {
    if (current.status !== "live" || current.phase === "finished") throw new CampaignError("Only a live campaign can be paused.");
    await db.update(campaigns).set({ status: "paused", updatedAt: new Date() }).where(eq(campaigns.id, id));
  } else if (action === "end") {
    if (current.status === "draft") throw new CampaignError("This campaign never went live — delete it instead.");
    if (current.status === "ended") return current;
    await db.update(campaigns).set({ status: "ended", endedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, id));
  } else {
    throw new CampaignError("Unknown action.");
  }
  return requireCampaign(id);
}

export async function deleteCampaign(id: string): Promise<void> {
  const current = await requireCampaign(id);
  const claims = CAMPAIGN_AUDIENCES.reduce((n, a) => n + current.stats[a].claims, 0);
  if (claims > 0) throw new CampaignError("People have already claimed rewards from this campaign, so it can't be deleted. End it instead — their rewards stay safe.");
  if (current.status === "live" && current.phase !== "finished") throw new CampaignError("Pause or end the campaign before deleting it.");
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ───────────────────────── Voucher codes ─────────────────────────

async function requireReward(campaignId: string, audience: unknown): Promise<{ campaign: Campaign; reward: CampaignReward }> {
  if (audience !== "employer" && audience !== "jobseeker") throw new CampaignError("Choose employers or jobseekers.");
  const campaign = await requireCampaign(campaignId);
  return { campaign, reward: campaign.rewards[audience] };
}

export async function addVoucherCodes(
  campaignId: string,
  audience: unknown,
  text: unknown,
  batchExpiresOn: unknown,
): Promise<{ campaign: Campaign; added: number; skipped: number; invalid: number }> {
  const { campaign, reward } = await requireReward(campaignId, audience);
  if (reward.type !== "voucher") throw new CampaignError("This side's reward is a lucky draw — it doesn't use codes.");
  if (campaign.status === "ended") throw new CampaignError("This campaign has ended.");
  if (typeof text !== "string" || !text.trim()) throw new CampaignError("Paste some codes, or choose a CSV file.");
  const expiry = batchExpiresOn === null || batchExpiresOn === undefined || batchExpiresOn === "" ? null : batchExpiresOn;
  if (expiry !== null && !isIsoDate(expiry)) throw new CampaignError("The expiry date isn't a real date.");
  const parsed = parseVoucherCodes(text);
  if (parsed.codes.length === 0) {
    throw new CampaignError(parsed.invalid ? "None of those lines look like codes (one code per line, no spaces)." : "No codes found.");
  }
  if (parsed.codes.length > CODES_PER_UPLOAD_MAX) throw new CampaignError(`Upload at most ${CODES_PER_UPLOAD_MAX.toLocaleString()} codes at a time.`);
  let added = 0;
  for (let i = 0; i < parsed.codes.length; i += 500) {
    const chunk = parsed.codes.slice(i, i + 500);
    const rows = await db
      .insert(campaignVoucherCodes)
      .values(chunk.map((c) => ({ rewardId: reward.id, code: c.code, expiresOn: c.expiresOn ?? (expiry as string | null) })))
      .onConflictDoNothing()
      .returning({ id: campaignVoucherCodes.id });
    added += rows.length;
  }
  return {
    campaign: await requireCampaign(campaignId),
    added,
    skipped: parsed.duplicates + (parsed.codes.length - added),
    invalid: parsed.invalid,
  };
}

export type VoucherCodeRow = {
  id: string;
  code: string;
  expiresOn: string | null;
  state: "available" | "expired" | "reserved" | "given";
  givenTo: string | null;
};

export async function listVoucherCodes(campaignId: string, audience: unknown): Promise<VoucherCodeRow[]> {
  const { reward } = await requireReward(campaignId, audience);
  const today = todayInMalaysia();
  const rows = await db
    .select({
      id: campaignVoucherCodes.id,
      code: campaignVoucherCodes.code,
      expiresOn: campaignVoucherCodes.expiresOn,
      claimStatus: campaignClaims.status,
      email: campaignClaims.userEmail,
    })
    .from(campaignVoucherCodes)
    .leftJoin(campaignClaims, eq(campaignClaims.id, campaignVoucherCodes.claimId))
    .where(eq(campaignVoucherCodes.rewardId, reward.id))
    .orderBy(asc(campaignVoucherCodes.createdAt), asc(campaignVoucherCodes.code));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    expiresOn: r.expiresOn,
    state: r.claimStatus === "approved" ? "given" : r.claimStatus ? "reserved" : r.expiresOn && r.expiresOn < today ? "expired" : "available",
    givenTo: r.email ?? null,
  }));
}

/** Removes codes nobody holds — one (`codeId`) or every unused one. */
export async function removeVoucherCodes(campaignId: string, audience: unknown, codeId: unknown): Promise<Campaign> {
  const { reward } = await requireReward(campaignId, audience);
  if (codeId !== "unused" && !isUuid(codeId)) throw new CampaignError("Unknown code.");
  await db
    .delete(campaignVoucherCodes)
    .where(
      and(
        eq(campaignVoucherCodes.rewardId, reward.id),
        isNull(campaignVoucherCodes.claimId),
        codeId === "unused" ? undefined : eq(campaignVoucherCodes.id, codeId as string),
      ),
    );
  return requireCampaign(campaignId);
}

// ───────────────────────── Claims (superadmin) ─────────────────────────

export async function listClaims(campaignId: string): Promise<CampaignClaimRow[]> {
  if (!isUuid(campaignId)) return [];
  const rows = await db
    .select({
      claim: campaignClaims,
      rewardType: campaignRewards.type,
      code: campaignVoucherCodes.code,
      codeExpiresOn: campaignVoucherCodes.expiresOn,
      accountCreatedAt: users.createdAt,
    })
    .from(campaignClaims)
    .innerJoin(campaignRewards, eq(campaignRewards.id, campaignClaims.rewardId))
    .leftJoin(campaignVoucherCodes, eq(campaignVoucherCodes.id, campaignClaims.codeId))
    .leftJoin(users, eq(users.id, campaignClaims.userId))
    .where(eq(campaignClaims.campaignId, campaignId))
    .orderBy(desc(campaignClaims.createdAt));

  const userIds = [...new Set(rows.map((r) => r.claim.userId).filter((id): id is string => !!id))];
  const [seekers, employers] = userIds.length
    ? await Promise.all([
        db
          .select({ userId: jobseekerProfiles.userId, resume: jobseekerProfiles.resumeFileName })
          .from(jobseekerProfiles)
          .where(inArray(jobseekerProfiles.userId, userIds)),
        db
          .select({
            userId: employerProfiles.userId,
            companyName: employerProfiles.companyName,
            phone: employerProfiles.contactPhone,
            ssm: employerProfiles.ssmVerificationStatus,
          })
          .from(employerProfiles)
          .where(inArray(employerProfiles.userId, userIds)),
      ])
    : [[], []];

  const now = Date.now();
  return rows.map(({ claim, rewardType, code, codeExpiresOn, accountCreatedAt }) => {
    const checks: CampaignClaimRow["checks"] = [];
    let companyName: string | null = null;
    if (!claim.userId || !accountCreatedAt) {
      checks.push({ label: "Account deleted", ok: false });
    } else {
      const days = Math.floor((now - accountCreatedAt.getTime()) / 86_400_000);
      checks.push({ label: days === 0 ? "Joined today" : `Joined ${days} day${days === 1 ? "" : "s"} ago`, ok: days >= 3 });
      if (claim.audience === "jobseeker") {
        const seeker = seekers.find((s) => s.userId === claim.userId);
        checks.push(seeker?.resume ? { label: "Resume on file", ok: true } : { label: "No resume yet", ok: false });
      } else {
        const own = employers.filter((e) => e.userId === claim.userId);
        const company = own.find((e) => toMalaysianMobileE164(e.phone) === claim.phone) ?? own[0];
        companyName = company?.companyName ?? null;
        checks.push(company?.ssm === "verified" ? { label: "SSM verified", ok: true } : { label: "SSM not verified", ok: false });
      }
    }
    return {
      id: claim.id,
      audience: claim.audience,
      rewardType,
      status: claim.status,
      userId: claim.userId,
      userName: claim.userName,
      userEmail: claim.userEmail,
      phone: claim.phone,
      accountCreatedAt: accountCreatedAt?.toISOString() ?? null,
      companyName,
      checks,
      code: code ?? null,
      codeExpiresOn: codeExpiresOn ?? null,
      rejectReason: claim.rejectReason,
      reviewedByEmail: claim.reviewedByEmail,
      reviewedAt: claim.reviewedAt?.toISOString() ?? null,
      createdAt: claim.createdAt.toISOString(),
    };
  });
}

/** Rewards waiting for a superadmin, across every campaign — for the sidebar count. */
export async function pendingApprovalCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(campaignClaims)
    .where(inArray(campaignClaims.status, ["pending", "selected"]));
  return row?.n ?? 0;
}

// Messages are sent after the response (see the routes' `after`), so a slow
// email provider never holds up an approval.
export type RewardMessage = {
  userId: string | null;
  email: string;
  name: string | null;
  audience: CampaignAudience;
  title: string;
  body: string;
  emailSubject?: string;
};

export async function deliverRewardMessages(messages: RewardMessage[]) {
  for (const m of messages) {
    if (m.userId) {
      await notify([m.userId], m.audience, { type: "campaign_reward", title: m.title, body: m.body, link: `/${m.audience}/rewards` });
    }
    if (m.emailSubject) {
      try {
        await sendCampaignRewardEmail({ email: m.email, name: m.name, subject: m.emailSubject, lead: m.body, path: `/${m.audience}/rewards` });
      } catch (err) {
        console.error("Failed to send a campaign reward email", err);
      }
    }
  }
}

const campaignLock = (campaignId: string) => sql`select pg_advisory_xact_lock(hashtext(${`campaign:${campaignId}`}))`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Picks up to `n` random draw entries for this reward and marks them. */
async function drawEntries(tx: Tx, rewardId: string, n: number, status: "selected" | "won"): Promise<number> {
  if (n <= 0) return 0;
  const entries = await tx
    .select({ id: campaignClaims.id })
    .from(campaignClaims)
    .where(and(eq(campaignClaims.rewardId, rewardId), eq(campaignClaims.status, "entered")));
  // Fisher–Yates with a cryptographic random source — every entry has the same chance.
  const ids = entries.map((e) => e.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const picked = ids.slice(0, n);
  if (picked.length) {
    await tx.update(campaignClaims).set({ status, updatedAt: new Date() }).where(inArray(campaignClaims.id, picked));
  }
  return picked.length;
}

export async function reviewClaims(
  campaignId: string,
  ids: unknown,
  decision: unknown,
  reason: unknown,
  reviewerEmail: string,
): Promise<{ campaign: Campaign; updated: number; replaced: number; messages: RewardMessage[] }> {
  await requireCampaign(campaignId);
  if (decision !== "approve" && decision !== "reject") throw new CampaignError("Choose approve or reject.");
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 || !ids.every(isUuid)) throw new CampaignError("Choose who to review.");
  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, REJECT_REASON_MAX) : "";
  const messages: RewardMessage[] = [];
  let updated = 0;
  let replaced = 0;

  await db.transaction(async (tx) => {
    await tx.execute(campaignLock(campaignId));
    const rows = await tx
      .select({ claim: campaignClaims, reward: campaignRewards })
      .from(campaignClaims)
      .innerJoin(campaignRewards, eq(campaignRewards.id, campaignClaims.rewardId))
      .where(and(eq(campaignClaims.campaignId, campaignId), inArray(campaignClaims.id, ids as string[])));
    const now = new Date();
    const reviewed = { reviewedByEmail: reviewerEmail, reviewedAt: now, updatedAt: now };
    const rejectedWinnersByReward = new Map<string, number>();

    for (const { claim, reward } of rows) {
      if (claim.status === "pending") {
        if (decision === "approve") {
          await tx.update(campaignClaims).set({ status: "approved", rejectReason: null, ...reviewed }).where(eq(campaignClaims.id, claim.id));
          messages.push({
            userId: claim.userId,
            email: claim.userEmail,
            name: claim.userName,
            audience: claim.audience,
            title: "Your reward is ready 🎉",
            body: `Your ${reward.title} is ready. Open My Rewards to see your code.`,
            emailSubject: `Your JobGiga reward is ready: ${reward.title}`,
          });
        } else {
          await tx.update(campaignVoucherCodes).set({ claimId: null }).where(eq(campaignVoucherCodes.claimId, claim.id));
          await tx
            .update(campaignClaims)
            .set({ status: "rejected", codeId: null, rejectReason: cleanReason || null, ...reviewed })
            .where(eq(campaignClaims.id, claim.id));
          messages.push({
            userId: claim.userId,
            email: claim.userEmail,
            name: claim.userName,
            audience: claim.audience,
            title: "About your reward",
            body: `Sorry — your claim for the ${reward.title} wasn't approved.${cleanReason ? ` Reason: ${cleanReason}` : ""}`,
          });
        }
        updated++;
      } else if (claim.status === "selected") {
        if (decision === "approve") {
          await tx.update(campaignClaims).set({ status: "won", rejectReason: null, ...reviewed }).where(eq(campaignClaims.id, claim.id));
        } else {
          await tx.update(campaignClaims).set({ status: "rejected", rejectReason: cleanReason || null, ...reviewed }).where(eq(campaignClaims.id, claim.id));
          rejectedWinnersByReward.set(reward.id, (rejectedWinnersByReward.get(reward.id) ?? 0) + 1);
        }
        updated++;
      }
    }
    // A rejected winner is replaced by another random entry, still waiting for approval.
    for (const [rewardId, n] of rejectedWinnersByReward) replaced += await drawEntries(tx, rewardId, n, "selected");
  });

  if (updated === 0) throw new CampaignError("Those have already been reviewed.", 409);
  return { campaign: await requireCampaign(campaignId), updated, replaced, messages };
}

// The lucky draw, in two steps: "Pick winners" draws them at random (nobody
// is told yet — the superadmin can swap anyone with "Pick someone else"),
// then "Confirm & announce" makes them winners and tells everyone.

export async function pickWinners(campaignId: string, audience: unknown): Promise<{ campaign: Campaign; picked: number }> {
  const { campaign, reward } = await requireReward(campaignId, audience);
  if (reward.type !== "draw") throw new CampaignError("This side's reward isn't a lucky draw.");
  if (campaign.phase !== "finished") throw new CampaignError("Winners can be picked once the campaign has ended.");
  if (reward.drawnAt) throw new CampaignError("Winners have already been picked.", 409);
  let picked = 0;
  await db.transaction(async (tx) => {
    await tx.execute(campaignLock(campaignId));
    const [fresh] = await tx.select({ drawnAt: campaignRewards.drawnAt }).from(campaignRewards).where(eq(campaignRewards.id, reward.id));
    if (fresh?.drawnAt) throw new CampaignError("Winners have already been picked.", 409);
    picked = await drawEntries(tx, reward.id, reward.winnerCount, "selected");
    if (picked === 0) throw new CampaignError("Nobody entered this draw, so there's no one to pick.");
    await tx.update(campaignRewards).set({ drawnAt: new Date(), updatedAt: new Date() }).where(eq(campaignRewards.id, reward.id));
  });
  return { campaign: await requireCampaign(campaignId), picked };
}

/** Swaps one picked winner for another random entry (before the announcement). */
export async function swapWinner(campaignId: string, claimId: unknown): Promise<{ campaign: Campaign; replaced: boolean }> {
  await requireCampaign(campaignId);
  if (!isUuid(claimId)) throw new CampaignError("Unknown winner.");
  let replaced = false;
  await db.transaction(async (tx) => {
    await tx.execute(campaignLock(campaignId));
    const [claim] = await tx
      .select({ rewardId: campaignClaims.rewardId, status: campaignClaims.status })
      .from(campaignClaims)
      .where(and(eq(campaignClaims.id, claimId), eq(campaignClaims.campaignId, campaignId)));
    if (!claim || claim.status !== "selected") throw new CampaignError("That person isn't a picked winner any more.", 409);
    await tx.update(campaignClaims).set({ status: "not_selected", updatedAt: new Date() }).where(eq(campaignClaims.id, claimId));
    replaced = (await drawEntries(tx, claim.rewardId, 1, "selected")) === 1;
  });
  return { campaign: await requireCampaign(campaignId), replaced };
}

export async function announceResults(
  campaignId: string,
  audience: unknown,
  reviewerEmail: string,
): Promise<{ campaign: Campaign; messages: RewardMessage[] }> {
  const { reward } = await requireReward(campaignId, audience);
  if (reward.type !== "draw") throw new CampaignError("This side's reward isn't a lucky draw.");
  if (!reward.drawnAt) throw new CampaignError("Pick the winners first.");
  if (reward.announcedAt) throw new CampaignError("The results have already been announced.", 409);
  const messages: RewardMessage[] = [];
  await db.transaction(async (tx) => {
    await tx.execute(campaignLock(campaignId));
    const [fresh] = await tx.select({ announcedAt: campaignRewards.announcedAt }).from(campaignRewards).where(eq(campaignRewards.id, reward.id));
    if (fresh?.announcedAt) throw new CampaignError("The results have already been announced.", 409);
    const now = new Date();
    await tx
      .update(campaignClaims)
      .set({ status: "won", reviewedByEmail: reviewerEmail, reviewedAt: now, updatedAt: now })
      .where(and(eq(campaignClaims.rewardId, reward.id), eq(campaignClaims.status, "selected")));
    await tx
      .update(campaignClaims)
      .set({ status: "not_selected", updatedAt: new Date() })
      .where(and(eq(campaignClaims.rewardId, reward.id), eq(campaignClaims.status, "entered")));
    await tx.update(campaignRewards).set({ announcedAt: new Date(), updatedAt: new Date() }).where(eq(campaignRewards.id, reward.id));
    const everyone = await tx
      .select()
      .from(campaignClaims)
      .where(and(eq(campaignClaims.rewardId, reward.id), inArray(campaignClaims.status, ["won", "not_selected", "rejected"])));
    for (const c of everyone) {
      const base = { userId: c.userId, email: c.userEmail, name: c.userName, audience: c.audience };
      if (c.status === "won") {
        messages.push({
          ...base,
          title: "You won the lucky draw! 🎉",
          body: `Congratulations — you won the ${reward.title}! We'll be in touch about your prize.`,
          emailSubject: `You won the JobGiga lucky draw: ${reward.title}`,
        });
      } else if (c.status === "rejected") {
        messages.push({
          ...base,
          title: "Lucky draw results",
          body: `The ${reward.title} lucky draw is over. Your entry wasn't eligible this time.${c.rejectReason ? ` Reason: ${c.rejectReason}` : ""}`,
        });
      } else {
        messages.push({ ...base, title: "Lucky draw results", body: `The ${reward.title} lucky draw is over. You weren't picked this time — thanks for taking part!` });
      }
    }
  });
  return { campaign: await requireCampaign(campaignId), messages };
}

function csvCell(value: string | null | undefined) {
  const v = value ?? "";
  // Leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function claimsCsv(campaignId: string): Promise<{ filename: string; csv: string }> {
  const campaign = await requireCampaign(campaignId);
  const rows = await listClaims(campaignId);
  const header = ["Side", "Name", "Email", "Phone", "Company", "Reward", "Status", "Voucher code", "Code expires", "Claimed (MYT)", "Reviewed by", "Reviewed (MYT)", "Reason"];
  const lines = rows.map((r) =>
    [
      SIDE_LABEL[r.audience],
      r.userName,
      r.userEmail,
      r.phone,
      r.companyName,
      campaign.rewards[r.audience].title,
      CLAIM_STATUS_LABEL[r.status],
      r.code,
      r.codeExpiresOn,
      formatMytDateTime(r.createdAt),
      r.reviewedByEmail,
      r.reviewedAt ? formatMytDateTime(r.reviewedAt) : "",
      r.rejectReason,
    ]
      .map(csvCell)
      .join(","),
  );
  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
  return { filename: `${slug}-claims.csv`, csv: `﻿${[header.join(","), ...lines].join("\r\n")}\r\n` };
}

// ───────────────────────── The person's side ─────────────────────────

function isDummyEmail(email: string) {
  const e = email.toLowerCase();
  return e.endsWith(`@${DUMMY_APPLICANT_EMAIL_DOMAIN}`) || e.endsWith(`@${DUMMY_TEAM_EMAIL_DOMAIN}`);
}

type RunningReward = { campaign: CampaignRow; reward: RewardRow };

/** Is there an unexpired code nobody holds yet? */
async function hasCodeInStock(rewardId: string): Promise<boolean> {
  const [code] = await db
    .select({ id: campaignVoucherCodes.id })
    .from(campaignVoucherCodes)
    .where(
      and(
        eq(campaignVoucherCodes.rewardId, rewardId),
        isNull(campaignVoucherCodes.claimId),
        or(isNull(campaignVoucherCodes.expiresOn), sql`${campaignVoucherCodes.expiresOn} >= ${todayInMalaysia()}`),
      ),
    )
    .limit(1);
  return !!code;
}

/** The campaign running for this side right now, if any (one per request). */
const runningRewardFor = cache(async (audience: CampaignAudience): Promise<RunningReward | null> => {
  const now = new Date();
  const [row] = await db
    .select({ campaign: campaigns, reward: campaignRewards })
    .from(campaigns)
    .innerJoin(campaignRewards, eq(campaignRewards.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "live"),
        eq(campaigns.trigger, "phone_verified"),
        or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
        or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
        eq(campaignRewards.audience, audience),
        eq(campaignRewards.enabled, true),
      ),
    )
    .orderBy(asc(campaigns.createdAt))
    .limit(1);
  return row ?? null;
});

/**
 * Who qualifies on this side: a jobseeker, or an employer acting as the
 * owner of a company they registered — with that profile's phone verified.
 * Superadmins and dummy/sample accounts never do.
 */
async function qualifyingPerson(userId: string, audience: CampaignAudience): Promise<{ email: string; name: string | null; phone: string } | null> {
  const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || isSuperadminEmail(user.email) || isDummyEmail(user.email)) return null;
  let phoneAsTyped: string | null = null;
  let name = user.name;
  if (audience === "employer") {
    const access = await getEmployerAccess(userId);
    if (!access || access.role !== "owner" || access.profile.userId !== userId) return null;
    phoneAsTyped = access.profile.contactPhone;
    name = access.profile.contactName || name;
  } else {
    const [profile] = await db
      .select({ phone: jobseekerProfiles.phone, fullName: jobseekerProfiles.fullName })
      .from(jobseekerProfiles)
      .where(eq(jobseekerProfiles.userId, userId))
      .limit(1);
    if (!profile) return null;
    phoneAsTyped = profile.phone;
    name = profile.fullName || name;
  }
  const phone = phoneAsTyped ? toMalaysianMobileE164(phoneAsTyped) : null;
  if (!phone) return null;
  const [verified] = await db
    .select({ id: verifiedPhones.id })
    .from(verifiedPhones)
    .where(and(eq(verifiedPhones.userId, userId), eq(verifiedPhones.phone, phone)))
    .limit(1);
  return verified ? { email: user.email, name, phone } : null;
}

/**
 * Gives this person the running campaign's reward for their side, if they
 * qualify and haven't had one from it (on either side, or on this phone
 * number). Safe to call as often as you like — it only ever creates one.
 */
export async function ensureCampaignClaim(userId: string, audience: CampaignAudience): Promise<void> {
  const running = await runningRewardFor(audience);
  if (!running) return;
  const { campaign, reward } = running;
  const [mine] = await db
    .select({ id: campaignClaims.id })
    .from(campaignClaims)
    .where(and(eq(campaignClaims.campaignId, campaign.id), eq(campaignClaims.userId, userId)))
    .limit(1);
  if (mine) return;
  const person = await qualifyingPerson(userId, audience);
  if (!person) return;
  // Cheap checks without the lock first — this runs on every page view, and
  // most of the time there's nothing to give (phone already used, or out of
  // codes). The lock below is only taken when a claim is likely, and the
  // same checks are repeated under it.
  const [phoneUsed] = await db
    .select({ id: campaignClaims.id })
    .from(campaignClaims)
    .where(and(eq(campaignClaims.campaignId, campaign.id), eq(campaignClaims.phone, person.phone)))
    .limit(1);
  if (phoneUsed) return;
  if (reward.type === "voucher" && !(await hasCodeInStock(reward.id))) return;

  try {
    await db.transaction(async (tx) => {
      await tx.execute(campaignLock(campaign.id));
      const [taken] = await tx
        .select({ id: campaignClaims.id })
        .from(campaignClaims)
        .where(and(eq(campaignClaims.campaignId, campaign.id), or(eq(campaignClaims.userId, userId), eq(campaignClaims.phone, person.phone))))
        .limit(1);
      if (taken) return;
      let codeId: string | null = null;
      if (reward.type === "voucher") {
        // Soonest-expiring codes go first, so fewer go to waste.
        const [code] = await tx
          .select({ id: campaignVoucherCodes.id })
          .from(campaignVoucherCodes)
          .where(
            and(
              eq(campaignVoucherCodes.rewardId, reward.id),
              isNull(campaignVoucherCodes.claimId),
              or(isNull(campaignVoucherCodes.expiresOn), sql`${campaignVoucherCodes.expiresOn} >= ${todayInMalaysia()}`),
            ),
          )
          .orderBy(sql`${campaignVoucherCodes.expiresOn} asc nulls last`, asc(campaignVoucherCodes.createdAt))
          .limit(1);
        if (!code) return; // Out of stock: nothing to give (yet).
        codeId = code.id;
      }
      const status: CampaignClaimStatus = reward.type === "draw" ? "entered" : campaign.needsApproval ? "pending" : "approved";
      const [claim] = await tx
        .insert(campaignClaims)
        .values({
          campaignId: campaign.id,
          rewardId: reward.id,
          audience,
          userId,
          phone: person.phone,
          userEmail: person.email,
          userName: person.name,
          status,
          codeId,
        })
        .returning({ id: campaignClaims.id });
      if (codeId) await tx.update(campaignVoucherCodes).set({ claimId: claim.id }).where(eq(campaignVoucherCodes.id, codeId));
    });
  } catch (err) {
    // Another request got there first (the unique constraints) — that's fine.
    if ((err as { code?: string })?.code !== "23505") console.error("Failed to create a campaign claim", err);
  }
}

type ClaimWithReward = {
  claim: typeof campaignClaims.$inferSelect;
  reward: RewardRow;
  campaign: CampaignRow;
  code: string | null;
  codeExpiresOn: string | null;
};

function userState(claim: ClaimWithReward["claim"], reward: RewardRow): UserRewardState {
  if (reward.type === "voucher") {
    return claim.status === "approved" ? "ready" : claim.status === "rejected" ? "not_eligible" : "reviewing";
  }
  // Nothing about a draw shows until the results are announced.
  if (!reward.announcedAt) return "in_draw";
  return claim.status === "won" ? "won" : claim.status === "rejected" ? "not_eligible" : "not_won";
}

function toUserReward({ claim, reward, campaign, code, codeExpiresOn }: ClaimWithReward): UserReward {
  const state = userState(claim, reward);
  return {
    id: claim.id,
    campaignName: campaign.name,
    audience: claim.audience,
    type: reward.type,
    title: reward.title,
    details: reward.details,
    state,
    code: state === "ready" ? code : null,
    codeExpiresOn: state === "ready" ? codeExpiresOn : null,
    rejectReason: state === "not_eligible" ? claim.rejectReason : null,
    endsOn: campaign.endsAt ? mytLastDay(campaign.endsAt) : null,
    terms: campaign.terms,
    createdAt: claim.createdAt.toISOString(),
  };
}

async function userClaims(userId: string, audience: CampaignAudience): Promise<ClaimWithReward[]> {
  return db
    .select({
      claim: campaignClaims,
      reward: campaignRewards,
      campaign: campaigns,
      code: campaignVoucherCodes.code,
      codeExpiresOn: campaignVoucherCodes.expiresOn,
    })
    .from(campaignClaims)
    .innerJoin(campaignRewards, eq(campaignRewards.id, campaignClaims.rewardId))
    .innerJoin(campaigns, eq(campaigns.id, campaignClaims.campaignId))
    .leftJoin(campaignVoucherCodes, eq(campaignVoucherCodes.id, campaignClaims.codeId))
    .where(and(eq(campaignClaims.userId, userId), eq(campaignClaims.audience, audience)))
    .orderBy(desc(campaignClaims.createdAt));
}

export async function listUserRewards(userId: string, audience: CampaignAudience): Promise<UserReward[]> {
  return (await userClaims(userId, audience)).map(toUserReward);
}

/** Everything the dashboard needs about rewards, worked out with the page (see getAuthUser). */
export async function getRewardHints(
  userId: string,
  email: string,
  audience: CampaignAudience,
  phoneVerified: boolean,
  mayVerify: boolean,
): Promise<RewardHints> {
  if (phoneVerified) await ensureCampaignClaim(userId, audience);
  const claims = await userClaims(userId, audience);
  let verifyBarText: string | null = null;
  if (!phoneVerified && mayVerify && !isSuperadminEmail(email) && !isDummyEmail(email)) {
    const running = await runningRewardFor(audience);
    if (running && running.reward.title && !claims.some((c) => c.campaign.id === running.campaign.id)) {
      if (running.reward.type === "draw" || (await hasCodeInStock(running.reward.id))) {
        verifyBarText = verifyBarRewardText(running.reward.type, running.reward.title);
      }
    }
  }
  // The popup celebrates something earned — never a "not selected" or "not
  // eligible" result (those reach people through the bell instead).
  const unseen = claims.map(toUserReward).find((r, i) => !claims[i].claim.seenAt && r.state !== "not_won" && r.state !== "not_eligible");
  return { verifyBarText, hasRewards: claims.length > 0, popup: unseen ?? null };
}

export async function markRewardSeen(userId: string, claimId: unknown): Promise<void> {
  if (!isUuid(claimId)) return;
  await db
    .update(campaignClaims)
    .set({ seenAt: new Date() })
    .where(and(eq(campaignClaims.id, claimId), eq(campaignClaims.userId, userId), isNull(campaignClaims.seenAt)));
}

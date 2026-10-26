import "server-only";
import { Resend } from "resend";
import { TEAM_ROLE_DESCRIPTION, TEAM_ROLE_LABEL, type TeamRole } from "./team-roles";

let client: Resend | null = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");
  client ??= new Resend(apiKey);
  return client;
}

export async function sendOtpEmail(email: string, code: string) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  // The SDK resolves with { data, error } instead of rejecting on API
  // errors (e.g. sending to an address the account isn't allowed to send
  // to yet) — checking `error` is required, or failed sends look like
  // successes to every caller.
  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `${code} is your JobGiga verification code`,
    text: `Your JobGiga verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">Your JobGiga verification code is:</p>
        <p style="font-size:32px;font-weight:600;letter-spacing:6px;color:#141B2E;margin:12px 0">${code}</p>
        <p style="font-size:13px;color:#9AA3B2">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Tells the superadmins that phone verification paused itself because it hit the daily send budget. */
export async function sendPhoneBudgetAlertEmail(to: string[], sent: number, limit: number) {
  // Nobody to tell (no superadmin emails configured) is not an error.
  if (to.length === 0) return;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");
  const { error } = await getClient().emails.send({
    from,
    to,
    subject: "JobGiga: phone verification paused (daily limit reached)",
    text: `Phone verification has sent ${sent} texts and calls in the last 24 hours — the daily limit is ${limit} — so new codes are paused until the count drops.\n\nThis protects the Twilio bill from abuse. If the traffic is real, raise PHONE_VERIFICATION_DAILY_LIMIT in the server's environment. If it looks like abuse, check the phone_verification_attempts table (phone, ip, created_at).`,
    html: `
      <div style="font-family:sans-serif;max-width:460px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468"><strong>Phone verification paused itself.</strong></p>
        <p style="font-size:14px;color:#4B5468">It has sent <strong>${sent}</strong> texts and calls in the last 24 hours. The daily limit is <strong>${limit}</strong>, so new codes are paused until the count drops. This protects the Twilio bill from abuse.</p>
        <p style="font-size:14px;color:#4B5468">If the traffic is real, raise <code>PHONE_VERIFICATION_DAILY_LIMIT</code> in the server&rsquo;s environment. If it looks like abuse, check the <code>phone_verification_attempts</code> table (phone, ip, created_at).</p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
}

/** Tells a shortlisted applicant an employer sent them an AI interview, with the deadline. */
export async function sendAiInterviewInviteEmail(params: {
  email: string;
  applicantName: string;
  companyName: string;
  jobTitle: string;
  deadline: Date;
  interviewId: string;
  answerSeconds: number;
  extended?: boolean;
}) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${siteUrl}/jobseeker/ai-interview/${params.interviewId}`;
  const deadline = params.deadline.toLocaleDateString("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kuala_Lumpur",
  });
  const company = escapeHtml(params.companyName);
  const job = escapeHtml(params.jobTitle);
  const name = escapeHtml(params.applicantName.split(" ")[0] || "there");
  const lead = params.extended
    ? `${params.companyName} extended your deadline for the AI interview for ${params.jobTitle}.`
    : `${params.companyName} would like to know more about how you'd do the ${params.jobTitle} job. They sent you a short AI interview: 5 questions, answered by a quick recording.`;

  const { error } = await getClient().emails.send({
    from,
    to: params.email,
    subject: params.extended
      ? `New deadline for your ${params.jobTitle} interview at ${params.companyName}`
      : `${params.companyName} sent you an AI interview for ${params.jobTitle}`,
    text: `Hi ${params.applicantName.split(" ")[0] || "there"},\n\n${lead}\n\nEach answer is up to ${params.answerSeconds} seconds, by video or audio — your choice. It takes about 10 minutes.\n\nStart here: ${url}\n\nPlease finish by ${deadline}.`,
    html: `
      <div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">Hi ${name},</p>
        <p style="font-size:14px;color:#4B5468">${params.extended ? `<strong>${company}</strong> extended your deadline for the AI interview for <strong>${job}</strong>.` : `<strong>${company}</strong> would like to know more about how you&rsquo;d do the <strong>${job}</strong> job. They sent you a short AI interview: 5 questions, answered by a quick recording.`}</p>
        <p style="font-size:14px;color:#4B5468">Each answer is up to ${params.answerSeconds} seconds, by video or audio &mdash; your choice. It takes about 10 minutes.</p>
        <p style="margin:20px 0">
          <a href="${url}" style="display:inline-block;background:#141B2E;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:999px">Start the interview</a>
        </p>
        <p style="font-size:13px;color:#9AA3B2">Please finish by ${deadline}.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

export async function sendTeamInviteEmail(
  email: string,
  companyName: string,
  inviterLabel: string,
  role: TeamRole,
  inviteToken: string,
) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // /invite/[id] sorts out who's signed in (signs out a different account,
  // opens Sign in for this email) before continuing into the team.
  const inviteUrl = `${siteUrl}/invite/${inviteToken}`;
  const roleLabel = TEAM_ROLE_LABEL[role] ?? role;
  const roleDescription = TEAM_ROLE_DESCRIPTION[role] ?? "";

  const { error } = await getClient().emails.send({
    from,
    to: email,
    subject: `${inviterLabel} invited you to join ${companyName} on JobGiga`,
    text: `${inviterLabel} invited you to join ${companyName} on JobGiga as ${roleLabel}. ${roleDescription}\n\nAccept the invite (sign in with ${email}): ${inviteUrl}\n\nThis link expires in 7 days.\n\nIf you weren't expecting this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">${inviterLabel} invited you to join <strong>${companyName}</strong> on JobGiga as <strong>${roleLabel}</strong>. ${roleDescription}</p>
        <p style="font-size:14px;color:#4B5468">Sign in with this email address (${email}) to accept the invite.</p>
        <p style="margin:20px 0">
          <a href="${inviteUrl}" style="display:inline-block;background:#141B2E;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:999px">Accept invite</a>
        </p>
        <p style="font-size:13px;color:#9AA3B2">This link expires in 7 days. If you weren&rsquo;t expecting this, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

/** A campaign reward is ready, or they won a lucky draw. The code itself stays in the app. */
export async function sendCampaignRewardEmail(params: {
  email: string;
  name: string | null;
  subject: string;
  lead: string;
  path: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${siteUrl}${params.path}`;
  const first = params.name?.split(" ")[0] || "there";

  const { error } = await getClient().emails.send({
    from,
    to: params.email,
    subject: params.subject,
    text: `Hi ${first},\n\n${params.lead}\n\nSee it in My Rewards: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:440px;margin:0 auto;padding:24px">
        <p style="font-size:14px;color:#4B5468">Hi ${escapeHtml(first)},</p>
        <p style="font-size:14px;color:#4B5468">${escapeHtml(params.lead)}</p>
        <p style="margin:20px 0">
          <a href="${url}" style="display:inline-block;background:#141B2E;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:999px">Open My Rewards</a>
        </p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}
